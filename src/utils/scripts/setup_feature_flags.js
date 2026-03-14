/**
 * Script para configurar as identities e traits no sistema de feature flags
 *
 * USO:
 * 1. Configure as variaveis FEATURE_FLAGS_API_URL e FEATURE_FLAGS_API_KEY
 * 2. Execute: node src/utils/scripts/setup_feature_flags.js
 */

require('dotenv').config();

const FEATURE_FLAGS_API_URL = process.env.FEATURE_FLAGS_API_URL || 'http://localhost:8000/api/v1';
const FEATURE_FLAGS_API_KEY = process.env.FEATURE_FLAGS_API_KEY;
const FEATURE_FLAGS_ENVIRONMENT_ID = process.env.FEATURE_FLAGS_ENVIRONMENT_ID;

if (!FEATURE_FLAGS_API_KEY || !FEATURE_FLAGS_ENVIRONMENT_ID) {
    console.error('FEATURE_FLAGS_API_KEY e FEATURE_FLAGS_ENVIRONMENT_ID sao obrigatorios no .env');
    process.exit(1);
}

const PLANS = {
    free_plan: {
        identifier: 'free_plan',
        features: {
            financial_months: true,
            financial_budgets: true,
            financial_investments: false,
            financial_goals: false,
            financial_subscriptions: false
        },
        traits: {
            months_create_limit: '3',
            budgets_create_limit: '10',
            budgets_update_limit: '30',
            budgets_delete_limit: '10'
        }
    },
    premium_plan: {
        identifier: 'premium_plan',
        features: {
            financial_months: true,
            financial_budgets: true,
            financial_investments: true,
            financial_goals: true,
            financial_subscriptions: false
        },
        traits: {
            months_create_limit: '12',
            budgets_create_limit: '50',
            budgets_update_limit: '200',
            budgets_delete_limit: '50',
            investments_create_limit: '20',
            investments_update_limit: '100',
            investments_delete_limit: '20',
            goals_create_limit: '10',
            goals_update_limit: '50',
            goals_delete_limit: '10'
        }
    },
    ultimate_plan: {
        identifier: 'ultimate_plan',
        features: {
            financial_months: true,
            financial_budgets: true,
            financial_investments: true,
            financial_goals: true,
            financial_subscriptions: true
        },
        traits: {
            months_create_limit: '9999',
            budgets_create_limit: '9999',
            budgets_update_limit: '9999',
            budgets_delete_limit: '9999',
            investments_create_limit: '9999',
            investments_update_limit: '9999',
            investments_delete_limit: '9999',
            goals_create_limit: '9999',
            goals_update_limit: '9999',
            goals_delete_limit: '9999',
            subscriptions_create_limit: '9999',
            subscriptions_update_limit: '9999',
            subscriptions_delete_limit: '9999'
        }
    }
};

async function makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${FEATURE_FLAGS_API_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            Authorization: `Token ${FEATURE_FLAGS_API_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return response.json();
}

async function getFeatures() {
    console.log('Buscando features existentes...');
    const features = await makeRequest(`/features/?environment=${FEATURE_FLAGS_ENVIRONMENT_ID}`);
    return features;
}

async function createOrGetIdentity(identifier) {
    console.log(`Verificando identity: ${identifier}...`);
    try {
        const identities = await makeRequest(`/environments/${FEATURE_FLAGS_ENVIRONMENT_ID}/identities/`);
        const existing = identities.results.find(i => i.identifier === identifier);

        if (existing) {
            console.log(`Identity ${identifier} ja existe (ID: ${existing.id})`);
            return existing;
        }

        console.log(`Criando identity: ${identifier}...`);
        const identity = await makeRequest(
            `/environments/${FEATURE_FLAGS_ENVIRONMENT_ID}/identities/`,
            'POST',
            { identifier }
        );
        console.log(`Identity ${identifier} criada (ID: ${identity.id})`);
        return identity;
    } catch (error) {
        console.error(`Erro ao criar/obter identity ${identifier}:`, error.message);
        throw error;
    }
}

async function updateIdentityFeatures(identity, features, allFeatures) {
    console.log(`Configurando features para ${identity.identifier}...`);

    for (const [featureName, enabled] of Object.entries(features)) {
        const feature = allFeatures.find(f => f.name === featureName);

        if (!feature) {
            console.warn(`Feature ${featureName} nao encontrada, pulando...`);
            continue;
        }

        try {
            const featureStates = await makeRequest(
                `/environments/${FEATURE_FLAGS_ENVIRONMENT_ID}/identities/${identity.id}/featurestates/`
            );

            const featureState = featureStates.find(fs => fs.feature.id === feature.id);

            if (featureState) {
                await makeRequest(
                    `/environments/${FEATURE_FLAGS_ENVIRONMENT_ID}/featurestates/${featureState.id}/`,
                    'PATCH',
                    { enabled }
                );
                console.log(`Feature ${featureName}: ${enabled ? 'habilitada' : 'desabilitada'}`);
            }
        } catch (error) {
            console.error(`Erro ao configurar feature ${featureName}:`, error.message);
        }
    }
}

async function updateIdentityTraits(identity, traits) {
    console.log(`Configurando traits para ${identity.identifier}...`);

    for (const [traitKey, traitValue] of Object.entries(traits)) {
        try {
            await makeRequest(
                `/environments/${FEATURE_FLAGS_ENVIRONMENT_ID}/identities/${identity.id}/traits/`,
                'POST',
                {
                    trait_key: traitKey,
                    trait_value: traitValue
                }
            );
            console.log(`Trait ${traitKey}: ${traitValue}`);
        } catch (error) {
            try {
                const traitsList = await makeRequest(
                    `/environments/${FEATURE_FLAGS_ENVIRONMENT_ID}/identities/${identity.id}/traits/`
                );
                const existing = traitsList.find(t => t.trait_key === traitKey);

                if (existing) {
                    await makeRequest(
                        `/environments/${FEATURE_FLAGS_ENVIRONMENT_ID}/identities/${identity.id}/traits/${existing.id}/`,
                        'PUT',
                        {
                            trait_key: traitKey,
                            trait_value: traitValue
                        }
                    );
                    console.log(`Trait ${traitKey}: ${traitValue} (atualizado)`);
                }
            } catch (updateError) {
                console.error(`Erro ao configurar trait ${traitKey}:`, updateError.message);
            }
        }
    }
}

async function setupFeatureFlags() {
    console.log('Iniciando configuracao do sistema de feature flags...\n');

    try {
        const allFeatures = await getFeatures();
        console.log(`${allFeatures.length} features encontradas\n`);

        for (const [planKey, planConfig] of Object.entries(PLANS)) {
            console.log(`\nConfigurando plano: ${planKey}`);
            console.log('-'.repeat(50));

            const identity = await createOrGetIdentity(planConfig.identifier);
            await updateIdentityFeatures(identity, planConfig.features, allFeatures);
            await updateIdentityTraits(identity, planConfig.traits);

            console.log(`Plano ${planKey} configurado com sucesso\n`);
        }

        console.log('\nConfiguracao concluida com sucesso');
        console.log('\nProximos passos:');
        console.log('1. Configure FEATURE_FLAGS_ENVIRONMENT_KEY no .env');
        console.log('2. Certifique-se de que os JWT tokens contem o campo "plan"');
        console.log('3. Teste as rotas financeiras com diferentes planos');
    } catch (error) {
        console.error('\nErro durante a configuracao:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    setupFeatureFlags();
}

module.exports = { setupFeatureFlags };