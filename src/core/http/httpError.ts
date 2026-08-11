/**
 * Central HTTP error type. Controllers/services throw these; the errorHandler
 * middleware turns them into responses. Replaces scattered res.status().json()
 * error branches (docs/refactor-typescript.md §3.4).
 */
export class HttpError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details?: unknown;

    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.code = code ?? HttpError.defaultCode(status);
        this.details = details;
        Object.setPrototypeOf(this, HttpError.prototype);
    }

    private static defaultCode(status: number): string {
        const map: Record<number, string> = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'UNPROCESSABLE_ENTITY',
            429: 'TOO_MANY_REQUESTS',
            500: 'INTERNAL_ERROR',
        };
        return map[status] ?? 'ERROR';
    }

    static badRequest(message = 'Bad request', details?: unknown): HttpError {
        return new HttpError(400, message, 'BAD_REQUEST', details);
    }
    static unauthorized(message = 'Unauthorized'): HttpError {
        return new HttpError(401, message, 'UNAUTHORIZED');
    }
    static forbidden(message = 'Forbidden'): HttpError {
        return new HttpError(403, message, 'FORBIDDEN');
    }
    static notFound(message = 'Not found'): HttpError {
        return new HttpError(404, message, 'NOT_FOUND');
    }
    static conflict(message = 'Conflict'): HttpError {
        return new HttpError(409, message, 'CONFLICT');
    }
    static tooManyRequests(message = 'Too many requests'): HttpError {
        return new HttpError(429, message, 'TOO_MANY_REQUESTS');
    }
    static internal(message = 'Internal server error'): HttpError {
        return new HttpError(500, message, 'INTERNAL_ERROR');
    }
}
