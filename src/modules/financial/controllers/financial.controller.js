const db = require('../../../config/sequelize');
const { randomUUID } = require('crypto');
const { getIdentity } = require('../../../config/featureFlags');
const {
    serializeCategoriesFromRows,
    serializeBillsFromRows
} = require('../dtos/month.dto');

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
            category_id: item.categoryId || item.id || randomUUID(),
            legacy_category_id: item.categoryId || item.id || null,
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
        ? monthData.categories.flatMap((category) => {
            if (!category || typeof category !== 'object' || !Array.isArray(category.bills)) {
                return [];
            }

            return category.bills.map((bill) => ({
                ...bill,
                categoryId: bill?.categoryId || category.categoryId || category.id || null,
                type: bill?.type || category.type || null
            }));
        })
        : [];

    return [...topLevelBills, ...categoryBills].filter((bill) => bill && typeof bill === 'object');
}

function normalizeBills(bills, monthData, categories) {
    const legacyToInternalCategoryId = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((category) => category.legacy_category_id)
            .map((category) => [category.legacy_category_id, category.category_id])
    );

    const legacyCategoryType = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((category) => category.legacy_category_id)
            .map((category) => [category.legacy_category_id, category.type])
    );

    const sourceBills = Array.isArray(bills) ? bills : flattenLegacyBills(monthData);
    const sortCounterByCategory = new Map();

    return sourceBills
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
            const categoryId = legacyToInternalCategoryId.get(item.categoryId || item.category_id || null) || null;
            const counterKey = categoryId || '__unassigned__';
            const currentSort = sortCounterByCategory.get(counterKey) || 0;
            sortCounterByCategory.set(counterKey, currentSort + 1);

            return {
                id: item.id || randomUUID(),
                category_id: categoryId,
                name: item.name || item.title || null,
                type: item.type || legacyCategoryType.get(item.categoryId || item.category_id || null) || null,
                amount: item.amount ?? item.value ?? null,
                due_date: item.dueDate || item.date || null,
                paid: Boolean(item.paid),
                sort_order: currentSort
            };
        });
}

function hasBillsWithoutCategory(bills) {
    return Array.isArray(bills) && bills.some((bill) => !bill.category_id);
}

async function replaceMonthCategories({ userId, monthKey, categories, transaction }) {
    await db.MonthCategory.destroy({
        where: {
            userId: userId,
            month_key: monthKey
        },
        transaction
    });

    if (!categories.length) {
        return;
    }

    const rows = categories.map((category) => ({
        userId: userId,
        month_key: monthKey,
        category_id: category.category_id,
        name: category.name,
        type: category.type,
        split_by: category.split_by,
        sort_order: category.sort_order
    }));

    await db.MonthCategory.bulkCreate(rows, { transaction });
}

async function replaceMonthBills({ userId, monthKey, bills, transaction }) {
    await db.MonthBill.destroy({
        where: {
            userId: userId,
            month_key: monthKey
        },
        transaction
    });

    if (!bills.length) {
        return;
    }

    const rows = bills.map((bill) => ({
        id: bill.id,
        userId: userId,
        month_key: monthKey,
        category_id: bill.category_id,
        name: bill.name,
        type: bill.type,
        amount: bill.amount,
        due_date: bill.due_date,
        paid: bill.paid,
        sort_order: bill.sort_order
    }));

    await db.MonthBill.bulkCreate(rows, { transaction });
}

