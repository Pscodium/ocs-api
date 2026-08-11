import type { Router } from 'express';
import { auth } from '../../../shared/middleware/auth.middleware';

/**
 * Core is NOT a business module (docs §3.2). Its only domain responsibility is
 * authentication check: GET /check/auth (via AuthService.check). Everything else
 * — articles + storage/files — lives in the `storage` module. Mounted at root and
 * FIRST, so it owns the shared '/check/auth' path.
 */
export function registerCoreRoutes(router: Router): void {
    router.get('/check/auth', auth.sessionOrJwt, auth.check);
}
