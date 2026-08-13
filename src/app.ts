import express, { type Express, Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { logs } from './shared/middleware/logs.middleware';
import type { AppDeps } from './core/deps';
import { registerModules, type AppModule } from './core/server/moduleRegistry';
import { errorHandler, notFoundHandler } from './core/http/errorHandler';
import { shortenModule, buildShortenController } from './modules/shorten/shorten.module';
import { registerShortenLegacyRoutes } from './modules/shorten/http/shorten.legacy';
import { finderModule } from './modules/finder/finder.module';
import { nerModule } from './modules/ner/ner.module';
import { financialModule } from './modules/financial/financial.module';
import { coreModule } from './modules/core/core.module';
import { storageModule } from './modules/storage/storage.module';

/**
 * Consolidated single-port app (docs §8 step 7). All subsystems run in ONE
 * process on ONE port, separated by endpoint prefix — no more bootstrapServers()
 * or per-module port envs. Modules also mount legacy root aliases so consumers
 * only change host:port, not paths (docs §5).
 *
 * Migration state: all modules are native TS. shorten + finder are fully ported
 * (service/repository); core + financial are TS shells whose legacy controllers
 * run via typed interop facades, split into service/repository incrementally.
 *
 * Shorten is the ONE exception to single-port: it runs on its own server
 * (createShortenApp, SHORTEN_PORT) because its GET /:code catch-all would
 * otherwise swallow every other module's routes.
 */
export function createApp(deps: AppDeps): Express {
    const app = express();
    const { config } = deps;

    // --- Global middleware (was duplicated across index.js + servers.js, now central)
    app.use(express.json());
    app.use(cookieParser());
    app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
    if (!config.DISABLED_LOGS) {
        app.use(logs);
    }

    // --- Modules. Order matters: core owns shared root paths (/check/auth);
    // financial/finder expose legacy root aliases. Shorten runs on its own server
    // (createShortenApp) so its GET /:code catch-all can't shadow these.
    const modules: AppModule[] = [
        // Core: ONLY /check/auth. Owns the shared root path — mount FIRST (docs §3.2).
        coreModule,
        // Storage: articles + files, prefix '/storage' + legacy root aliases (docs §3.2/§4).
        storageModule,
        // Financial: native TS shell (routes/middleware TS; controller via interop).
        financialModule,
        // NER: native TS module, prefix '/ner'. API-key auth. MUST be registered
        // before finder's legacy root ('') mount, else finder's root api-key gate
        // intercepts /ner/* first (docs §5, moduleRegistry legacy-last ordering).
        nerModule,
        // Finder: native TS module (Sequelize-backed repository). API-key auth.
        finderModule,
        // Shorten canonical (/shorten). Legacy root aliases handled separately below.
        shortenModule,
    ];

    registerModules(app, modules, deps);

    // --- Error handling (must be last).
    app.use(notFoundHandler);
    app.use(errorHandler(!config.DISABLED_LOGS));

    return app;
}

/**
 * Dedicated shorten server (SHORTEN_PORT). Same global middleware as the main app,
 * plus the canonical '/shorten' module and the legacy root aliases (POST /shorten,
 * GET /user/urls, DELETE /user/url/:code, GET /:code). The GET /:code catch-all is
 * registered LAST and, being on its own port, cannot collide with other modules.
 */
export function createShortenApp(deps: AppDeps): Express {
    const app = express();
    const { config } = deps;

    app.use(express.json());
    app.use(cookieParser());
    app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
    if (!config.DISABLED_LOGS) {
        app.use(logs);
    }

    registerModules(app, [shortenModule], deps);

    // Legacy root aliases (incl. GET /:code catch-all) — mounted LAST.
    const shortenLegacy = Router();
    registerShortenLegacyRoutes(shortenLegacy, buildShortenController(deps));
    app.use(shortenLegacy);

    app.use(notFoundHandler);
    app.use(errorHandler(!config.DISABLED_LOGS));

    return app;
}
