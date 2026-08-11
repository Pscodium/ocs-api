import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RedisClientType } from 'redis';
import { ShortenService } from './shorten.service';

function makeRedisMock(store: Record<string, Record<string, string>>) {
    return {
        hSet: vi.fn(async (key: string, val: Record<string, string>) => {
            store[key] = { ...val };
        }),
        expire: vi.fn(async () => true),
        hGetAll: vi.fn(async (key: string) => store[key] ?? {}),
        hIncrBy: vi.fn(async (key: string, field: string, by: number) => {
            store[key][field] = String((parseInt(store[key][field], 10) || 0) + by);
            return parseInt(store[key][field], 10);
        }),
        del: vi.fn(async (key: string) => {
            delete store[key];
            return 1;
        }),
        scan: vi.fn(async () => ({ cursor: 0, keys: Object.keys(store) })),
    } as unknown as RedisClientType;
}

describe('ShortenService', () => {
    let store: Record<string, Record<string, string>>;
    let service: ShortenService;

    beforeEach(() => {
        store = {};
        service = new ShortenService({ redis: makeRedisMock(store), baseUrl: 'https://s.test' });
    });

    it('create stores record and returns short url', async () => {
        const { shortUrl, code } = await service.create('https://a.com', 'u1');
        expect(shortUrl).toBe(`https://s.test/${code}`);
        expect(store[`url:${code}`]).toMatchObject({ original: 'https://a.com', userId: 'u1', clicks: '0' });
    });

    it('resolve returns original and increments clicks', async () => {
        const { code } = await service.create('https://a.com', 'u1');
        expect(await service.resolve(code)).toBe('https://a.com');
        expect(store[`url:${code}`].clicks).toBe('1');
    });

    it('resolve returns null for unknown code', async () => {
        expect(await service.resolve('missing')).toBeNull();
    });

    it('listByUser filters by owner and paginates', async () => {
        await service.create('https://a.com', 'u1');
        await service.create('https://b.com', 'u1');
        await service.create('https://c.com', 'u2');
        const page = await service.listByUser('u1', { page: 1, limit: 10 });
        expect(page.totalItems).toBe(2);
        expect(page.data.every((u) => u.original.startsWith('https://'))).toBe(true);
    });

    it('remove enforces ownership', async () => {
        const { code } = await service.create('https://a.com', 'u1');
        expect(await service.remove(code, 'u2')).toBe('forbidden');
        expect(await service.remove(code, 'u1')).toBe('ok');
        expect(await service.remove(code, 'u1')).toBe('not_found');
    });
});
