import express, { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { RedisClientType } from 'redis';
import { buildDeps } from './core/deps';
import type { Env } from './config/env';
import { registerModules } from './core/server/moduleRegistry';
import { errorHandler, notFoundHandler } from './core/http/errorHandler';
import { shortenModule, buildShortenController } from './modules/shorten/shorten.module';
import { registerShortenLegacyRoutes } from './modules/shorten/http/shorten.legacy';

// Redis mock seeded with one known short code (no auth needed for redirect).
function redisWith(store: Record<string, Record<string, string>>): RedisClientType {
    return {
        hGetAll: async (key: string) => store[key] ?? {},
        hIncrBy: async () => 1,
    } as unknown as RedisClientType;
}

const fakeEnv = { SHORTEN_BASE_URL: 'https://s.test', DISABLED_LOGS: true } as unknown as Env;

function makeApp(store: Record<string, Record<string, string>>) {
    const deps = buildDeps(fakeEnv, { redis: redisWith(store) });
    const app = express();
    registerModules(app, [shortenModule], deps);
    const legacy = Router();
    registerShortenLegacyRoutes(legacy, buildShortenController(deps));
    app.use(legacy);
    app.use(notFoundHandler);
    app.use(errorHandler(false));
    return app;
}

describe('shorten routing (canonical + legacy aliases)', () => {
    const store = { 'url:abc123': { original: 'https://example.com', userId: 'u1', clicks: '0' } };

    it('canonical GET /shorten/:code redirects to original', async () => {
        const res = await request(makeApp(store)).get('/shorten/abc123');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('https://example.com');
    });

    it('legacy root GET /:code redirects (same behavior, port-only change)', async () => {
        const res = await request(makeApp(store)).get('/abc123');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('https://example.com');
    });

    it('unknown code returns 404 page', async () => {
        const res = await request(makeApp(store)).get('/shorten/nope');
        expect(res.status).toBe(404);
        expect(res.text).toContain('URL Não Encontrada');
    });
});
