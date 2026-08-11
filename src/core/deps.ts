import type { RedisClientType } from 'redis';
import type { Env } from '../config/env';

/**
 * Lightweight dependency container injected into modules at registration time
 * (docs/refactor-typescript.md §3.1, §3.4). Keeps modules decoupled from infra
 * and testable.
 *
 * The DB (Prisma) and S3 clients are NOT carried here: repositories import the
 * Prisma singleton (config/database) and the storage module owns its S3 client,
 * so only genuinely cross-cutting infra (config, logger, redis) is injected.
 */
export interface Logger {
    info(msg: string, ...meta: unknown[]): void;
    warn(msg: string, ...meta: unknown[]): void;
    error(msg: string, ...meta: unknown[]): void;
}

export interface AppDeps {
    config: Env;
    logger: Logger;
    /** Redis client (node-redis), used by the shorten module + rate limiting. */
    redis: RedisClientType;
}

const consoleLogger: Logger = {
    info: (msg, ...meta) => console.log(msg, ...meta),
    warn: (msg, ...meta) => console.warn(msg, ...meta),
    error: (msg, ...meta) => console.error(msg, ...meta),
};

/**
 * Builds the dependency container. Callers pass concrete infra as it becomes
 * available; a console-backed logger is the default.
 */
export function buildDeps(
    config: Env,
    infra: { redis: RedisClientType; logger?: Logger },
): AppDeps {
    return {
        config,
        logger: infra.logger ?? consoleLogger,
        redis: infra.redis,
    };
}
