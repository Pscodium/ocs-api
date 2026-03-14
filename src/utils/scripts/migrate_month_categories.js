require('dotenv').config();
const { randomUUID } = require('crypto');
const { Sequelize } = require('sequelize');

const createMonthModel = require('../../database/models/months');
const createMonthCategoryModel = require('../../database/models/monthCategories');
const createMonthBillModel = require('../../database/models/monthBills');

const sequelize = new Sequelize(
    String(process.env.DB_NAME),
    String(process.env.DB_USER),
    String(process.env.DB_PASSWORD),
    {
        host: process.env.DB_HOST,
        port: String(process.env.DB_PORT),
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        connectTimeout: 30000,
        requestTimeout: 30000
    }
);

const db = {
    sequelize,
    Month: createMonthModel(sequelize),
    MonthCategory: createMonthCategoryModel(sequelize),
    MonthBill: createMonthBillModel(sequelize)
};

function parseMonthPayload(rawData) {
    if (!rawData) {
        return {};
    }

    if (typeof rawData === 'string') {
        try {
            return JSON.parse(rawData);
        } catch (error) {
            return {};
        }
    }

    if (typeof rawData === 'object') {
        return rawData;
    }

    return {};
}

function normalizeCategories(categories) {
    if (!Array.isArray(categories)) {
        return [];
    }

    return categories
        .filter((item) => item && typeof item === 'object')
        .map((item, index) => ({
            userId: null,
            month_key: null,
            category_id: randomUUID(),
            legacy_category_id: item.categoryId || item.id || null,
            legacy_name: (item.name || item.categoryName || '').trim().toLowerCase(),
            legacy_index: index,
            name: item.name || item.categoryName || null,
            type: item.type || null,
            split_by: item.splitBy ?? null,
            sort_order: index
        }));
}

function flattenLegacyBills(monthData) {
    if (!monthData || typeof monthData !== 'object') {
        return [];
    }

    const topLevelBills = Array.isArray(monthData.bills) ? monthData.bills : [];
    const categoryBills = Array.isArray(monthData.categories)
        ? monthData.categories.flatMap((category, categoryIndex) => {
            if (!category || typeof category !== 'object' || !Array.isArray(category.bills)) {
                return [];
            }

            return category.bills.map((bill) => ({
                ...bill,
                categoryId: bill?.categoryId || category.categoryId || category.id || null,
                categoryName: bill?.categoryName || bill?.category || category.name || category.categoryName || null,
                __legacyCategoryIndex: categoryIndex,
                __legacyCategoryName: category.name || category.categoryName || null,
                type: bill?.type || category.type || null
            }));
        })
        : [];

    return [...topLevelBills, ...categoryBills].filter((bill) => bill && typeof bill === 'object');
}

