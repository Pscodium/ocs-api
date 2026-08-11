import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env';
import { prisma } from './config/database';
import { buildDeps } from './core/deps';
import { createApp } from './app';
import * as logger from './shared/logger';
import redis from './config/redis';

/**
 * Single entry point (docs §8 step 7). Boots ONE HTTP server on API_PORT with
 * socket.io attached and every module mounted by prefix. Replaces the legacy
 * src/index.js + bootstrapServers() topology (4 apps / 4 ports → 1 app / 1 port).
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
            console.log(logger.available(`Server running on port ${env.API_PORT} (single-port mode)`));
        }
    });

    const shutdown = async (): Promise<void> => {
        server.close();
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
