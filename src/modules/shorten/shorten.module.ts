import type { Router } from 'express';
import type { AppModule } from '../../core/server/moduleRegistry';
import type { AppDeps } from '../../core/deps';
import { ShortenService } from './shorten.service';
import { createShortenController } from './shorten.controller';
import { registerShortenRoutes } from './shorten.routes';

/**
 * Shorten module (pilot for the modular pattern, docs §8 step 4).
 * Redis-only — no database, so independent of the Prisma migration (step 3).
 *
 * Legacy compatibility note (docs §5): legacy paths were served at the ROOT of a
 * dedicated port (POST /shorten, GET /:code, GET /user/urls, DELETE /user/url/:code).
 * The canonical create moves to router-root under the '/shorten' prefix, so the
 * legacy alias shape differs from a plain remount — the generic `legacyPrefixes`
 * remount does NOT fit here. Root aliases (esp. the `GET /:code` catch-all) are
 * wired explicitly at consolidation (step 7), registered LAST to avoid collisions.
 */
/** Builds the shorten controller from deps — shared by the canonical module and
 *  the legacy root-alias router so both hit the same service instance semantics. */
export function buildShortenController(deps: AppDeps) {
    const service = new ShortenService({
        redis: deps.redis,
        baseUrl: deps.config.SHORTEN_BASE_URL ?? '',
    });
    return createShortenController(service);
}

export const shortenModule: AppModule = {
    name: 'shorten',
    prefix: '/shorten',
    register(router: Router, deps: AppDeps): void {
        registerShortenRoutes(router, buildShortenController(deps));
    },
};
