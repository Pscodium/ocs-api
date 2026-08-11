import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async controller so rejected promises reach the error middleware
 * instead of hanging the request. Removes repeated try/catch in controllers
 * (docs/refactor-typescript.md §3.4).
 */
export const asyncHandler =
    (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
