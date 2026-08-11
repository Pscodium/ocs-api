import { type Express, Router } from 'express';
import type { AppDeps } from '../deps';

/**
 * A self-contained feature module (vertical slice). Each module mounts under its
 * canonical `prefix` and, during the transition, may also mount under legacy
 * prefixes so existing consumers only change host:port, not paths
 * (docs/refactor-typescript.md §3.3, §5).
 */
export interface AppModule {
    /** Canonical mount prefix, e.g. '/financial'. Use '' for root (core only). */
    prefix: string;
    /** Registers routes onto the module's own router. */
    register(router: Router, deps: AppDeps): void;
    /** Legacy mount prefixes for backward compatibility. e.g. [''] for root aliases. */
    legacyPrefixes?: string[];
    /** Optional human name for logging/deprecation tracking. */
    name?: string;
}

/**
 * Mounts modules onto the app. Modules are mounted canonical-first; legacy
 * aliases are collected and mounted afterwards (in registration order) so
 * catch-all routes (e.g. shorten `GET /:code`) can be ordered last by the caller
 * to avoid collisions (docs/refactor-typescript.md §5).
 */
export function registerModules(app: Express, modules: AppModule[], deps: AppDeps): void {
    const legacyMounts: Array<{ prefix: string; router: Router; name: string }> = [];

    for (const mod of modules) {
        const router = Router({ mergeParams: true });
        mod.register(router, deps);
        app.use(mod.prefix || '/', router);

        for (const legacy of mod.legacyPrefixes ?? []) {
            legacyMounts.push({ prefix: legacy, router, name: mod.name ?? mod.prefix });
        }
    }

    for (const { prefix, router } of legacyMounts) {
        app.use(prefix || '/', router);
    }
}
