import type { Request, RequestHandler, Response } from 'express';
import { getIdentity } from '../../../shared/featureFlags/client';
import { serializeBillsFromRows, serializeCategoriesFromRows } from '../domain/month.dto';
import { FinancialRepository } from '../infra/financial.repository';
import {
    composeCategoriesWithBills,
    flattenLegacyBills,
    hasBillsWithoutCategory,
    normalizeBills,
    normalizeCategories,
    parseMonthPayload,
} from '../domain/financial.helpers';

/**
 * Financial controller — native TS + PRISMA (ported from the 1448-line
 * financial.controller.js). All routes/status codes/response shapes preserved
 * (docs §1.4). DB access via FinancialRepository; month payload transforms via
 * financial.helpers; feature-flag identity via config/featureFlags.
 */
const repo = new FinancialRepository();
const toDate = (v: unknown): Date | null => (v ? new Date(v as string) : null);
/** For update: convert a date only when present; undefined leaves the field untouched. */
const toDateOpt = (v: unknown): Date | null | undefined => (v === undefined ? undefined : toDate(v));

export interface FinancialController {
    createMonth: RequestHandler;
    getMonths: RequestHandler;
    getMonthByKey: RequestHandler;
    updateMonth: RequestHandler;
    reorderMonthCategories: RequestHandler;
    reorderCategoryBills: RequestHandler;
    deleteMonth: RequestHandler;
    getBudgets: RequestHandler;
    createBudget: RequestHandler;
    updateBudget: RequestHandler;
    deleteBudget: RequestHandler;
    getInvestments: RequestHandler;
    createInvestment: RequestHandler;
    updateInvestment: RequestHandler;
    deleteInvestment: RequestHandler;
    getGoals: RequestHandler;
    createGoal: RequestHandler;
    updateGoal: RequestHandler;
    deleteGoal: RequestHandler;
    getSubscriptions: RequestHandler;
    createSubscription: RequestHandler;
    updateSubscription: RequestHandler;
    deleteSubscription: RequestHandler;
    apiHealthCheck: RequestHandler;
    getPlanIdentity: RequestHandler;
}

