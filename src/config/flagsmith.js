require('dotenv').config();
const redis = require('./redis');

const flagsmithApiUrl = process.env.FLAGSMITH_API_URL || 'http://localhost:8000/api/v1/';
const flagsmithEnvironmentKey = process.env.FLAGSMITH_ENVIRONMENT_KEY;
const flagsmithCacheTtlSeconds = parseInt(process.env.FLAGSMITH_CACHE_TTL_SECONDS || '60', 10);
const flagsmithCachePrefix = process.env.FLAGSMITH_CACHE_PREFIX || 'flagsmith:identity:';
const inFlightIdentityRequests = new Map();

if (!flagsmithEnvironmentKey) {
    console.warn('⚠️  FLAGSMITH_ENVIRONMENT_KEY não foi configurada no .env');
}

function getIdentityCacheKey(identifier) {
    return `${flagsmithCachePrefix}${identifier}`;
}

/**
 * Make a request to Flagsmith API
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {Object} body - Request body
 * @returns {Promise<Object>} - Response data
 */
async function makeApiRequest(endpoint, method = 'GET', body = null) {
    try {
        const url = `${flagsmithApiUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'X-Environment-Key': flagsmithEnvironmentKey,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Erro na requisição para Flagsmith:`, error);
        throw error;
    }
}

/**
 * Get identity with flags and traits
 * @param {string} identifier - Identity identifier (e.g., 'free_plan', 'premium_plan', 'ultimate_plan')
 * @returns {Promise<Object>} - Identity data with flags and traits
 */
async function getIdentity(identifier) {
    const cacheKey = getIdentityCacheKey(identifier);

    try {
        const cachedIdentity = await redis.get(cacheKey);

        if (cachedIdentity) {
            return JSON.parse(cachedIdentity);
        }
    } catch (error) {
        console.warn(`Aviso: falha ao ler cache Redis para ${identifier}:`, error.message);
    }

    if (inFlightIdentityRequests.has(cacheKey)) {
        return inFlightIdentityRequests.get(cacheKey);
    }

    const identityPromise = (async () => {
        try {
            const data = await makeApiRequest(`identities/?identifier=${identifier}`);
            const identity = Array.isArray(data) ? data[0] : data;

            if (identity && flagsmithCacheTtlSeconds > 0) {
                try {
                    await redis.setEx(cacheKey, flagsmithCacheTtlSeconds, JSON.stringify(identity));
                } catch (error) {
                    console.warn(`Aviso: falha ao salvar cache Redis para ${identifier}:`, error.message);
                }
            }

            return identity;
        } catch (error) {
            console.error('Erro ao buscar identity do Flagsmith:', error);
            throw error;
        } finally {
            inFlightIdentityRequests.delete(cacheKey);
        }
    })();

    inFlightIdentityRequests.set(cacheKey, identityPromise);
    return identityPromise;
}

/**
 * Remove identity from cache
 * @param {string} identifier - Identity identifier
 */
async function invalidateIdentityCache(identifier) {
    try {
        await redis.del(getIdentityCacheKey(identifier));
    } catch (error) {
        console.warn(`Aviso: falha ao invalidar cache Redis para ${identifier}:`, error.message);
    }
}

/**
 * Check if a feature is enabled for an identity
 * @param {string} identifier - Identity identifier
 * @param {string} featureName - Feature name
 * @returns {Promise<boolean>} - Whether the feature is enabled
 */
async function hasFeature(identifier, featureName) {
    try {
        const identity = await getIdentity(identifier);
        
        if (!identity || !identity.flags) {
            return false;
        }

        const flag = identity.flags.find(f => f.feature.name === featureName);
        return flag ? flag.enabled : false;
    } catch (error) {
        console.error(`Erro ao verificar feature ${featureName}:`, error);
        return false;
    }
}

/**
 * Get a trait value for an identity
 * @param {string} identifier - Identity identifier
 * @param {string} traitKey - Trait key
 * @returns {Promise<any>} - Trait value
 */
async function getTrait(identifier, traitKey) {
    try {
        const identity = await getIdentity(identifier);
        
        if (!identity || !identity.traits) {
            return null;
        }

        const trait = identity.traits.find(t => t.trait_key === traitKey);
        return trait ? trait.trait_value : null;
    } catch (error) {
        console.error(`Erro ao buscar trait ${traitKey}:`, error);
        return null;
    }
}

/**
 * Get feature value for an identity
 * @param {string} identifier - Identity identifier
 * @param {string} featureName - Feature name
 * @returns {Promise<any>} - Feature value
 */
async function getFeatureValue(identifier, featureName) {
    try {
        const identity = await getIdentity(identifier);
        
        if (!identity || !identity.flags) {
            return null;
        }

        const flag = identity.flags.find(f => f.feature.name === featureName);
        return flag ? flag.feature_state_value : null;
    } catch (error) {
        console.error(`Erro ao buscar valor da feature ${featureName}:`, error);
        return null;
    }
}

/**
 * Get all features for an identity
 * @param {string} identifier - Identity identifier
 * @returns {Promise<Object>} - All flags and traits
 */
async function getAllFeaturesAndTraits(identifier) {
    try {
        const identity = await getIdentity(identifier);
        
        if (!identity) {
            return { flags: [], traits: [] };
        }

        return {
            flags: identity.flags || [],
            traits: identity.traits || []
        };
    } catch (error) {
        console.error(`Erro ao buscar todas as features:`, error);
        return { flags: [], traits: [] };
    }
}

module.exports = {
    getIdentity,
    hasFeature,
    getTrait,
    getFeatureValue,
    getAllFeaturesAndTraits,
    makeApiRequest,
    invalidateIdentityCache
};
