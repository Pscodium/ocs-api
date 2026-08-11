import type { Router } from 'express';
import { auth } from '../../shared/middleware/auth.middleware';
import type { ShortenController } from './shorten.controller';

/**
 * Legacy root aliases for shorten (docs §5). Original paths were served at the
 * ROOT of a dedicated port: `POST /shorten`, `GET /user/urls`,
 * `DELETE /user/url/:code`, and the catch-all `GET /:code`. Their shape differs
 * from the canonical `/shorten`-prefixed router, so they are registered here on a
 * dedicated root router that the app mounts LAST — the `GET /:code` catch-all must
 * come after every other route to avoid swallowing them.
 */
export function registerShortenLegacyRoutes(router: Router, controller: ShortenController): void {
    router.post('/shorten', auth.sessionOrJwt, controller.shorten);
    router.get('/user/urls', auth.sessionOrJwt, controller.listUserUrls);
    router.delete('/user/url/:code', auth.sessionOrJwt, controller.removeUserUrl);
    // Catch-all redirect — MUST be last across the whole app.
    router.get('/:code', controller.redirect);
}
