const { hasFeature, getTrait, getAllFeaturesAndTraits } = require('../config/flagsmith');
const redis = require('../config/redis');

/**
 * Middleware to check if user has access to a specific feature
 * @param {string} featureName - Name of the feature to check
 * @returns {Function} Express middleware
 */
function requireFeature(featureName) {
    return async function(req, res, next) {
        try {
            // Get user plan from JWT token
            const userPlan = req.auth?.plan;

            if (!userPlan) {
                return res.status(403).json({
                    error: 'forbidden',
                    message: 'User plan not found in token'
                });
            }

            // Map plan to identity identifier
            const planIdentifier = userPlan; // e.g., 'free_plan', 'premium_plan', 'ultimate_plan'

            // Check if feature is enabled for this plan
            const isEnabled = await hasFeature(planIdentifier, featureName);

            if (!isEnabled) {
                return res.status(403).json({
                    error: 'forbidden',
                    message: `Feature '${featureName}' is not available for your plan (${userPlan})`,
                    feature: featureName,
                    plan: userPlan
                });
            }

            // Store feature info in request for later use
            req.featureAccess = {
                feature: featureName,
                plan: userPlan,
                identifier: planIdentifier
            };

            return next();
        } catch (error) {
            console.error('Error checking feature access:', error);
            return res.status(500).json({
                error: 'internal_error',
                message: 'Error checking feature access'
            });
        }
    };
}

/**
 * Middleware to check rate limit based on plan traits
 * @param {string} resource - Resource name (e.g., 'months', 'budgets')
 * @param {string} operation - Operation type (e.g., 'create', 'update', 'delete')
 * @returns {Function} Express middleware
 */
function checkRateLimit(resource, operation = 'create') {
    return async function(req, res, next) {
        try {
            const userPlan = req.auth?.plan;
            const userId = req.userId;

            if (!userPlan || !userId) {
                return res.status(403).json({
                    error: 'forbidden',
                    message: 'User plan or ID not found'
                });
            }

            const planIdentifier = userPlan;
            const traitKey = `${resource}_${operation}_limit`;

            // Get rate limit from trait
            const rateLimit = await getTrait(planIdentifier, traitKey);

            if (rateLimit === null || rateLimit === undefined) {
                // No limit defined, allow request
                return next();
            }

            const limit = parseInt(rateLimit, 10);
            if (isNaN(limit) || limit <= 0) {
                // Invalid limit, allow request
                return next();
            }

            // Check current usage from Redis
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const redisKey = `ratelimit:${userId}:${resource}:${operation}:${currentMonth}`;
            const currentUsage = await redis.get(redisKey);
            const usage = currentUsage ? parseInt(currentUsage, 10) : 0;

            if (usage >= limit) {
                return res.status(429).json({
                    error: 'rate_limit_exceeded',
                    message: `Monthly limit of ${limit} ${operation} operations for ${resource} exceeded`,
                    limit: limit,
                    current: usage,
                    resource: resource,
                    operation: operation,
                    plan: userPlan
                });
            }

            // Store info for incrementing later
            req.rateLimitInfo = {
                redisKey,
                resource,
                operation,
                limit,
                current: usage,
                incremented: false // Flag to prevent double increment
            };

            // Intercept res.status and res.json to increment on success
            const originalStatus = res.status.bind(res);
            const originalJson = res.json.bind(res);
            const originalSend = res.send.bind(res);

            let statusCode = 200;

            res.status = function(code) {
                statusCode = code;
                return originalStatus(code);
            };

            const incrementOnSuccess = async () => {
                // Increment only once, only if status is 200, 201, or 204 (success)
                if (statusCode >= 200 && statusCode < 300 && req.rateLimitInfo && !req.rateLimitInfo.incremented) {
                    req.rateLimitInfo.incremented = true; // Mark as incremented to prevent double increment
                    try {
                        await redis.incr(req.rateLimitInfo.redisKey);
                        
                        // Set expiry to end of current month (30 days approximately)
                        const now = new Date();
                        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        const secondsUntilExpiry = Math.floor((endOfCurrentMonth.getTime() - now.getTime()) / 1000);
                        await redis.expire(req.rateLimitInfo.redisKey, secondsUntilExpiry);
                    } catch (error) {
                        console.error('Error incrementing rate limit:', error);
                    }
                }
            };

            res.json = async function(data) {
                await incrementOnSuccess();
                return originalJson(data);
            };

            res.send = async function(data) {
                await incrementOnSuccess();
                return originalSend(data);
            };

            return next();
        } catch (error) {
            console.error('Error checking rate limit:', error);
            // On error, allow request to proceed
            return next();
        }
    };
}

/**
 * Get current rate limit status for a user
 * @param {string} userId - User ID
 * @param {string} plan - User plan
 * @param {string} resource - Resource name
 * @param {string} operation - Operation type
 * @returns {Promise<Object>} - Rate limit status
 */
async function getRateLimitStatus(userId, plan, resource, operation) {
    try {
        const planIdentifier = plan;
        const traitKey = `${resource}_${operation}_limit`;
        
        const limit = await getTrait(planIdentifier, traitKey);
        const limitValue = limit ? parseInt(limit, 10) : null;

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
            unlimited: limitValue === null
        };
    } catch (error) {
        console.error('Error getting rate limit status:', error);
        return null;
    }
}

/**
 * Middleware to get all features for user's plan
 * Attaches feature list to req.features
 */
async function loadUserFeatures(req, res, next) {
    try {
        const userPlan = req.auth?.plan;

        if (!userPlan) {
            req.features = {};
            return next();
        }

        const planIdentifier = userPlan;
        const { flags, traits } = await getAllFeaturesAndTraits(planIdentifier);
        
        // Get all features
        const features = {};
        
        if (flags && Array.isArray(flags)) {
            flags.forEach(flag => {
                features[flag.feature.name] = {
                    enabled: flag.enabled,
                    value: flag.feature_state_value
                };
            });
        }

        req.features = features;
        req.traits = traits || [];
        req.planIdentifier = planIdentifier;
        
        return next();
    } catch (error) {
        console.error('Error loading user features:', error);
        req.features = {};
        req.traits = [];
        return next();
    }
}

module.exports = {
    requireFeature,
    checkRateLimit,
    getRateLimitStatus,
    loadUserFeatures
};
