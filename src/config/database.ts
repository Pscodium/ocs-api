import { PrismaClient } from '@prisma/client';

/**
 * Typed Prisma client singleton (docs §3.1: one shared DB instance). ORM = Prisma.
 *
 * Reads process.env directly (NOT the validated env singleton) so importing this
 * module — pulled in transitively by repositories — stays side-effect free and
 * test-importable. PrismaClient does not connect until the first query.
 */
function resolveDatabaseUrl(): string {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const host = process.env.DB_HOST ?? 'localhost';
    const port = process.env.DB_PORT ?? '3306';
    const name = process.env.DB_NAME ?? '';
    const user = process.env.DB_USER ?? 'root';
    const pass = encodeURIComponent(process.env.DB_PASSWORD ?? '');
    return `mysql://${user}:${pass}@${host}:${port}/${name}`;
}

export const prisma = new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.DISABLED_LOGS ? [] : ['warn', 'error'],
});

export type Database = typeof prisma;

export async function connectDatabase(): Promise<void> {
    await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
}
