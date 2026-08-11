/**
 * Ambient augmentation of Express Request with the fields our middleware attach.
 * Mirrors src/middleware/authentication.js and src/middleware/featureFlags.js so
 * TS controllers can read req.user/req.auth/req.features without casts.
 */

export interface AuthContext {
    roles: string[];
    clientId?: string;
    plan?: string;
}

export interface AuthUser {
    id: string;
    roles: string[];
    clientId?: string;
}

export interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetAt?: number;
}

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userExternalId?: string;
            auth?: AuthContext;
            user?: AuthUser;
            is_master_admin?: boolean;

            // Feature flags (src/middleware/featureFlags.js)
            features?: Record<string, unknown>;
            traits?: Record<string, unknown>;
            planIdentifier?: string;
            featureAccess?: Record<string, boolean>;
            rateLimitInfo?: RateLimitInfo;

            // Finder API-key auth
            apiKey?: string;
        }
    }
}

export {};
