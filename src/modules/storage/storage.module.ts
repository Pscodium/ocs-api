import type { Router } from 'express';
import type { AppModule } from '../../core/server/moduleRegistry';
import type { AppDeps } from '../../core/deps';
import { registerArticlesRoutes } from './articles/http/articles.routes';
import { registerFilesRoutes } from './files/http/files.routes';

/**
 * Storage module (docs §3.2 / §4). Absorbs articles + storage/files out of the
 * old core. Canonical prefix '/storage' (→ /storage/article/..., /storage/upload/...);
 * legacyPrefixes [''] remounts the same router at root so the original paths
 * (/article/..., /list/..., /storage/upload, /proxy) keep working — only host:port
 * changes for consumers (docs §5).
 *
 * TS shell: routes/multer/enums wiring are TS; the articles + files controllers
 * run via interop facades (storage.facade.ts) until split into service/repository.
 */
export const storageModule: AppModule = {
    name: 'storage',
    prefix: '/storage',
    legacyPrefixes: [''],
    register(router: Router, _deps: AppDeps): void {
        registerArticlesRoutes(router);
        registerFilesRoutes(router);
    },
};
