import { createClient, type RedisClientType } from 'redis';
import { env } from './env';
import * as logger from '../shared/logger';

/**
 * Shared redis client singleton (ported from config/redis.js). Self-connects on
 * import, matching legacy behavior. Consumed via AppDeps.redis and by the
 * feature-flags middleware.
 */
const redis: RedisClientType = createClient({ url: env.REDIS_URL });

redis.on('error', (err) => {
    console.log(logger.alert('❌ Redis error:'), err);
});

async function connectRedis(): Promise<void> {
    if (!redis.isOpen) {
        await redis.connect();
        console.log(logger.success('✅ Redis conectado'));
    }
}

void connectRedis();

export default redis;
