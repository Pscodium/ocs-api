import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../../../../core/http/httpError';
import { ArticlesService } from '../domain/articles.service';

/**
 * Articles HTTP layer. Preserves legacy responses exactly: 404 as { message },
 * unexpected errors as a bare 500 (res.sendStatus), and the tag-without-title
 * early return that sends NO response (docs §1.4).
 */
function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
    return async (req: Request, res: Response, _next: NextFunction) => {
        try {
            await fn(req, res);
        } catch (e) {
            if (e instanceof HttpError) {
                res.status(e.status).json({ message: e.message });
                return;
            }
            console.error(e);
            res.sendStatus(500);
        }
    };
}

export function createArticlesController(service = new ArticlesService()) {
    return {
        create: handle(async (req, res) => {
            const { title, body, tags } = req.body ?? {};
            const result = await service.createArticle(title, body, req.userId, tags);
            if ('aborted' in result) return; // legacy hang: no response sent
            res.status(200).json(result.article);
        }),
        getArticlesByTagId: handle(async (req, res) => {
            res.status(200).json(await service.getArticlesByTagId(req.params.tagId));
        }),
        getAllArticles: handle(async (_req, res) => {
            res.status(200).json(await service.getAllArticles());
        }),
        getAllTags: handle(async (_req, res) => {
            res.status(200).json(await service.getAllTags());
        }),
        updateArticle: handle(async (req, res) => {
            await service.updateArticle(req.params.id, req.body ?? {});
            res.sendStatus(200);
        }),
        deleteArticle: handle(async (req, res) => {
            await service.deleteArticle(req.params.id);
            res.sendStatus(200);
        }),
        deleteTag: handle(async (req, res) => {
            await service.deleteTag(req.params.id);
            res.sendStatus(200);
        }),
    };
}

export type ArticlesController = ReturnType<typeof createArticlesController>;
