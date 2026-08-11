import type { Router } from 'express';
import { auth } from '../../../shared/middleware/auth.middleware';
import type { ShortenController } from './shorten.controller';

/**
 * Mounts shorten routes onto the module router (mounted at prefix '/shorten').
 * Canonical create is `POST /shorten` (locked decision, docs §9) → router POST '/'.
 * Specific routes are declared before the `/:code` param route to avoid capture.
 */
export function registerShortenRoutes(router: Router, controller: ShortenController): void {
    router.post('/', auth.sessionOrJwt, controller.shorten);
    router.get('/user/urls', auth.sessionOrJwt, controller.listUserUrls);
    router.delete('/user/url/:code', auth.sessionOrJwt, controller.removeUserUrl);
    router.get('/:code', controller.redirect);
}
