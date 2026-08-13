import { HttpError } from "@core/http/httpError";
import { ZodError } from "zod";
import { NextFunction, RequestHandler, Request, Response } from "express";
import { NerService } from "@modules/ner/domain/ner.service";
import { maskSchema, maskCustomSchema } from "@modules/ner/domain/ner.dto";


function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
    return async (req: Request, res: Response, _next: NextFunction) => {
        try {
            await fn(req, res);
        } catch (e) {
            if (e instanceof HttpError) {
                res.status(e.status).json({ error: e.message });
                return;
            }
            if (e instanceof ZodError) {
                res.status(400).json({ error: 'Validation failed', details: e.issues });
                return;
            }
            console.error(e);
            res.sendStatus(500);
        }
    };
}

export function createNerController(service = new NerService()) {
    return {
        getLabels: handle(async (_req, res) => {
            res.status(200).json(await service.getLabels());
        }),
        mask: handle(async (req, res) => {
            res.status(200).json(await service.mask(maskSchema.parse(req.body)));
        }),
        maskCustom: handle(async (req, res) => {
            res.status(200).json(await service.maskCustom(maskCustomSchema.parse(req.body)));
        })
    }
}