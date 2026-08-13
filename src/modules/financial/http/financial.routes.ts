import type { Request, Response, Router } from 'express';
import { auth } from '@shared/middleware/auth.middleware';
import { checkRateLimit, loadUserFeatures, requireFeature } from '@shared/featureFlags/middleware';
import { financialController as fc } from './financial.controller';

/**
 * TS registration mirroring the legacy financial.routes.js exactly — same paths,
 * same middleware order (auth → requireFeature → checkRateLimit → handler), so
 * behavior is unchanged (docs §1.4). Paths stay relative to the module router,
 * which mounts at '/financial' (canonical) + '' (legacy root alias).
 */
export function registerFinancialRoutes(router: Router): void {
    // Months
    router.post('/months', auth.sessionOrJwt, requireFeature('financial_months'), checkRateLimit('months', 'create'), fc.createMonth);
    router.get('/months', auth.sessionOrJwt, requireFeature('financial_months'), fc.getMonths);
    router.get('/month/:monthKey', auth.sessionOrJwt, requireFeature('financial_months'), fc.getMonthByKey);
    router.put('/months/:monthKey', auth.sessionOrJwt, requireFeature('financial_months'), checkRateLimit('months', 'update'), fc.updateMonth);
    router.put('/months/:monthKey/categories/reorder', auth.sessionOrJwt, requireFeature('financial_months'), checkRateLimit('months', 'update'), fc.reorderMonthCategories);
    router.put('/months/:monthKey/categories/:categoryId/bills/reorder', auth.sessionOrJwt, requireFeature('financial_months'), checkRateLimit('months', 'update'), fc.reorderCategoryBills);
    router.delete('/months/:monthKey', auth.sessionOrJwt, requireFeature('financial_months'), checkRateLimit('months', 'delete'), fc.deleteMonth);

    // Budgets
    router.get('/months/:monthKey/budgets', auth.sessionOrJwt, requireFeature('financial_budgets'), fc.getBudgets);
    router.post('/months/:monthKey/budgets', auth.sessionOrJwt, requireFeature('financial_budgets'), checkRateLimit('budgets', 'create'), fc.createBudget);
    router.put('/months/:monthKey/budgets/:budgetId', auth.sessionOrJwt, requireFeature('financial_budgets'), checkRateLimit('budgets', 'update'), fc.updateBudget);
    router.delete('/months/:monthKey/budgets/:budgetId', auth.sessionOrJwt, requireFeature('financial_budgets'), checkRateLimit('budgets', 'delete'), fc.deleteBudget);

    // Investments
    router.get('/months/:monthKey/investments', auth.sessionOrJwt, requireFeature('financial_investments'), fc.getInvestments);
    router.post('/months/:monthKey/investments', auth.sessionOrJwt, requireFeature('financial_investments'), checkRateLimit('investments', 'create'), fc.createInvestment);
    router.put('/months/:monthKey/investments/:investmentId', auth.sessionOrJwt, requireFeature('financial_investments'), checkRateLimit('investments', 'update'), fc.updateInvestment);
    router.delete('/months/:monthKey/investments/:investmentId', auth.sessionOrJwt, requireFeature('financial_investments'), checkRateLimit('investments', 'delete'), fc.deleteInvestment);

    // Goals
    router.get('/months/:monthKey/goals', auth.sessionOrJwt, requireFeature('financial_goals'), fc.getGoals);
    router.post('/months/:monthKey/goals', auth.sessionOrJwt, requireFeature('financial_goals'), checkRateLimit('goals', 'create'), fc.createGoal);
    router.put('/months/:monthKey/goals/:goalId', auth.sessionOrJwt, requireFeature('financial_goals'), checkRateLimit('goals', 'update'), fc.updateGoal);
    router.delete('/months/:monthKey/goals/:goalId', auth.sessionOrJwt, requireFeature('financial_goals'), checkRateLimit('goals', 'delete'), fc.deleteGoal);

    // Subscriptions
    router.get('/months/:monthKey/subscriptions', auth.sessionOrJwt, requireFeature('financial_subscriptions'), fc.getSubscriptions);
    router.post('/months/:monthKey/subscriptions', auth.sessionOrJwt, requireFeature('financial_subscriptions'), checkRateLimit('subscriptions', 'create'), fc.createSubscription);
    router.put('/months/:monthKey/subscriptions/:subscriptionId', auth.sessionOrJwt, requireFeature('financial_subscriptions'), checkRateLimit('subscriptions', 'update'), fc.updateSubscription);
    router.delete('/months/:monthKey/subscriptions/:subscriptionId', auth.sessionOrJwt, requireFeature('financial_subscriptions'), checkRateLimit('subscriptions', 'delete'), fc.deleteSubscription);

    // Health / auth / features / identity
    router.get('/health', fc.apiHealthCheck);
    router.get('/check/auth', auth.sessionOrJwt, auth.check);
    router.get('/features', auth.sessionOrJwt, loadUserFeatures, (req: Request, res: Response) => {
        res.status(200).json({ plan: req.auth?.plan, features: req.features || {} });
    });
    router.get('/identity', auth.sessionOrJwt, fc.getPlanIdentity);
}