function composeCategoriesWithBills(categories, bills, legacyCategories) {
    const normalizedCategories = Array.isArray(categories) ? categories : [];
    const normalizedBills = serializeBillsFromRows(Array.isArray(bills) ? bills : []);
    const legacy = Array.isArray(legacyCategories) ? legacyCategories : [];

    const billsByCategoryId = new Map();
    normalizedBills.forEach((bill) => {
        const categoryId = bill.categoryId || bill.category_id;
        if (!categoryId) {
            return;
        }

        if (!billsByCategoryId.has(categoryId)) {
            billsByCategoryId.set(categoryId, []);
        }

        billsByCategoryId.get(categoryId).push(bill);
    });

    if (normalizedCategories.length > 0) {
        return normalizedCategories.map((category, index) => {
            const categoryId = category.id || category.categoryId || category.category_id;
            const sortOrder = category.sortOrder ?? category.sort_order ?? index;
            const payload = {
                id: categoryId,
                name: category.name || category.categoryName || null,
                type: category.type || null,
                sortOrder,
                bills: categoryId ? (billsByCategoryId.get(categoryId) || []) : []
            };

            const splitBy = category.splitBy ?? category.split_by;
            if (splitBy !== null && splitBy !== undefined) {
                payload.splitBy = splitBy;
            }

            return payload;
        });
    }

    if (legacy.length > 0) {
        return legacy.map((category, index) => {
            const categoryId = category?.id || category?.categoryId;
            return {
                ...category,
                sortOrder: category?.sortOrder ?? index,
                bills: categoryId
                    ? (billsByCategoryId.get(categoryId) || serializeBillsFromRows(category.bills || []))
                    : serializeBillsFromRows(category.bills || [])
            };
        });
    }

    return [];
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.createMonth = async function(req, res) {
    try {
        const userId = req.userId
        const monthData = req.body;
        const normalizedCategories = normalizeCategories(monthData.categories);
        const normalizedBills = normalizeBills(monthData.bills, monthData, normalizedCategories);

        if (hasBillsWithoutCategory(normalizedBills)) {
            return res.status(400).json({ error: 'Todo bill deve estar associado a uma categoria válida' });
        }

        if (!monthData.monthKey) {
            return res.status(400).json({ error: 'monthKey é obrigatório' });
        }

        // Validar formato monthKey (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(monthData.monthKey)) {
            return res.status(400).json({ error: 'monthKey deve estar no formato YYYY-MM' });
        }

        const existing = await db.Month.findOne({
            where: {
                userId: userId,
                month_key: monthData.monthKey
            }
        });

        if (existing) {
            return res.status(204).json({ message: 'Mês já existe' });
        }

        const month = await db.sequelize.transaction(async (transaction) => {
            const created = await db.Month.create({
                month_key: monthData.monthKey,
                userId: userId
            }, { transaction });

            await replaceMonthCategories({
                userId,
                monthKey: monthData.monthKey,
                categories: normalizedCategories,
                transaction
            });

            await replaceMonthBills({
                userId,
                monthKey: monthData.monthKey,
                bills: normalizedBills,
                transaction
            });

            return created;
        });

        const responseCategories = composeCategoriesWithBills(
            serializeCategoriesFromRows(normalizedCategories),
            normalizedBills.map((bill) => ({
                id: bill.id,
                categoryId: bill.category_id,
                name: bill.name,
                type: bill.type,
                amount: bill.amount,
                dueDate: bill.due_date,
                paid: bill.paid
            })),
            monthData.categories
        );

        return res.status(201).json({
            monthKey: month.month_key,
            categories: responseCategories
        });
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.getMonths = async function(req, res) {
    try {
        const userId = req.userId

        const [results] = await db.sequelize.query(
            `SELECT
                M.*,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', C.CATEGORYID,
                    'categoryId', C.CATEGORYID,
                    'name', C.NAME,
                    'type', C.TYPE,
                    'splitBy', C.SPLITBY,
                    'sortOrder', C.SORTORDER
                    ))
                    FROM month_categories C
                    WHERE C.MONTHKEY = M.MONTHKEY AND C.USERID = M.USERID
                    ORDER BY C.SORTORDER ASC
                ) AS categories,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', MB.ID,
                    'categoryId', MB.CATEGORYID,
                    'name', MB.NAME,
                    'type', MB.TYPE,
                    'amount', MB.AMOUNT,
                    'dueDate', MB.DUEDATE,
                    'paid', MB.PAID,
                    'sortOrder', MB.SORTORDER
                    ))
                    FROM month_bills MB
                    WHERE MB.MONTHKEY = M.MONTHKEY AND MB.USERID = M.USERID
                    ORDER BY MB.SORTORDER ASC
                ) AS bills,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', B.ID,
                    'categoryId', B.CATEGORYID,
                    'categoryName', B.CATEGORYNAME,
                    'limit', B.LIMIT,
                    'spent', B.SPENT,
                    'monthKey', B.MONTHKEY
                    ))
                    FROM budgets B
                    WHERE B.MONTHKEY = M.MONTHKEY AND B.USERID = M.USERID
                ) AS budgets,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', I.ID,
                    'name', I.NAME,
                    'type', I.TYPE,
                    'amount', I.AMOUNT,
                    'purchaseDate', I.PURCHASEDATE,
                    'currentValue', I.CURRENTVALUE,
                    'notes', I.NOTES
                    ))
                    FROM investments I
                    WHERE I.MONTHKEY = M.MONTHKEY AND I.USERID = M.USERID
                ) AS investments,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', G.ID,
                    'name', G.NAME,
                    'targetAmount', G.TARGETAMOUNT,
                    'currentAmount', G.CURRENTAMOUNT,
                    'deadline', G.DEADLINE,
                    'category', G.CATEGORY
                    ))
                    FROM goals G
                    WHERE G.MONTHKEY = M.MONTHKEY AND G.USERID = M.USERID
                ) AS goals,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', S.ID,
                    'name', S.NAME,
                    'amount', S.AMOUNT,
                    'billingCycle', S.BILLINGCYCLE,
                    'nextBillingDate', S.NEXTBILLINGDATE,
                    'category', S.CATEGORY,
                    'active', S.ACTIVE,
                    'notes', S.NOTES
                    ))
                    FROM subscriptions S
                    WHERE S.USERID = M.USERID
                ) AS subscriptions
                FROM month M
                WHERE M.USERID = :userId
                ORDER BY M.MONTHKEY DESC;`,
            { replacements: { userId: userId } }
        )

        if (results.length === 0) {
            return res.status(200).json([]);
        }

        const months = results.map(row => {
            const parsedData = parseMonthPayload(row.data);
            const parsedCategories = parseMonthPayload(row.categories);
            const parsedBills = parseMonthPayload(row.bills);
            const { bills: _legacyBills, ...monthBasePayload } = parsedData;

            return {
                ...monthBasePayload,
                monthKey: row.monthKey || row.MONTHKEY || row.monthkey || parsedData.monthKey,
                categories: composeCategoriesWithBills(
                    Array.isArray(parsedCategories) ? parsedCategories : [],
                    Array.isArray(parsedBills) ? parsedBills : (parsedData.bills || flattenLegacyBills(parsedData)),
                    parsedData.categories || []
                ),
                budgets: row.budgets,
                investments: row.investments,
                goals: row.goals,
                subscriptions: row.subscriptions
            };
        });

        return res.json(months);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.updateMonth = async function(req, res) {
    try {
        const userId = req.userId
        const { monthKey } = req.params
        const monthData = req.body;
        const hasCategoriesPayload = Array.isArray(monthData.categories);
        const hasBillsPayload = Array.isArray(monthData.bills) || (Array.isArray(monthData.categories) && monthData.categories.some((item) => Array.isArray(item?.bills)));
        const normalizedCategories = normalizeCategories(monthData.categories);
        const normalizedBills = normalizeBills(monthData.bills, monthData, normalizedCategories);

        if (hasBillsPayload && hasBillsWithoutCategory(normalizedBills)) {
            return res.status(400).json({ error: 'Todo bill deve estar associado a uma categoria válida' });
        }

        const month = await db.Month.findOne({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        if (!month) {
            return res.status(404).json({ error: 'Mês não encontrado' });
        }

        if (hasCategoriesPayload) {
            await db.sequelize.transaction(async (transaction) => {
                await replaceMonthCategories({
                    userId,
                    monthKey,
                    categories: normalizedCategories,
                    transaction
                });
            });
        }

        if (hasBillsPayload) {
            await db.sequelize.transaction(async (transaction) => {
                await replaceMonthBills({
                    userId,
                    monthKey,
                    bills: normalizedBills,
                    transaction
                });
            });
        }

        const categories = await db.MonthCategory.findAll({
            where: {
                userId: userId,
                month_key: monthKey
            },
            order: [['sort_order', 'ASC'], ['createdAt', 'ASC']]
        });
        const bills = await db.MonthBill.findAll({
            where: {
                userId: userId,
                month_key: monthKey
            },
            order: [['category_id', 'ASC'], ['sort_order', 'ASC'], ['createdAt', 'ASC']]
        });

        const legacyPayload = parseMonthPayload(month.data);
        const { bills: _legacyBills, ...monthBasePayload } = legacyPayload;
        const categoriesPayload = serializeCategoriesFromRows(categories);
        const billsPayload = serializeBillsFromRows(bills);

        return res.json({
            ...monthBasePayload,
            monthKey,
            categories: composeCategoriesWithBills(
                categoriesPayload,
                billsPayload,
                legacyPayload.categories || []
            )
        });
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.reorderMonthCategories = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;
        const { orderedCategoryIds } = req.body;

        if (!Array.isArray(orderedCategoryIds) || orderedCategoryIds.length === 0) {
            return res.status(400).json({ error: 'orderedCategoryIds deve ser um array não vazio' });
        }

        const normalizedIds = orderedCategoryIds
            .filter((id) => typeof id === 'string')
            .map((id) => id.trim())
            .filter(Boolean);

        if (normalizedIds.length !== orderedCategoryIds.length) {
            return res.status(400).json({ error: 'orderedCategoryIds contém valores inválidos' });
        }

        const uniqueIds = [...new Set(normalizedIds)];
        if (uniqueIds.length !== normalizedIds.length) {
            return res.status(400).json({ error: 'orderedCategoryIds não pode conter IDs duplicados' });
        }

        const month = await db.Month.findOne({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        if (!month) {
            return res.status(404).json({ error: 'Mês não encontrado' });
        }

        const totalCategories = await db.MonthCategory.count({
            where: {
                userId: userId,
                month_key: monthKey
            }
        });

        if (totalCategories !== uniqueIds.length) {
            return res.status(400).json({ error: 'orderedCategoryIds deve conter todas as categorias do mês' });
        }

        const foundCategories = await db.MonthCategory.findAll({
            where: {
                userId: userId,
                month_key: monthKey,
                category_id: uniqueIds
            },
            attributes: ['category_id']
        });

        if (foundCategories.length !== uniqueIds.length) {
            return res.status(400).json({ error: 'orderedCategoryIds possui categorias inválidas para este mês' });
        }

        await db.sequelize.transaction(async (transaction) => {
            await Promise.all(uniqueIds.map((categoryId, index) => db.MonthCategory.update(
                { sort_order: index },
                {
                    where: {
                        userId: userId,
                        month_key: monthKey,
                        category_id: categoryId
                    },
                    transaction
                }
            )));
        });

        return res.status(200).json({
            monthKey,
            orderedCategoryIds: uniqueIds
        });
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.reorderCategoryBills = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, categoryId } = req.params;
        const { orderedBillIds } = req.body;

        if (!Array.isArray(orderedBillIds) || orderedBillIds.length === 0) {
            return res.status(400).json({ error: 'orderedBillIds deve ser um array não vazio' });
        }

        const normalizedIds = orderedBillIds
            .filter((id) => typeof id === 'string')
            .map((id) => id.trim())
            .filter(Boolean);

        if (normalizedIds.length !== orderedBillIds.length) {
            return res.status(400).json({ error: 'orderedBillIds contém valores inválidos' });
        }

        const uniqueIds = [...new Set(normalizedIds)];
        if (uniqueIds.length !== normalizedIds.length) {
            return res.status(400).json({ error: 'orderedBillIds não pode conter IDs duplicados' });
        }

        const month = await db.Month.findOne({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        if (!month) {
            return res.status(404).json({ error: 'Mês não encontrado' });
        }

        const category = await db.MonthCategory.findOne({
            where: {
                userId: userId,
                month_key: monthKey,
                category_id: categoryId
            }
        });

        if (!category) {
            return res.status(404).json({ error: 'Categoria não encontrada no mês informado' });
        }

        const totalBills = await db.MonthBill.count({
            where: {
                userId: userId,
                month_key: monthKey,
                category_id: categoryId
            }
        });

        if (totalBills !== uniqueIds.length) {
            return res.status(400).json({ error: 'orderedBillIds deve conter todas as contas da categoria' });
        }

        const foundBills = await db.MonthBill.findAll({
            where: {
                userId: userId,
                month_key: monthKey,
                category_id: categoryId,
                id: uniqueIds
            },
            attributes: ['id']
        });

        if (foundBills.length !== uniqueIds.length) {
            return res.status(400).json({ error: 'orderedBillIds possui contas inválidas para esta categoria' });
        }

        await db.sequelize.transaction(async (transaction) => {
            await Promise.all(uniqueIds.map((billId, index) => db.MonthBill.update(
                { sort_order: index },
                {
                    where: {
                        userId: userId,
                        month_key: monthKey,
                        category_id: categoryId,
                        id: billId
                    },
                    transaction
                }
            )));
        });

        return res.status(200).json({
            monthKey,
            categoryId,
            orderedBillIds: uniqueIds
        });
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.deleteMonth = async function(req, res) {
    try {
        const userId = req.userId
        const { monthKey } = req.params

        await db.MonthCategory.destroy({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });
        await db.MonthBill.destroy({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        const result = await db.Month.destroy({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Mês não encontrado' });
        }

        return res.status(204).send();
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.getMonthByKey = async function(req, res) {
    try {
        const userId = req.userId
        const { monthKey } = req.params;

        const month = await db.Month.findOne({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        if (!month) {
            return res.status(404).json({ error: 'Mês não encontrado' });
        }

        const categories = await db.MonthCategory.findAll({
            where: {
                userId: userId,
                month_key: monthKey
            },
            order: [['sort_order', 'ASC'], ['createdAt', 'ASC']]
        });
        const bills = await db.MonthBill.findAll({
            where: {
                userId: userId,
                month_key: monthKey
            },
            order: [['category_id', 'ASC'], ['sort_order', 'ASC'], ['createdAt', 'ASC']]
        });

        const legacyPayload = parseMonthPayload(month.data);
        const { bills: _legacyBills, ...monthBasePayload } = legacyPayload;
        const categoriesPayload = serializeCategoriesFromRows(categories);
        const billsPayload = serializeBillsFromRows(bills);
        const mergedCategories = composeCategoriesWithBills(
            categoriesPayload,
            billsPayload,
            legacyPayload.categories || []
        );

        return res.json({
            ...monthBasePayload,
            monthKey,
            categories: mergedCategories
        });
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.apiHealthCheck = async function(req, res) {
    return res.json({ status: 'ok' });
}

// ==================== BUDGETS ====================

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.getBudgets = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;

        const budgets = await db.Budget.findAll({
            where: {
                userId: userId,
                month_key: monthKey
            },
            order: [['createdAt', 'ASC']]
        });

        return res.json(budgets);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.createBudget = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;
        const budgetData = req.body;

        if (!budgetData.categoryName) {
            return res.status(400).json({ error: 'categoryName é obrigatório' });
        }

        if (!budgetData.limit || budgetData.limit <= 0) {
            return res.status(400).json({ error: 'limit deve ser maior que 0' });
        }

        const existing = await db.Budget.findOne({
            where: {
                id: budgetData.id,
                userId: userId
            }
        });

        if (existing) {
            return res.status(204).send();
        }

        const budget = await db.Budget.create({
            id: budgetData.id,
            month_key: monthKey,
            category_id: budgetData.categoryId || null,
            category_name: budgetData.categoryName,
            limit: budgetData.limit,
            spent: budgetData.spent || 0,
            userId: userId
        });

        return res.status(201).json(budget);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.updateBudget = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, budgetId } = req.params;
        const budgetData = req.body;

        const budget = await db.Budget.findOne({
            where: {
                id: budgetId,
                userId: userId,
                month_key: monthKey
            }
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget não encontrado' });
        }

        await budget.update({
            category_id: budgetData.categoryId,
            category_name: budgetData.categoryName,
            limit: budgetData.limit,
            spent: budgetData.spent
        });

        return res.json(budget);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.deleteBudget = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, budgetId } = req.params;

        const result = await db.Budget.destroy({
            where: {
                id: budgetId,
                userId: userId,
                month_key: monthKey
            }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Budget não encontrado' });
        }

        return res.status(204).send();
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

// ==================== INVESTMENTS ====================

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.getInvestments = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;

        const investments = await db.Investment.findAll({
            where: {
                userId: userId,
                month_key: monthKey
            },
            order: [['createdAt', 'ASC']]
        });

        return res.json(investments);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.createInvestment = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;
        const investmentData = req.body;

        if (!investmentData.name) {
            return res.status(400).json({ error: 'name é obrigatório' });
        }

        if (!investmentData.type) {
            return res.status(400).json({ error: 'type é obrigatório' });
        }

        if (!investmentData.amount || investmentData.amount <= 0) {
            return res.status(400).json({ error: 'amount deve ser maior que 0' });
        }

        if (!investmentData.purchaseDate) {
            return res.status(400).json({ error: 'purchaseDate é obrigatório' });
        }

        const existing = await db.Investment.findOne({
            where: {
                id: investmentData.id,
                userId: userId
            }
        });

        if (existing) {
            return res.status(204).send();
        }

        const investment = await db.Investment.create({
            id: investmentData.id,
            month_key: monthKey,
            name: investmentData.name,
            type: investmentData.type,
            amount: investmentData.amount,
            current_value: investmentData.currentValue || null,
            purchase_date: investmentData.purchaseDate,
            notes: investmentData.notes || null,
            userId: userId
        });

        return res.status(201).json(investment);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.updateInvestment = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, investmentId } = req.params;
        const investmentData = req.body;

        const investment = await db.Investment.findOne({
            where: {
                id: investmentId,
                userId: userId,
                month_key: monthKey
            }
        });

        if (!investment) {
            return res.status(404).json({ error: 'Investment não encontrado' });
        }

        await investment.update({
            name: investmentData.name,
            type: investmentData.type,
            amount: investmentData.amount,
            current_value: investmentData.currentValue,
            purchase_date: investmentData.purchaseDate,
            notes: investmentData.notes
        });

        return res.json(investment);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.deleteInvestment = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, investmentId } = req.params;

        const result = await db.Investment.destroy({
            where: {
                id: investmentId,
                userId: userId,
                month_key: monthKey
            }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Investment não encontrado' });
        }

        return res.status(204).send();
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

// ==================== GOALS ====================

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.getGoals = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;

        const goals = await db.Goal.findAll({
            where: {
                userId: userId,
                month_key: monthKey
            },
            order: [['createdAt', 'ASC']]
        });

        return res.json(goals);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.createGoal = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;
        const goalData = req.body;

        if (!goalData.name) {
            return res.status(400).json({ error: 'name é obrigatório' });
        }

        if (!goalData.targetAmount || goalData.targetAmount <= 0) {
            return res.status(400).json({ error: 'targetAmount deve ser maior que 0' });
        }

        if (!goalData.category) {
            return res.status(400).json({ error: 'category é obrigatório' });
        }

        const existing = await db.Goal.findOne({
            where: {
                id: goalData.id,
                userId: userId
            }
        });

        if (existing) {
            return res.status(204).send();
        }

        const goal = await db.Goal.create({
            id: goalData.id,
            month_key: monthKey,
            name: goalData.name,
            target_amount: goalData.targetAmount,
            current_amount: goalData.currentAmount || 0,
            deadline: goalData.deadline || null,
            category: goalData.category,
            userId: userId
        });

        return res.status(201).json(goal);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.updateGoal = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, goalId } = req.params;
        const goalData = req.body;

        const goal = await db.Goal.findOne({
            where: {
                id: goalId,
                userId: userId,
                month_key: monthKey
            }
        });

        if (!goal) {
            return res.status(404).json({ error: 'Goal não encontrado' });
        }

        await goal.update({
            name: goalData.name,
            target_amount: goalData.targetAmount,
            current_amount: goalData.currentAmount,
            deadline: goalData.deadline,
            category: goalData.category
        });

        return res.json(goal);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.deleteGoal = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, goalId } = req.params;

        const result = await db.Goal.destroy({
            where: {
                id: goalId,
                userId: userId,
                month_key: monthKey
            }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Goal não encontrado' });
        }

        return res.status(204).send();
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

// ==================== SUBSCRIPTIONS ====================

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.getSubscriptions = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;

        const subscriptions = await db.Subscription.findAll({
            where: {
                userId: userId,
                month_key: monthKey
            },
            order: [['createdAt', 'ASC']]
        });

        return res.json(subscriptions);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.createSubscription = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey } = req.params;
        const subscriptionData = req.body;

        if (!subscriptionData.name) {
            return res.status(400).json({ error: 'name é obrigatório' });
        }

        if (!subscriptionData.amount || subscriptionData.amount <= 0) {
            return res.status(400).json({ error: 'amount deve ser maior que 0' });
        }

        if (!subscriptionData.billingCycle) {
            return res.status(400).json({ error: 'billingCycle é obrigatório' });
        }

        if (!subscriptionData.nextBillingDate) {
            return res.status(400).json({ error: 'nextBillingDate é obrigatório' });
        }

        const existing = await db.Subscription.findOne({
            where: {
                id: subscriptionData.id,
                userId: userId
            }
        });

        if (existing) {
            return res.status(204).send();
        }

        const subscription = await db.Subscription.create({
            id: subscriptionData.id,
            month_key: monthKey,
            name: subscriptionData.name,
            amount: subscriptionData.amount,
            billing_cycle: subscriptionData.billingCycle,
            next_billing_date: subscriptionData.nextBillingDate,
            category: subscriptionData.category || null,
            active: subscriptionData.active !== undefined ? subscriptionData.active : true,
            notes: subscriptionData.notes || null,
            userId: userId
        });

        return res.status(201).json(subscription);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.updateSubscription = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, subscriptionId } = req.params;
        const subscriptionData = req.body;

        const subscription = await db.Subscription.findOne({
            where: {
                id: subscriptionId,
                userId: userId,
                month_key: monthKey
            }
        });

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription não encontrado' });
        }

        await subscription.update({
            name: subscriptionData.name,
            amount: subscriptionData.amount,
            billing_cycle: subscriptionData.billingCycle,
            next_billing_date: subscriptionData.nextBillingDate,
            category: subscriptionData.category,
            active: subscriptionData.active,
            notes: subscriptionData.notes
        });

        return res.json(subscription);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.deleteSubscription = async function(req, res) {
    try {
        const userId = req.userId;
        const { monthKey, subscriptionId } = req.params;

        const result = await db.Subscription.destroy({
            where: {
                id: subscriptionId,
                userId: userId,
                month_key: monthKey
            }
        });

        if (result === 0) {
            return res.status(404).json({ error: 'Subscription não encontrado' });
        }

        return res.status(204).send();
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.getPlanIdentity = async function(req, res) {
    try {
        const userPlan = req.auth?.plan;

        if (!userPlan) {
            return res.status(403).json({ error: 'User plan not found in token' });
        }

        const identity = await getIdentity(userPlan);

        if (!identity) {
            return res.status(404).json({ error: 'Identity not found for plan', plan: userPlan });
        }

        return res.status(200).json(identity);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}
