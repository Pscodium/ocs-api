import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../../../core/http/httpError';
import { FinderService, type ProductWhere } from '../domain/finder.service';

/**
 * Thin HTTP layer. Renders domain HttpError in the LEGACY `{ error: message }`
 * shape and unexpected errors as a bare 500 (res.sendStatus) — byte-for-byte
 * matching the old controller so consumers see no change (docs §1.4).
 */
function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
    return async (req: Request, res: Response, _next: NextFunction) => {
        try {
            await fn(req, res);
        } catch (e) {
            if (e instanceof HttpError) {
                res.status(e.status).json({ error: e.message });
                return;
            }
            console.error(e);
            res.sendStatus(500);
        }
    };
}

const productWhere = (req: Request): ProductWhere => {
    const productId = req.params.productId ?? req.params.id;
    const where: ProductWhere = { id: productId };
    if (req.params.productId) where.establishmentId = req.params.establishmentId ?? req.params.id;
    return where;
};

export function createFinderController(service = new FinderService()) {
    return {
        getEstablishments: handle(async (_req, res) => {
            res.status(200).json(await service.listEstablishments());
        }),
        getEstablishmentById: handle(async (req, res) => {
            res.status(200).json(await service.getEstablishment(req.params.id));
        }),
        createEstablishment: handle(async (req, res) => {
            res.status(201).json(await service.createEstablishment(req.body ?? {}));
        }),
        updateEstablishment: handle(async (req, res) => {
            res.status(200).json(await service.updateEstablishment(req.params.id, req.body ?? {}));
        }),
        deleteEstablishment: handle(async (req, res) => {
            await service.deleteEstablishment(req.params.id);
            res.sendStatus(204);
        }),
        getProductsByEstablishment: handle(async (req, res) => {
            const establishmentId = req.params.establishmentId ?? req.params.id;
            res.status(200).json(await service.listProducts(establishmentId));
        }),
        createProduct: handle(async (req, res) => {
            const establishmentId = req.params.establishmentId ?? req.params.id;
            res.status(201).json(await service.createProduct(establishmentId, req.body ?? {}));
        }),
        updateProduct: handle(async (req, res) => {
            res.status(200).json(await service.updateProduct(productWhere(req), req.body ?? {}));
        }),
        deleteProduct: handle(async (req, res) => {
            await service.deleteProduct(productWhere(req));
            res.sendStatus(204);
        }),
        getAllProductCategories: handle(async (_req, res) => {
            res.status(200).json(await service.getCategories());
        }),
        reverseGeocode: handle(async (req, res) => {
            res.status(200).json(await service.reverseGeocode(req.query.lat, req.query.lng));
        }),
    };
}

export type FinderController = ReturnType<typeof createFinderController>;
