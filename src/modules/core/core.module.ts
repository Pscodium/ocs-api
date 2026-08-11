import type { Router } from 'express';
import type { AppModule } from '../../core/server/moduleRegistry';
import type { AppDeps } from '../../core/deps';
import { registerCoreRoutes } from './core.routes';

/**
 * Core module (docs §8 step 6). The only domain responsibility beyond auth-check
 * is articles + storage/files. Mounts at ROOT (prefix '') — it owns the shared
 * root paths (notably '/check/auth'), so it must be registered FIRST.
 *
 * Native TS shell: routes/multer/enums wiring are TS; articles + storage
 * controllers run via interop behind typed facades until their bodies are split
 * into service/repository.
 */
export const coreModule: AppModule = {
    name: 'core',
    prefix: '',
    register(router: Router, _deps: AppDeps): void {
        registerCoreRoutes(router);
    },
};
