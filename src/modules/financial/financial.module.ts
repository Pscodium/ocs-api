import type { Router } from 'express';
import type { AppModule } from '../../core/server/moduleRegistry';
import type { AppDeps } from '../../core/deps';
import { registerFinancialRoutes } from './http/financial.routes';

/**
 * Financial module — native TS shell (docs §8 step 5). Routes + middleware wiring
 * are TS; the large legacy controller runs via interop behind FinancialController
 * (typed facade) until its handlers are split into service/repository incrementally.
 *
 * Auth = JWT (auth.sessionOrJwt) + feature flags + rate limit. Canonical prefix
 * '/financial'; legacyPrefixes [''] remounts the same router at root so original
 * paths (e.g. /months, /health) keep working — only host:port changes (docs §5).
 *
 * Root-path ownership (docs §5): '/check/auth' and '/features'/'/health' also exist
 * on the core module. Core is registered FIRST, so it owns the root versions; the
 * financial copies are reachable canonically under '/financial/...'.
 */
export const financialModule: AppModule = {
    name: 'financial',
    prefix: '/financial',
    legacyPrefixes: [''],
    register(router: Router, _deps: AppDeps): void {
        registerFinancialRoutes(router);
    },
};