function normalizeBills(bills, monthData, categories) {
    const legacyIdToInternalCategoryId = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((category) => category.legacy_category_id)
            .map((category) => [category.legacy_category_id, category.category_id])
    );

    const legacyIdToCategoryType = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((category) => category.legacy_category_id)
            .map((category) => [category.legacy_category_id, category.type])
    );

    const legacyNameToInternalCategoryId = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((category) => category.legacy_name)
            .map((category) => [category.legacy_name, category.category_id])
    );

    const legacyIndexToInternalCategoryId = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((category) => Number.isInteger(category.legacy_index))
            .map((category) => [category.legacy_index, category.category_id])
    );

    const legacyNameToCategoryType = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((category) => category.legacy_name)
            .map((category) => [category.legacy_name, category.type])
    );

    const resolveCategoryId = (billItem) => {
        const legacyCategoryId = billItem.categoryId || billItem.category_id || null;
        if (legacyCategoryId && legacyIdToInternalCategoryId.has(legacyCategoryId)) {
            return legacyIdToInternalCategoryId.get(legacyCategoryId);
        }

        const normalizedCategoryName = String(billItem.categoryName || billItem.category || '').trim().toLowerCase();
        if (normalizedCategoryName && legacyNameToInternalCategoryId.has(normalizedCategoryName)) {
            return legacyNameToInternalCategoryId.get(normalizedCategoryName);
        }

        return null;
    };

    const resolveType = (billItem) => {
        const legacyCategoryId = billItem.categoryId || billItem.category_id || null;
        if (billItem.type) {
            return billItem.type;
        }

        if (legacyCategoryId && legacyIdToCategoryType.has(legacyCategoryId)) {
            return legacyIdToCategoryType.get(legacyCategoryId);
        }

        const normalizedCategoryName = String(billItem.categoryName || billItem.category || '').trim().toLowerCase();
        if (normalizedCategoryName && legacyNameToCategoryType.has(normalizedCategoryName)) {
            return legacyNameToCategoryType.get(normalizedCategoryName);
        }

        return null;
    };

    const sourceBills = Array.isArray(bills) ? bills : flattenLegacyBills(monthData);

    const categoriesByType = new Map();
    (Array.isArray(categories) ? categories : []).forEach((category) => {
        const typeKey = String(category.type || '').trim().toLowerCase();
        if (!typeKey) {
            return;
        }

        if (!categoriesByType.has(typeKey)) {
            categoriesByType.set(typeKey, []);
        }

        categoriesByType.get(typeKey).push(category);
    });

    const syntheticByType = new Map();

    const derivedByNameAndType = new Map();

    const registerCategory = (category) => {
        if (!category || !category.category_id) {
            return;
        }

        const typeKey = String(category.type || '').trim().toLowerCase();
        if (typeKey) {
            if (!categoriesByType.has(typeKey)) {
                categoriesByType.set(typeKey, []);
            }
            categoriesByType.get(typeKey).push(category);
        }

        if (category.legacy_name) {
            legacyNameToInternalCategoryId.set(category.legacy_name, category.category_id);
        }

        if (Number.isInteger(category.legacy_index)) {
            legacyIndexToInternalCategoryId.set(category.legacy_index, category.category_id);
        }
    };

    const ensureSyntheticCategory = (preferredType) => {
        const typeKey = String(preferredType || 'other').trim().toLowerCase() || 'other';
        if (syntheticByType.has(typeKey)) {
            return syntheticByType.get(typeKey);
        }

        const syntheticCategory = {
            userId: null,
            month_key: null,
            category_id: randomUUID(),
            legacy_category_id: null,
            legacy_name: `migrated:${typeKey}`,
            legacy_index: Number.MAX_SAFE_INTEGER,
            name: `Migrado (${typeKey})`,
            type: typeKey,
            split_by: null,
            sort_order: categories.length
        };

        categories.push(syntheticCategory);
        registerCategory(syntheticCategory);
        syntheticByType.set(typeKey, syntheticCategory.category_id);
        return syntheticCategory.category_id;
    };

    const ensureDerivedCategoryFromBill = (billItem, preferredType) => {
        const typeKey = String(preferredType || 'other').trim().toLowerCase() || 'other';
        const nameRaw = billItem.__legacyCategoryName || billItem.categoryName || billItem.category || null;
        const normalizedName = String(nameRaw || '').trim().toLowerCase();

        if (!normalizedName) {
            return ensureSyntheticCategory(typeKey);
        }

        const derivedKey = `${normalizedName}|${typeKey}`;
        if (derivedByNameAndType.has(derivedKey)) {
            return derivedByNameAndType.get(derivedKey);
        }

        const existingId = legacyNameToInternalCategoryId.get(normalizedName);
        if (existingId) {
            derivedByNameAndType.set(derivedKey, existingId);
            return existingId;
        }

        const derivedCategory = {
            userId: null,
            month_key: null,
            category_id: randomUUID(),
            legacy_category_id: null,
            legacy_name: normalizedName,
            legacy_index: Number.MAX_SAFE_INTEGER,
            name: nameRaw,
            type: typeKey,
            split_by: null,
            sort_order: categories.length
        };

        categories.push(derivedCategory);
        registerCategory(derivedCategory);
        derivedByNameAndType.set(derivedKey, derivedCategory.category_id);
        return derivedCategory.category_id;
    };

    const seen = new Set();

    return sourceBills
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
            let categoryId = resolveCategoryId(item);
            const resolvedType = resolveType(item) || null;

            if (!categoryId && Number.isInteger(item.__legacyCategoryIndex) && legacyIndexToInternalCategoryId.has(item.__legacyCategoryIndex)) {
                categoryId = legacyIndexToInternalCategoryId.get(item.__legacyCategoryIndex);
            }

            if (!categoryId) {
                const normalizedLegacyCategoryName = String(item.__legacyCategoryName || '').trim().toLowerCase();
                if (normalizedLegacyCategoryName && legacyNameToInternalCategoryId.has(normalizedLegacyCategoryName)) {
                    categoryId = legacyNameToInternalCategoryId.get(normalizedLegacyCategoryName);
                }
            }

            if (!categoryId && resolvedType) {
                const byType = categoriesByType.get(String(resolvedType).trim().toLowerCase()) || [];
                if (byType.length === 1) {
                    categoryId = byType[0].category_id;
                }
            }

            if (!categoryId && categories.length === 1) {
                categoryId = categories[0].category_id;
            }

            if (!categoryId) {
                categoryId = ensureDerivedCategoryFromBill(item, resolvedType);
            }

            const normalizedName = String(item.name || item.title || '').trim().toLowerCase();
            const normalizedAmount = item.amount ?? item.value ?? null;
            const normalizedDate = item.dueDate || item.date || null;
            const dedupeKey = [item.id || '', categoryId || '', normalizedName, normalizedAmount ?? '', normalizedDate || ''].join('|');

            if (seen.has(dedupeKey)) {
                return null;
            }

            seen.add(dedupeKey);

            return {
                id: randomUUID(),
                userId: null,
                month_key: null,
                category_id: categoryId,
                name: item.name || item.title || null,
                type: resolvedType,
                amount: normalizedAmount,
                due_date: normalizedDate,
                paid: Boolean(item.paid)
            };
        })
        .filter(Boolean);
}

