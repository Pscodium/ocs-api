import type { RedisClientType } from 'redis';
import { nanoid } from 'nanoid';
import type { ListUrlsQuery, PaginatedUrls, UrlRecord } from './shorten.dto';

const TTL_12_DAYS = 60 * 60 * 24 * 12;

export interface ShortenServiceOptions {
    redis: RedisClientType;
    baseUrl: string;
}

/**
 * Redis-backed URL shortener. Pure business logic, no HTTP concerns
 * (docs/refactor-typescript.md §3.1). Mirrors the legacy controller semantics.
 */
export class ShortenService {
    private readonly redis: RedisClientType;
    private readonly baseUrl: string;

    constructor({ redis, baseUrl }: ShortenServiceOptions) {
        this.redis = redis;
        this.baseUrl = baseUrl;
    }

    private shortUrl(code: string): string {
        return `${this.baseUrl}/${code}`;
    }

    async create(url: string, userId: string): Promise<{ shortUrl: string; code: string }> {
        const code = nanoid(6);
        await this.redis.hSet(`url:${code}`, {
            original: url,
            clicks: '0',
            userId: String(userId),
            createdAt: String(Date.now()),
        });
        await this.redis.expire(`url:${code}`, TTL_12_DAYS);
        return { shortUrl: this.shortUrl(code), code };
    }

    /** Resolves a code to its original URL, incrementing the click counter. */
    async resolve(code: string): Promise<string | null> {
        const data = await this.redis.hGetAll(`url:${code}`);
        if (!data?.original) return null;
        await this.redis.hIncrBy(`url:${code}`, 'clicks', 1);
        return data.original;
    }

    async listByUser(userId: string, { page, limit }: ListUrlsQuery): Promise<PaginatedUrls> {
        const urls: UrlRecord[] = [];
        let cursor = '0';

        do {
            const result = await this.redis.scan(cursor, { MATCH: 'url:*', COUNT: 100 });
            cursor = String(result.cursor);
            for (const key of result.keys) {
                const data = await this.redis.hGetAll(key);
                if (data?.userId === String(userId)) {
                    const code = key.replace('url:', '');
                    urls.push({
                        code,
                        original: data.original,
                        shortUrl: this.shortUrl(code),
                        clicks: parseInt(data.clicks, 10) || 0,
                        createdAt: parseInt(data.createdAt, 10),
                    });
                }
            }
        } while (cursor !== '0');

        urls.sort((a, b) => b.createdAt - a.createdAt);

        const totalItems = urls.length;
        const totalPages = Math.ceil(totalItems / limit);
        const skip = (page - 1) * limit;
        return { data: urls.slice(skip, skip + limit), page, totalPages, totalItems };
    }

    /** Removes a user's short URL. Returns 'ok' | 'not_found' | 'forbidden'. */
    async remove(code: string, userId: string): Promise<'ok' | 'not_found' | 'forbidden'> {
        const key = `url:${code}`;
        const data = await this.redis.hGetAll(key);
        if (!data?.original) return 'not_found';
        if (data.userId !== String(userId)) return 'forbidden';
        await this.redis.del(key);
        return 'ok';
    }
}
