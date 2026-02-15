const financial = require('../controllers/financial.controller');

/**
 *
 * @param {import('express').Express} app
 * @param {import('../../../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    // Months
    app.post('/months', auth.sessionOrJwt, financial.createMonth);
    app.get('/months', auth.sessionOrJwt, financial.getMonths);
    app.get('/month/:monthKey', auth.sessionOrJwt, financial.getMonthByKey);
    app.put('/months/:monthKey', auth.sessionOrJwt, financial.updateMonth);
    
    // Budgets
    app.get('/months/:monthKey/budgets', auth.sessionOrJwt, financial.getBudgets);
    app.post('/months/:monthKey/budgets', auth.sessionOrJwt, financial.createBudget);
    app.put('/months/:monthKey/budgets/:budgetId', auth.sessionOrJwt, financial.updateBudget);
    app.delete('/months/:monthKey/budgets/:budgetId', auth.sessionOrJwt, financial.deleteBudget);
    
    // Investments
    app.get('/months/:monthKey/investments', auth.sessionOrJwt, financial.getInvestments);
    app.post('/months/:monthKey/investments', auth.sessionOrJwt, financial.createInvestment);
    app.put('/months/:monthKey/investments/:investmentId', auth.sessionOrJwt, financial.updateInvestment);
    app.delete('/months/:monthKey/investments/:investmentId', auth.sessionOrJwt, financial.deleteInvestment);
    
    // Goals
    app.get('/months/:monthKey/goals', auth.sessionOrJwt, financial.getGoals);
    app.post('/months/:monthKey/goals', auth.sessionOrJwt, financial.createGoal);
    app.put('/months/:monthKey/goals/:goalId', auth.sessionOrJwt, financial.updateGoal);
    app.delete('/months/:monthKey/goals/:goalId', auth.sessionOrJwt, financial.deleteGoal);
    
    // Subscriptions
    app.get('/months/:monthKey/subscriptions', auth.sessionOrJwt, financial.getSubscriptions);
    app.post('/months/:monthKey/subscriptions', auth.sessionOrJwt, financial.createSubscription);
    app.put('/months/:monthKey/subscriptions/:subscriptionId', auth.sessionOrJwt, financial.updateSubscription);
    app.delete('/months/:monthKey/subscriptions/:subscriptionId', auth.sessionOrJwt, financial.deleteSubscription);
    
    // Health
    app.get('/health', financial.apiHealthCheck);
};