async function run() {
    await db.sequelize.authenticate();
    await db.MonthCategory.sync({ force: false, alter: true, logging: false });
    await db.MonthBill.sync({ force: false, alter: true, logging: false });

    const months = await db.Month.findAll({
        attributes: ['userId', 'month_key', 'data']
    });

    let processedMonths = 0;
    let skippedMonths = 0;
    let migratedCategories = 0;
    let migratedBills = 0;

    for (const month of months) {
        const payload = parseMonthPayload(month.data);
        const categories = normalizeCategories(payload.categories);
        const bills = normalizeBills(payload.bills, payload, categories);

        if (!categories.length && !bills.length) {
            skippedMonths += 1;
            continue;
        }

        await db.sequelize.transaction(async (transaction) => {
            await db.MonthBill.destroy({
                where: {
                    userId: month.userId,
                    month_key: month.month_key
                },
                transaction
            });

            await db.MonthCategory.destroy({
                where: {
                    userId: month.userId,
                    month_key: month.month_key
                },
                transaction
            });

            if (categories.length) {
                const categoryRows = categories.map((category) => ({
                    userId: month.userId,
                    month_key: month.month_key,
                    category_id: category.category_id,
                    name: category.name,
                    type: category.type,
                    split_by: category.split_by,
                    sort_order: category.sort_order
                }));

                await db.MonthCategory.bulkCreate(categoryRows, { transaction });
                migratedCategories += categoryRows.length;
            }

            if (bills.length) {
                const billRows = bills.map((bill) => ({
                    id: bill.id,
                    userId: month.userId,
                    month_key: month.month_key,
                    category_id: bill.category_id,
                    name: bill.name,
                    type: bill.type,
                    amount: bill.amount,
                    due_date: bill.due_date,
                    paid: bill.paid
                }));

                await db.MonthBill.bulkCreate(billRows, { transaction });
                migratedBills += billRows.length;
            }
        });

        processedMonths += 1;
    }

    console.log('Migração concluída');
    console.log(`Meses migrados: ${processedMonths}`);
    console.log(`Meses ignorados: ${skippedMonths}`);
    console.log(`Categorias migradas: ${migratedCategories}`);
    console.log(`Bills migradas: ${migratedBills}`);
}

run()
    .then(async () => {
        await db.sequelize.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('Erro na migração de categorias de mês:', error);
        await db.sequelize.close();
        process.exit(1);
    });
