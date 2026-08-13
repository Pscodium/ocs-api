import type { RequestHandler } from 'express';
import authService from './authentication';

/**
 * Auth middleware surface consumed by module routes. Now a thin re-export of the
 * ported TS AuthService singleton (src/middleware/authentication.ts). Methods are
 * `this`-free, so passing bare references stays safe.
 */
export interface AuthMiddleware {
    /** Requires a valid session/JWT; 401 otherwise. */
    sessionOrJwt: RequestHandler;
    /** Populates req.user when a token is present; never rejects. */
    loggedOrNot: RequestHandler;
    /** Validates the API key for modules. */
    apiKeyValidator: RequestHandler;
    /** GET /check/auth handler. */
    check: RequestHandler;
    /** Factory: requires all listed permissions (admin bypasses). Array may contain
     *  undefined entries — legacy passes e.g. Permissions.CAN_POST which is undefined. */
    hasPermissions: (permissions: string | Array<string | undefined>) => RequestHandler;
}

export const auth: AuthMiddleware = authService;
