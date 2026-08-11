import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env';
import { prisma } from './config/database';
import { buildDeps } from './core/deps';
import { createApp, createShortenApp } from './app';
import * as logger from './shared/logger';
import redis from './config/redis';

/**
 * Entry point (docs §8 step 7). Boots the main HTTP server on API_PORT (socket.io
 * attached, modules mounted by prefix) plus a dedicated shorten server on
 * SHORTEN_PORT — shorten stays isolated because its GET /:code catch-all would
 * shadow every other route. Replaces legacy src/index.js + bootstrapServers().
 */
async function bootstrap(): Promise<void> {
    const deps = buildDeps(env, { redis });
    const app = createApp(deps);

    const server = http.createServer(app);
    const io = new SocketServer(server, {
        cors: { origin: env.CORS_ORIGIN, credentials: true },
    });
    app.set('io', io);

    io.on('connection', (socket) => {
        if (!env.DISABLED_LOGS) console.log(logger.success(`Socket connected: ${socket.id}`));
        socket.on('disconnect', () => {
            if (!env.DISABLED_LOGS) console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    server.listen(env.API_PORT, () => {
        if (!env.DISABLED_LOGS) {
            console.log(logger.success('Connection established!'));
            console.log(logger.available(`Server running on port ${env.API_PORT}`));
        }
    });

    // Dedicated shorten server (its GET /:code catch-all must not shadow other routes).
    const shortenServer = http.createServer(createShortenApp(deps));
    shortenServer.listen(env.SHORTEN_PORT, () => {
        if (!env.DISABLED_LOGS) {
            console.log(logger.available(`Shorten server running on port ${env.SHORTEN_PORT}`));
        }
    });

    const shutdown = async (): Promise<void> => {
        server.close();
        shortenServer.close();
        await prisma.$disconnect().catch(() => undefined);
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
    console.error('[Fatal] bootstrap failed:', err);
    process.exit(1);
});