export const financialController: FinancialController = {
    createMonth: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const monthData = req.body;
            const normalizedCategories = normalizeCategories(monthData.categories);
            const normalizedBills = normalizeBills(monthData.bills, monthData, normalizedCategories);

            if (hasBillsWithoutCategory(normalizedBills)) {
                return res.status(400).json({ error: 'Todo bill deve estar associado a uma categoria válida' });
            }
            if (!monthData.monthKey) {
                return res.status(400).json({ error: 'monthKey é obrigatório' });
            }
            if (!/^\d{4}-\d{2}$/.test(monthData.monthKey)) {
                return res.status(400).json({ error: 'monthKey deve estar no formato YYYY-MM' });
            }

            const existing = await repo.findMonth(userId, monthData.monthKey);
            if (existing) {
                return res.status(204).json({ message: 'Mês já existe' });
            }

            const month = await repo.createMonthWithData(userId, monthData.monthKey, normalizedCategories, normalizedBills);

            const responseCategories = composeCategoriesWithBills(
                serializeCategoriesFromRows(normalizedCategories),
                normalizedBills.map((bill) => ({
                    id: bill.id,
                    categoryId: bill.category_id,
                    name: bill.name,
                    type: bill.type,
                    amount: bill.amount,
                    dueDate: bill.due_date,
                    paid: bill.paid,
                })),
                monthData.categories,
            );

            return res.status(201).json({ monthKey: month.month_key, categories: responseCategories });
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    getMonths: async (req: Request, res: Response) => {
        try {
            const results = await repo.getMonthsRaw(req.userId as string);
            if (results.length === 0) return res.status(200).json([]);

            const months = results.map((row) => {
                const parsedData = parseMonthPayload(row.data);
                const parsedCategories = parseMonthPayload(row.categories);
                const parsedBills = parseMonthPayload(row.bills);
                const { bills: _legacyBills, ...monthBasePayload } = parsedData;

                return {
                    ...monthBasePayload,
                    monthKey: row.monthKey || row.MONTHKEY || row.monthkey || parsedData.monthKey,
                    categories: composeCategoriesWithBills(
                        Array.isArray(parsedCategories) ? parsedCategories : [],
                        Array.isArray(parsedBills) ? parsedBills : parsedData.bills || flattenLegacyBills(parsedData),
                        parsedData.categories || [],
                    ),
                    budgets: row.budgets,
                    investments: row.investments,
                    goals: row.goals,
                    subscriptions: row.subscriptions,
                };
            });

            return res.json(months);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    updateMonth: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey } = req.params;
            const monthData = req.body;
            const hasCategoriesPayload = Array.isArray(monthData.categories);
            const hasBillsPayload =
                Array.isArray(monthData.bills) ||
                (Array.isArray(monthData.categories) && monthData.categories.some((item: { bills?: unknown }) => Array.isArray(item?.bills)));
            const normalizedCategories = normalizeCategories(monthData.categories);
            const normalizedBills = normalizeBills(monthData.bills, monthData, normalizedCategories);

            if (hasBillsPayload && hasBillsWithoutCategory(normalizedBills)) {
                return res.status(400).json({ error: 'Todo bill deve estar associado a uma categoria válida' });
            }

            const month = await repo.findMonth(userId, monthKey);
            if (!month) return res.status(404).json({ error: 'Mês não encontrado' });

            if (hasCategoriesPayload) await repo.replaceCategories(userId, monthKey, normalizedCategories);
            if (hasBillsPayload) await repo.replaceBills(userId, monthKey, normalizedBills);

            const categories = await repo.findCategories(userId, monthKey);
            const bills = await repo.findBills(userId, monthKey);
            const legacyPayload = parseMonthPayload(month.data);
            const { bills: _legacyBills, ...monthBasePayload } = legacyPayload;

            return res.json({
                ...monthBasePayload,
                monthKey,
                categories: composeCategoriesWithBills(
                    serializeCategoriesFromRows(categories),
                    serializeBillsFromRows(bills),
                    legacyPayload.categories || [],
                ),
            });
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    reorderMonthCategories: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey } = req.params;
            const { orderedCategoryIds } = req.body;

            if (!Array.isArray(orderedCategoryIds) || orderedCategoryIds.length === 0) {
                return res.status(400).json({ error: 'orderedCategoryIds deve ser um array não vazio' });
            }
            const normalizedIds = orderedCategoryIds.filter((id: unknown) => typeof id === 'string').map((id: string) => id.trim()).filter(Boolean);
            if (normalizedIds.length !== orderedCategoryIds.length) {
                return res.status(400).json({ error: 'orderedCategoryIds contém valores inválidos' });
            }
            const uniqueIds = [...new Set<string>(normalizedIds)];
            if (uniqueIds.length !== normalizedIds.length) {
                return res.status(400).json({ error: 'orderedCategoryIds não pode conter IDs duplicados' });
            }

            const month = await repo.findMonth(userId, monthKey);
            if (!month) return res.status(404).json({ error: 'Mês não encontrado' });

            const totalCategories = await repo.countCategories(userId, monthKey);
            if (totalCategories !== uniqueIds.length) {
                return res.status(400).json({ error: 'orderedCategoryIds deve conter todas as categorias do mês' });
            }
            const foundCategories = await repo.findCategoryIds(userId, monthKey, uniqueIds);
            if (foundCategories.length !== uniqueIds.length) {
                return res.status(400).json({ error: 'orderedCategoryIds possui categorias inválidas para este mês' });
            }

            await repo.reorderCategories(userId, monthKey, uniqueIds);
            return res.status(200).json({ monthKey, orderedCategoryIds: uniqueIds });
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    reorderCategoryBills: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey, categoryId } = req.params;
            const { orderedBillIds } = req.body;

            if (!Array.isArray(orderedBillIds) || orderedBillIds.length === 0) {
                return res.status(400).json({ error: 'orderedBillIds deve ser um array não vazio' });
            }
            const normalizedIds = orderedBillIds.filter((id: unknown) => typeof id === 'string').map((id: string) => id.trim()).filter(Boolean);
            if (normalizedIds.length !== orderedBillIds.length) {
                return res.status(400).json({ error: 'orderedBillIds contém valores inválidos' });
            }
            const uniqueIds = [...new Set<string>(normalizedIds)];
            if (uniqueIds.length !== normalizedIds.length) {
                return res.status(400).json({ error: 'orderedBillIds não pode conter IDs duplicados' });
            }

            const month = await repo.findMonth(userId, monthKey);
            if (!month) return res.status(404).json({ error: 'Mês não encontrado' });
            const category = await repo.findCategory(userId, monthKey, categoryId);
            if (!category) return res.status(404).json({ error: 'Categoria não encontrada no mês informado' });

            const totalBills = await repo.countBills(userId, monthKey, categoryId);
            if (totalBills !== uniqueIds.length) {
                return res.status(400).json({ error: 'orderedBillIds deve conter todas as contas da categoria' });
            }
            const foundBills = await repo.findBillIds(userId, monthKey, categoryId, uniqueIds);
            if (foundBills.length !== uniqueIds.length) {
                return res.status(400).json({ error: 'orderedBillIds possui contas inválidas para esta categoria' });
            }

            await repo.reorderBills(userId, monthKey, categoryId, uniqueIds);
            return res.status(200).json({ monthKey, categoryId, orderedBillIds: uniqueIds });
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    deleteMonth: async (req: Request, res: Response) => {
        try {
            const result = await repo.deleteMonthCascade(req.userId as string, req.params.monthKey);
            if (result === 0) return res.status(404).json({ error: 'Mês não encontrado' });
            return res.status(204).send();
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    getMonthByKey: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey } = req.params;
            const month = await repo.findMonth(userId, monthKey);
            if (!month) return res.status(404).json({ error: 'Mês não encontrado' });

            const categories = await repo.findCategories(userId, monthKey);
            const bills = await repo.findBills(userId, monthKey);
            const legacyPayload = parseMonthPayload(month.data);
            const { bills: _legacyBills, ...monthBasePayload } = legacyPayload;

            return res.json({
                ...monthBasePayload,
                monthKey,
                categories: composeCategoriesWithBills(
                    serializeCategoriesFromRows(categories),
                    serializeBillsFromRows(bills),
                    legacyPayload.categories || [],
                ),
            });
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    apiHealthCheck: async (_req: Request, res: Response) => {
        return res.json({ status: 'ok' });
    },

    // ==================== BUDGETS ====================
    getBudgets: async (req: Request, res: Response) => {
        try {
            return res.json(await repo.findBudgets(req.userId as string, req.params.monthKey));
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    createBudget: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey } = req.params;
            const d = req.body;
            if (!d.categoryName) return res.status(400).json({ error: 'categoryName é obrigatório' });
            if (!d.limit || d.limit <= 0) return res.status(400).json({ error: 'limit deve ser maior que 0' });

            const existing = await repo.findBudget(userId, d.id);
            if (existing) return res.status(204).send();

            const budget = await repo.createBudget({
                id: d.id,
                month_key: monthKey,
                category_id: d.categoryId || null,
                category_name: d.categoryName,
                limit: d.limit,
                spent: d.spent || 0,
                userId,
            });
            return res.status(201).json(budget);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    updateBudget: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey, budgetId } = req.params;
            const d = req.body;
            const budget = await repo.findBudgetScoped(userId, monthKey, budgetId);
            if (!budget) return res.status(404).json({ error: 'Budget não encontrado' });
            const updated = await repo.updateBudget(budgetId, {
                category_id: d.categoryId,
                category_name: d.categoryName,
                limit: d.limit,
                spent: d.spent,
            });
            return res.json(updated);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    deleteBudget: async (req: Request, res: Response) => {
        try {
            const result = await repo.deleteBudget(req.userId as string, req.params.monthKey, req.params.budgetId);
            if (result === 0) return res.status(404).json({ error: 'Budget não encontrado' });
            return res.status(204).send();
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    // ==================== INVESTMENTS ====================
    getInvestments: async (req: Request, res: Response) => {
        try {
            return res.json(await repo.findInvestments(req.userId as string, req.params.monthKey));
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    createInvestment: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey } = req.params;
            const d = req.body;
            if (!d.name) return res.status(400).json({ error: 'name é obrigatório' });
            if (!d.type) return res.status(400).json({ error: 'type é obrigatório' });
            if (!d.amount || d.amount <= 0) return res.status(400).json({ error: 'amount deve ser maior que 0' });
            if (!d.purchaseDate) return res.status(400).json({ error: 'purchaseDate é obrigatório' });

            const existing = await repo.findInvestment(userId, d.id);
            if (existing) return res.status(204).send();

            const investment = await repo.createInvestment({
                id: d.id,
                month_key: monthKey,
                name: d.name,
                type: d.type,
                amount: d.amount,
                current_value: d.currentValue || null,
                purchase_date: toDate(d.purchaseDate),
                notes: d.notes || null,
                userId,
            });
            return res.status(201).json(investment);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    updateInvestment: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey, investmentId } = req.params;
            const d = req.body;
            const investment = await repo.findInvestmentScoped(userId, monthKey, investmentId);
            if (!investment) return res.status(404).json({ error: 'Investment não encontrado' });
            const updated = await repo.updateInvestment(investmentId, {
                name: d.name,
                type: d.type,
                amount: d.amount,
                current_value: d.currentValue,
                purchase_date: toDateOpt(d.purchaseDate),
                notes: d.notes,
            });
            return res.json(updated);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    deleteInvestment: async (req: Request, res: Response) => {
        try {
            const result = await repo.deleteInvestment(req.userId as string, req.params.monthKey, req.params.investmentId);
            if (result === 0) return res.status(404).json({ error: 'Investment não encontrado' });
            return res.status(204).send();
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    // ==================== GOALS ====================
    getGoals: async (req: Request, res: Response) => {
        try {
            return res.json(await repo.findGoals(req.userId as string, req.params.monthKey));
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    createGoal: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey } = req.params;
            const d = req.body;
            if (!d.name) return res.status(400).json({ error: 'name é obrigatório' });
            if (!d.targetAmount || d.targetAmount <= 0) return res.status(400).json({ error: 'targetAmount deve ser maior que 0' });
            if (!d.category) return res.status(400).json({ error: 'category é obrigatório' });

            const existing = await repo.findGoal(userId, d.id);
            if (existing) return res.status(204).send();

            const goal = await repo.createGoal({
                id: d.id,
                month_key: monthKey,
                name: d.name,
                target_amount: d.targetAmount,
                current_amount: d.currentAmount || 0,
                deadline: toDate(d.deadline),
                category: d.category,
                userId,
            });
            return res.status(201).json(goal);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    updateGoal: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey, goalId } = req.params;
            const d = req.body;
            const goal = await repo.findGoalScoped(userId, monthKey, goalId);
            if (!goal) return res.status(404).json({ error: 'Goal não encontrado' });
            const updated = await repo.updateGoal(goalId, {
                name: d.name,
                target_amount: d.targetAmount,
                current_amount: d.currentAmount,
                deadline: toDateOpt(d.deadline),
                category: d.category,
            });
            return res.json(updated);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    deleteGoal: async (req: Request, res: Response) => {
        try {
            const result = await repo.deleteGoal(req.userId as string, req.params.monthKey, req.params.goalId);
            if (result === 0) return res.status(404).json({ error: 'Goal não encontrado' });
            return res.status(204).send();
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    // ==================== SUBSCRIPTIONS ====================
    getSubscriptions: async (req: Request, res: Response) => {
        try {
            return res.json(await repo.findSubscriptions(req.userId as string, req.params.monthKey));
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    createSubscription: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey } = req.params;
            const d = req.body;
            if (!d.name) return res.status(400).json({ error: 'name é obrigatório' });
            if (!d.amount || d.amount <= 0) return res.status(400).json({ error: 'amount deve ser maior que 0' });
            if (!d.billingCycle) return res.status(400).json({ error: 'billingCycle é obrigatório' });
            if (!d.nextBillingDate) return res.status(400).json({ error: 'nextBillingDate é obrigatório' });

            const existing = await repo.findSubscription(userId, d.id);
            if (existing) return res.status(204).send();

            const subscription = await repo.createSubscription({
                id: d.id,
                month_key: monthKey,
                name: d.name,
                amount: d.amount,
                billing_cycle: d.billingCycle,
                next_billing_date: toDate(d.nextBillingDate),
                category: d.category || null,
                active: d.active !== undefined ? d.active : true,
                notes: d.notes || null,
                userId,
            });
            return res.status(201).json(subscription);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    updateSubscription: async (req: Request, res: Response) => {
        try {
            const userId = req.userId as string;
            const { monthKey, subscriptionId } = req.params;
            const d = req.body;
            const subscription = await repo.findSubscriptionScoped(userId, monthKey, subscriptionId);
            if (!subscription) return res.status(404).json({ error: 'Subscription não encontrado' });
            const updated = await repo.updateSubscription(subscriptionId, {
                name: d.name,
                amount: d.amount,
                billing_cycle: d.billingCycle,
                next_billing_date: toDateOpt(d.nextBillingDate),
                category: d.category,
                active: d.active,
                notes: d.notes,
            });
            return res.json(updated);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
    deleteSubscription: async (req: Request, res: Response) => {
        try {
            const result = await repo.deleteSubscription(req.userId as string, req.params.monthKey, req.params.subscriptionId);
            if (result === 0) return res.status(404).json({ error: 'Subscription não encontrado' });
            return res.status(204).send();
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },

    getPlanIdentity: async (req: Request, res: Response) => {
        try {
            const userPlan = req.auth?.plan;
            if (!userPlan) return res.status(403).json({ error: 'User plan not found in token' });
            const identity = await getIdentity(userPlan);
            if (!identity) return res.status(404).json({ error: 'Identity not found for plan', plan: userPlan });
            return res.status(200).json(identity);
        } catch (e) {
            console.error(e);
            return res.sendStatus(500);
        }
    },
};
