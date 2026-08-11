import 'dotenv/config';
import { z } from 'zod';

/**
 * Typed, validated environment. Fails fast at boot when required vars are missing.
 * Port vars for the per-module servers (SHORTEN_PORT/FINANCIAL_PORT/PRODUCT_FINDER_PORT)
 * are intentionally NOT modeled here — they go away when the app is consolidated onto a
 * single port (see docs/refactor-typescript.md §3, §8 step 7).
 */
const csv = (raw?: string): string[] =>
    raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    API_PORT: z.coerce.number().int().positive(),

    CORS_ORIGIN: z.string().optional().transform(csv),
    DISABLED_LOGS: z
        .string()
        .optional()
        .transform((v) => v === 'true' || v === '1'),

    // Database
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().default(''),
    /** Optional explicit Prisma connection string; composed from DB_* when absent. */
    DATABASE_URL: z.string().optional(),

    // Auth (JWT via jose / JWKS)
    AUTH_ISSUER: z.string().url().optional(),
    AUTH_AUDIENCE: z.string().optional(),
    AUTH_JWKS_URL: z.string().url().optional(),

    // Redis
    REDIS_URL: z.string().optional(),

    // Feature flags
    FEATURE_FLAGS_API_URL: z.string().url().optional(),
    FEATURE_FLAGS_API_KEY: z.string().optional(),
    FEATURE_FLAGS_ENVIRONMENT_ID: z.string().optional(),
    FEATURE_FLAGS_ENVIRONMENT_KEY: z.string().optional(),
    FEATURE_FLAGS_CACHE_PREFIX: z.string().optional(),
    FEATURE_FLAGS_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().optional(),

    // Storage (S3-compatible)
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_REGION: z.string().optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_PATH: z.string().optional(),
    STORAGE_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().optional(),

    // Shorten
    SHORTEN_BASE_URL: z.string().optional(),

    // Finder
    FINDER_API_KEY: z.string().optional(),
    FINDER_ENABLE_ALL_CORS: z
        .string()
        .optional()
        .transform((v) => v === 'true' || v === '1'),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('\n');
        throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    return parsed.data;
}

export const env = load();

/**
 * Prisma connection string. Uses DATABASE_URL when provided, otherwise composes
 * a mysql:// URL from the discrete DB_* vars so a single source of truth stays in
 * the existing .env (docs/refactor-typescript.md §6).
 */
export function databaseUrl(e: Env = env): string {
    if (e.DATABASE_URL) return e.DATABASE_URL;
    const pass = encodeURIComponent(e.DB_PASSWORD);
    return `mysql://${e.DB_USER}:${pass}@${e.DB_HOST}:${e.DB_PORT}/${e.DB_NAME}`;
}
