import { describe, expect, it } from 'vitest';
import { HttpError } from './httpError';

describe('HttpError', () => {
    it('assigns default code from status', () => {
        const err = new HttpError(404, 'nope');
        expect(err.status).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err).toBeInstanceOf(Error);
    });

    it('factory helpers set status + code', () => {
        expect(HttpError.badRequest().status).toBe(400);
        expect(HttpError.unauthorized().code).toBe('UNAUTHORIZED');
        expect(HttpError.tooManyRequests().status).toBe(429);
    });

    it('keeps explicit code and details', () => {
        const err = new HttpError(418, 'teapot', 'IM_A_TEAPOT', { hot: true });
        expect(err.code).toBe('IM_A_TEAPOT');
        expect(err.details).toEqual({ hot: true });
    });
});
