import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getAllFeaturesAndTraits, getTrait, hasFeature } from './client';
import redis from '../../config/redis';

/**
 * SHARED feature-flag + rate-limit middleware — service-agnostic. The identity is
 * the caller's plan (req.auth.plan); feature names / rate-limit resources are
 * passed by each module, so any service (financial, finder, …) reuses these with
 * its OWN flags. Keep new feature flags namespaced per service (e.g.
 * 'financial_months', 'finder_geocode') to avoid collisions.
 *
 * Logic kept verbatim, including checkRateLimit's res.json/res.send monkey-patch
 * that increments usage only on a 2xx response (docs §7 flags this as delicate).
 */

export function requireFeature(featureName: string): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userPlan = req.auth?.plan;
            if (!userPlan) {
                res.status(403).json({ error: 'forbidden', message: 'User plan not found in token' });
                return;
            }
            const planIdentifier = userPlan;
            const isEnabled = await hasFeature(planIdentifier, featureName);
            if (!isEnabled) {
                res.status(403).json({
                    error: 'forbidden',
                    message: `Feature '${featureName}' is not available for your plan (${userPlan})`,
                    feature: featureName,
                    plan: userPlan,
                });
                return;
            }
            req.featureAccess = { feature: featureName, plan: userPlan, identifier: planIdentifier };
            next();
        } catch (error) {
            console.error('Error checking feature access:', error);
            res.status(500).json({ error: 'internal_error', message: 'Error checking feature access' });
        }
    };
}

export function checkRateLimit(resource: string, operation = 'create'): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userPlan = req.auth?.plan;
            const userId = req.userId;
            if (!userPlan || !userId) {
                res.status(403).json({ error: 'forbidden', message: 'User plan or ID not found' });
                return;
            }

            const planIdentifier = userPlan;
            const traitKey = `${resource}_${operation}_limit`;
            const rateLimit = await getTrait(planIdentifier, traitKey);
            if (rateLimit === null || rateLimit === undefined) {
                next();
                return;
            }
            const limit = parseInt(String(rateLimit), 10);
            if (isNaN(limit) || limit <= 0) {
                next();
                return;
            }

            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const redisKey = `ratelimit:${userId}:${resource}:${operation}:${currentMonth}`;
            const currentUsage = await redis.get(redisKey);
            const usage = currentUsage ? parseInt(currentUsage, 10) : 0;

            if (usage >= limit) {
                res.status(429).json({
                    error: 'rate_limit_exceeded',
                    message: `Monthly limit of ${limit} ${operation} operations for ${resource} exceeded`,
                    limit,
                    current: usage,
                    resource,
                    operation,
                    plan: userPlan,
                });
                return;
            }

            req.rateLimitInfo = { redisKey, resource, operation, limit, current: usage, incremented: false } as unknown as Request['rateLimitInfo'];

            // Intercept res.status/json/send to increment usage on a 2xx response.
            const originalStatus = res.status.bind(res);
            const originalJson = res.json.bind(res);
            const originalSend = res.send.bind(res);
            let statusCode = 200;

            const info = req.rateLimitInfo as unknown as {
                redisKey: string;
                incremented: boolean;
            };

            res.status = function (code: number) {
                statusCode = code;
                return originalStatus(code);
            };

            const incrementOnSuccess = async (): Promise<void> => {
                if (statusCode >= 200 && statusCode < 300 && info && !info.incremented) {
                    info.incremented = true;
                    try {
                        await redis.incr(info.redisKey);
                        const now = new Date();
                        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        const secondsUntilExpiry = Math.floor((endOfCurrentMonth.getTime() - now.getTime()) / 1000);
                        await redis.expire(info.redisKey, secondsUntilExpiry);
                    } catch (error) {
                        console.error('Error incrementing rate limit:', error);
                    }
                }
            };

            res.json = function (data: unknown) {
                void incrementOnSuccess().then(() => originalJson(data));
                return res;
            };
            res.send = function (data: unknown) {
                void incrementOnSuccess().then(() => originalSend(data));
                return res;
            };

            next();
        } catch (error) {
            console.error('Error checking rate limit:', error);
            next();
        }
    };
}

export async function getRateLimitStatus(
    userId: string,
    plan: string,
    resource: string,
    operation: string,
): Promise<Record<string, unknown> | null> {
    try {
        const planIdentifier = plan;
        const traitKey = `${resource}_${operation}_limit`;
        const limit = await getTrait(planIdentifier, traitKey);
        const limitValue = limit ? parseInt(String(limit), 10) : null;

        const currentMonth = new Date().toISOString().slice(0, 7);
        const redisKey = `ratelimit:${userId}:${resource}:${operation}:${currentMonth}`;
        const currentUsage = await redis.get(redisKey);
        const usage = currentUsage ? parseInt(currentUsage, 10) : 0;

        return {
            resource,
            operation,
            limit: limitValue,
            current: usage,
            remaining: limitValue ? Math.max(0, limitValue - usage) : null,
            unlimited: limitValue === null,
        };
    } catch (error) {
        console.error('Error getting rate limit status:', error);
        return null;
    }
}

export async function loadUserFeatures(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
        const userPlan = req.auth?.plan;
        if (!userPlan) {
            req.features = {};
            next();
            return;
        }
        const planIdentifier = userPlan;
        const { flags, traits } = await getAllFeaturesAndTraits(planIdentifier);

        const features: Record<string, { enabled: boolean; value: unknown }> = {};
        if (flags && Array.isArray(flags)) {
            flags.forEach((flag) => {
                features[flag.feature.name] = { enabled: flag.enabled, value: flag.feature_state_value };
            });
        }

        req.features = features;
        req.traits = traits || [];
        req.planIdentifier = planIdentifier;
        next();
    } catch (error) {
        console.error('Error loading user features:', error);
        req.features = {};
        req.traits = [];
        next();
    }
}
