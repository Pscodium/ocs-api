import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * JWT/session auth (ported from authentication.js). Validates access tokens via a
 * remote JWKS (jose) and populates req.user/req.auth. Methods are `this`-free so
 * bare references stay safe when passed as middleware.
 *
 * Reads process.env directly (not the validated env singleton) so importing this
 * module — pulled in transitively by every module's routes — stays side-effect
 * free and does not require full env validation (keeps unit tests importable).
 */
const authIssuer = process.env.AUTH_ISSUER || 'http://localhost:3000';
const authAudience = process.env.AUTH_AUDIENCE || 'api://default';
const authJwksUrl = process.env.AUTH_JWKS_URL || `${authIssuer}/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(authJwksUrl));

interface AccessTokenPayload extends JWTPayload {
    roles?: unknown;
    client_id?: string;
    plan?: string;
}

async function validateAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, jwks, { issuer: authIssuer, audience: authAudience });
    return payload as AccessTokenPayload;
}

function getBearerToken(req: Request): string | null {
    const fromHeader = (value: unknown): string | null => {
        if (typeof value !== 'string') return null;
        const normalized = value.trim();
        if (!normalized) return null;
        const bearerMatch = normalized.match(/^Bearer\s+(.+)$/i);
        if (!bearerMatch) return null;
        return bearerMatch[1].trim() || null;
    };

    const headerToken = fromHeader(req?.headers?.authorization) || fromHeader(req?.headers?.authentication);
    if (headerToken) return headerToken;

    const cookieToken = (req as Request & { cookies?: Record<string, unknown> })?.cookies?.access_token;
    if (typeof cookieToken === 'string' && cookieToken.trim()) return cookieToken.trim();

    return null;
}

function normalizeRoles(roles: unknown): string[] {
    if (!roles) return [];
    if (Array.isArray(roles)) return roles as string[];
    return [String(roles)];
}

class AuthService {
    async sessionOrJwt(req: Request, res: Response, next: NextFunction): Promise<void> {
        const token = getBearerToken(req);
        if (!token) {
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
        try {
            const payload = await validateAccessToken(token);
            req.userId = payload.sub;
            req.userExternalId = payload.sub;
            req.auth = { roles: normalizeRoles(payload.roles), clientId: payload.client_id, plan: payload.plan };
            req.user = { id: payload.sub as string, roles: req.auth.roles, clientId: req.auth.clientId };
            req.is_master_admin = req.auth.roles.includes('admin');
            next();
        } catch {
            res.status(401).json({ error: 'invalid_token' });
        }
    }

    async loggedOrNot(req: Request, res: Response, next: NextFunction): Promise<void> {
        const token = getBearerToken(req);
        if (!token) {
            req.user = undefined;
            next();
            return;
        }
        try {
            const payload = await validateAccessToken(token);
            req.userId = payload.sub;
            req.userExternalId = payload.sub;
            req.auth = { roles: normalizeRoles(payload.roles), clientId: payload.client_id };
            req.user = { id: payload.sub as string, roles: req.auth.roles, clientId: req.auth.clientId };
            req.is_master_admin = req.auth.roles.includes('admin');
            next();
        } catch {
            req.user = undefined;
            next();
        }
    }

    async check(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'unauthorized' });
                return;
            }
            res.status(200).json({
                userId: req.userId,
                roles: (req.auth && req.auth.roles) || [],
                plan: req.auth ? req.auth.plan : undefined,
                clientId: req.auth ? req.auth.clientId : undefined,
            });
        } catch (err) {
            console.error(err);
            res.status(401).json({ error: 'unauthorized' });
        }
    }

    hasPermissions(permissions: string | Array<string | undefined>): RequestHandler {
        const list = Array.isArray(permissions) ? permissions : [permissions];
        return (req, res, next) => {
            const roles = req.auth && Array.isArray(req.auth.roles) ? req.auth.roles : [];
            if (!req.user || roles.length === 0) {
                res.sendStatus(403);
                return;
            }
            if (roles.includes('admin')) {
                next();
                return;
            }
            const hasAll = list.every((permission) => permission != null && roles.includes(permission));
            if (hasAll) {
                next();
                return;
            }
            res.status(401).json({ permissions: "You don't have permissions for use this route." });
        };
    }
}

export default new AuthService();
