import type { Router } from 'express';
import { auth } from '../../../../shared/middleware/auth.middleware';
import { Permissions } from '../../../../shared/enums';
import { createArticlesController } from './articles.controller';

/**
 * Articles slice of the storage module (docs §3.2 `modules/storage/articles/`).
 * Native TS + Prisma. Router paths are relative to the '/storage' prefix, so
 * canonical becomes /storage/article/..., /storage/list-all/... (docs §4); the
 * legacy root paths (/article/..., /list/...) keep working via the module's
 * legacy root alias.
 *
 * Permissions.CAN_POST is undefined (enum has only ADMIN/USER), so [ADMIN, undefined]
 * is preserved exactly — matching the legacy routes.
 */
export function registerArticlesRoutes(router: Router): void {
    const a = createArticlesController();
    const canPost = auth.hasPermissions([Permissions.ADMIN, Permissions.CAN_POST]);

    router.post('/article/create', auth.sessionOrJwt, canPost, a.create);
    router.get('/list/articles/:tagId', a.getArticlesByTagId);
    router.get('/list-all/articles', a.getAllArticles);
    router.get('/list-all/tags', a.getAllTags);
    router.put('/article/update/:id', auth.sessionOrJwt, canPost, a.updateArticle);
    router.delete('/article/delete/:id', auth.sessionOrJwt, canPost, a.deleteArticle);
    router.delete('/tag/delete/:id', auth.sessionOrJwt, canPost, a.deleteTag);
}
