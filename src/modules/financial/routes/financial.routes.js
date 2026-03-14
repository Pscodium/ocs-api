const financial = require('../controllers/financial.controller');
const { requireFeature, checkRateLimit, loadUserFeatures } = require('../../../middleware/featureFlags');

/**
 *
 * @param {import('express').Express} app
 * @param {import('../../../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    // Months
    app.post('/months', 
        auth.sessionOrJwt, 
        requireFeature('financial_months'), 
        checkRateLimit('months', 'create'), 
        financial.createMonth
    );
    app.get('/months', 
        auth.sessionOrJwt, 
        requireFeature('financial_months'), 
        financial.getMonths
    );
    app.get('/month/:monthKey', 
        auth.sessionOrJwt, 
        requireFeature('financial_months'), 
        financial.getMonthByKey
    );
    app.put('/months/:monthKey', 
        auth.sessionOrJwt, 
        requireFeature('financial_months'), 
        checkRateLimit('months', 'update'), 
        financial.updateMonth
    );
    app.put('/months/:monthKey/categories/reorder',
        auth.sessionOrJwt,
        requireFeature('financial_months'),
        checkRateLimit('months', 'update'),
        financial.reorderMonthCategories
    );
    app.put('/months/:monthKey/categories/:categoryId/bills/reorder',
        auth.sessionOrJwt,
        requireFeature('financial_months'),
        checkRateLimit('months', 'update'),
        financial.reorderCategoryBills
    );
    app.delete('/months/:monthKey', 
        auth.sessionOrJwt, 
        requireFeature('financial_months'), 
        checkRateLimit('months', 'delete'), 
        financial.deleteMonth
    );
    
    // Budgets
    app.get('/months/:monthKey/budgets', 
        auth.sessionOrJwt, 
        requireFeature('financial_budgets'), 
        financial.getBudgets
    );
    app.post('/months/:monthKey/budgets', 
        auth.sessionOrJwt, 
        requireFeature('financial_budgets'), 
        checkRateLimit('budgets', 'create'), 
        financial.createBudget
    );
    app.put('/months/:monthKey/budgets/:budgetId', 
        auth.sessionOrJwt, 
        requireFeature('financial_budgets'), 
        checkRateLimit('budgets', 'update'), 
        financial.updateBudget
    );
    app.delete('/months/:monthKey/budgets/:budgetId', 
        auth.sessionOrJwt, 
        requireFeature('financial_budgets'), 
        checkRateLimit('budgets', 'delete'), 
        financial.deleteBudget
    );
    
    // Investments
    app.get('/months/:monthKey/investments', 
        auth.sessionOrJwt, 
        requireFeature('financial_investments'), 
        financial.getInvestments
    );
    app.post('/months/:monthKey/investments', 
        auth.sessionOrJwt, 
        requireFeature('financial_investments'), 
        checkRateLimit('investments', 'create'), 
        financial.createInvestment
    );
    app.put('/months/:monthKey/investments/:investmentId', 
        auth.sessionOrJwt, 
        requireFeature('financial_investments'), 
        checkRateLimit('investments', 'update'), 
        financial.updateInvestment
    );
    app.delete('/months/:monthKey/investments/:investmentId', 
        auth.sessionOrJwt, 
        requireFeature('financial_investments'), 
        checkRateLimit('investments', 'delete'), 
        financial.deleteInvestment
    );
    
    // Goals
    app.get('/months/:monthKey/goals', 
        auth.sessionOrJwt, 
        requireFeature('financial_goals'), 
        financial.getGoals
    );
    app.post('/months/:monthKey/goals', 
        auth.sessionOrJwt, 
        requireFeature('financial_goals'), 
        checkRateLimit('goals', 'create'), 
        financial.createGoal
    );
    app.put('/months/:monthKey/goals/:goalId', 
        auth.sessionOrJwt, 
        requireFeature('financial_goals'), 
        checkRateLimit('goals', 'update'), 
        financial.updateGoal
    );
    app.delete('/months/:monthKey/goals/:goalId', 
        auth.sessionOrJwt, 
        requireFeature('financial_goals'), 
        checkRateLimit('goals', 'delete'), 
        financial.deleteGoal
    );
    
    // Subscriptions
    app.get('/months/:monthKey/subscriptions', 
        auth.sessionOrJwt, 
        requireFeature('financial_subscriptions'), 
        financial.getSubscriptions
    );
    app.post('/months/:monthKey/subscriptions', 
        auth.sessionOrJwt, 
        requireFeature('financial_subscriptions'), 
        checkRateLimit('subscriptions', 'create'), 
        financial.createSubscription
    );
    app.put('/months/:monthKey/subscriptions/:subscriptionId', 
        auth.sessionOrJwt, 
        requireFeature('financial_subscriptions'), 
        checkRateLimit('subscriptions', 'update'), 
        financial.updateSubscription
    );
    app.delete('/months/:monthKey/subscriptions/:subscriptionId', 
        auth.sessionOrJwt, 
        requireFeature('financial_subscriptions'), 
        checkRateLimit('subscriptions', 'delete'), 
        financial.deleteSubscription
    );
    
    // Health
    app.get('/health', financial.apiHealthCheck);
    app.get('/check/auth', auth.sessionOrJwt, auth.check);
    
    // Features endpoint - Get all features available for user
    app.get('/features', auth.sessionOrJwt, loadUserFeatures, (req, res) => {
        return res.status(200).json({
            plan: req.auth?.plan,
            features: req.features || {}
        });
    });

    // Identity endpoint - Get full feature flag identity (flags + traits) for the user's plan
    app.get('/identity', auth.sessionOrJwt, financial.getPlanIdentity);
};
