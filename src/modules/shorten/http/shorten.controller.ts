import type { RequestHandler } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { HttpError } from '../../../core/http/httpError';
import { listUrlsQuery, shortenUrlBody } from '../domain/shorten.dto';
import { notFoundPage } from '../domain/notFound.page';
import type { ShortenService } from '../domain/shorten.service';

export interface ShortenController {
    shorten: RequestHandler;
    redirect: RequestHandler;
    listUserUrls: RequestHandler;
    removeUserUrl: RequestHandler;
}

/** Thin HTTP layer over ShortenService. Validation via zod DTOs; errors via HttpError. */
export function createShortenController(service: ShortenService): ShortenController {
    return {
        shorten: asyncHandler(async (req, res) => {
            const { url } = shortenUrlBody.parse(req.body);
            const result = await service.create(url, String(req.userId));
            res.json({ shortUrl: result.shortUrl });
        }),

        redirect: asyncHandler(async (req, res) => {
            const original = await service.resolve(req.params.code);
            if (!original) {
                res.status(404).send(notFoundPage);
                return;
            }
            res.redirect(original);
        }),

        listUserUrls: asyncHandler(async (req, res) => {
            if (!req.userId) throw HttpError.unauthorized('Usuário não autenticado');
            const query = listUrlsQuery.parse(req.query);
            res.json(await service.listByUser(String(req.userId), query));
        }),

        removeUserUrl: asyncHandler(async (req, res) => {
            if (!req.userId) throw HttpError.unauthorized('Usuário não autenticado');
            const outcome = await service.remove(req.params.code, String(req.userId));
            if (outcome === 'not_found') throw HttpError.notFound('URL não encontrada');
            if (outcome === 'forbidden') throw HttpError.forbidden('URL não pertence ao usuário');
            res.sendStatus(204);
        }),
    };
}
