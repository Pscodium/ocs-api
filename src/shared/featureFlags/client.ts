import redis from '../../config/redis';

/**
 * SHARED feature-flags API client — service-agnostic. Talks to the remote flag
 * service with a Redis identity cache + in-flight dedup, keyed by identity
 * identifier (typically the user's plan). Reusable by any module (financial,
 * finder, …). Reads process.env directly (import-safe). Logic preserved verbatim.
 */
const featureFlagsApiUrl = process.env.FEATURE_FLAGS_API_URL || 'http://localhost:8000/api/v1/';
const featureFlagsEnvironmentKey = process.env.FEATURE_FLAGS_ENVIRONMENT_KEY;
const featureFlagsCacheTtlSeconds = parseInt(process.env.FEATURE_FLAGS_CACHE_TTL_SECONDS || '60', 10);
const featureFlagsCachePrefix = process.env.FEATURE_FLAGS_CACHE_PREFIX || 'feature-flags:identity:';

interface Flag {
    feature: { name: string };
    enabled: boolean;
    feature_state_value: unknown;
}
interface Trait {
    trait_key: string;
    trait_value: unknown;
}
export interface Identity {
    flags?: Flag[];
    traits?: Trait[];
}

const inFlightIdentityRequests = new Map<string, Promise<Identity | undefined>>();

if (!featureFlagsEnvironmentKey) {
    console.warn('FEATURE_FLAGS_ENVIRONMENT_KEY nao foi configurada no .env');
}

function getIdentityCacheKey(identifier: string): string {
    return `${featureFlagsCachePrefix}${identifier}`;
}

export async function makeApiRequest(
    endpoint: string,
    method = 'GET',
    body: unknown = null,
): Promise<unknown> {
    try {
        const url = `${featureFlagsApiUrl}${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                'X-Environment-Key': featureFlagsEnvironmentKey ?? '',
                'Content-Type': 'application/json',
            },
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erro na requisicao para a API de feature flags:', error);
        throw error;
    }
}

export async function getIdentity(identifier: string): Promise<Identity | undefined> {
    const cacheKey = getIdentityCacheKey(identifier);

    try {
        const cachedIdentity = await redis.get(cacheKey);
        if (cachedIdentity) return JSON.parse(cachedIdentity) as Identity;
    } catch (error) {
        console.warn(`Aviso: falha ao ler cache Redis para ${identifier}:`, (error as Error).message);
    }

    const existing = inFlightIdentityRequests.get(cacheKey);
    if (existing) return existing;

    const identityPromise = (async (): Promise<Identity | undefined> => {
        try {
            const data = await makeApiRequest(`identities?identifier=${identifier}`);
            const identity = (Array.isArray(data) ? data[0] : data) as Identity | undefined;

            if (identity && featureFlagsCacheTtlSeconds > 0) {
                try {
                    await redis.setEx(cacheKey, featureFlagsCacheTtlSeconds, JSON.stringify(identity));
                } catch (error) {
                    console.warn(`Aviso: falha ao salvar cache Redis para ${identifier}:`, (error as Error).message);
                }
            }
            return identity;
        } catch (error) {
            console.error('Erro ao buscar identity da API de feature flags:', error);
            throw error;
        } finally {
            inFlightIdentityRequests.delete(cacheKey);
        }
    })();

    inFlightIdentityRequests.set(cacheKey, identityPromise);
    return identityPromise;
}

export async function invalidateIdentityCache(identifier: string): Promise<void> {
    try {
        await redis.del(getIdentityCacheKey(identifier));
    } catch (error) {
        console.warn(`Aviso: falha ao invalidar cache Redis para ${identifier}:`, (error as Error).message);
    }
}

export async function hasFeature(identifier: string, featureName: string): Promise<boolean> {
    try {
        const identity = await getIdentity(identifier);
        if (!identity || !identity.flags) return false;
        const flag = identity.flags.find((f) => f.feature.name === featureName);
        return flag ? flag.enabled : false;
    } catch (error) {
        console.error(`Erro ao verificar feature ${featureName}:`, error);
        return false;
    }
}

export async function getTrait(identifier: string, traitKey: string): Promise<unknown> {
    try {
        const identity = await getIdentity(identifier);
        if (!identity || !identity.traits) return null;
        const trait = identity.traits.find((t) => t.trait_key === traitKey);
        return trait ? trait.trait_value : null;
    } catch (error) {
        console.error(`Erro ao buscar trait ${traitKey}:`, error);
        return null;
    }
}

export async function getFeatureValue(identifier: string, featureName: string): Promise<unknown> {
    try {
        const identity = await getIdentity(identifier);
        if (!identity || !identity.flags) return null;
        const flag = identity.flags.find((f) => f.feature.name === featureName);
        return flag ? flag.feature_state_value : null;
    } catch (error) {
        console.error(`Erro ao buscar valor da feature ${featureName}:`, error);
        return null;
    }
}

export async function getAllFeaturesAndTraits(
    identifier: string,
): Promise<{ flags: Flag[]; traits: Trait[] }> {
    try {
        const identity = await getIdentity(identifier);
        if (!identity) return { flags: [], traits: [] };
        return { flags: identity.flags || [], traits: identity.traits || [] };
    } catch (error) {
        console.error('Erro ao buscar todas as features:', error);
        return { flags: [], traits: [] };
    }
}
