const db = require('../../../config/sequelize');

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

        await db.Month.create({
            month_key: monthData.monthKey,
            data: JSON.stringify(monthData),
            UserId: userId
        });

        return res.status(201).json(monthData);
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
            return res.status(404).json({ error: 'Nenhum mês encontrado' });
        }

        const months = results.map(row => {
            const parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            parsedData.budgets = row.budgets;
            parsedData.investments = row.investments;
            parsedData.goals = row.goals;
            parsedData.subscriptions = row.subscriptions;

            return parsedData;
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

        const result = await db.Month.update(
            { data: JSON.stringify(monthData) },
            {
                where: {
                    month_key: monthKey,
                    userId: userId
                }
            }
        );

        if (result.length === 0) {
            return res.status(404).json({ error: 'Mês não encontrado' });
        }

        const month = await db.Month.findOne({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        return res.json(JSON.parse(month.data));
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

        return res.json(JSON.parse(month.data));
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
                UserId: userId,
                month_key: monthKey
            },
            order: [['created_at', 'ASC']]
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
                UserId: userId
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
            UserId: userId
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
                UserId: userId,
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
                UserId: userId,
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
                UserId: userId,
                month_key: monthKey
            },
            order: [['created_at', 'ASC']]
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
                UserId: userId
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
            UserId: userId
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
                UserId: userId,
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
                UserId: userId,
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
                UserId: userId,
                month_key: monthKey
            },
            order: [['created_at', 'ASC']]
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
                UserId: userId
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
            UserId: userId
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
                UserId: userId,
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
                UserId: userId,
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
                UserId: userId,
                month_key: monthKey
            },
            order: [['created_at', 'ASC']]
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
                UserId: userId
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
            UserId: userId
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
                UserId: userId,
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
                UserId: userId,
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