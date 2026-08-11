import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './httpError';

interface ErrorBody {
    error: { code: string; message: string; details?: unknown };
}

/** 404 fallthrough for unmatched routes. Mount after all module routers. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
    next(HttpError.notFound('Route not found'));
};

/**
 * Central error middleware. Normalizes HttpError, ZodError and unknown throws
 * into a consistent JSON envelope. Mount last.
 */
export const errorHandler = (logErrors = true): ErrorRequestHandler => {
    return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        let status = 500;
        let body: ErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };

        if (err instanceof HttpError) {
            status = err.status;
            body = { error: { code: err.code, message: err.message, details: err.details } };
        } else if (err instanceof ZodError) {
            status = 400;
            body = {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: err.issues,
                },
            };
        } else if (err instanceof Error) {
            body.error.message = err.message;
        }

        if (logErrors && status >= 500) {
            console.error('[Error]', err);
        }

        res.status(status).json(body);
    };
};
