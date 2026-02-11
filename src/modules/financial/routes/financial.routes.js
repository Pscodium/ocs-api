const financial = require('../controllers/financial.controller');

/**
 *
 * @param {import('express').Express} app
 * @param {import('../../../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.post('/months', auth.sessionOrJwt, financial.createMonth);
    app.get('/months', auth.sessionOrJwt, financial.getMonths);
    app.get('/month/:monthKey', auth.sessionOrJwt, financial.getMonthByKey);
    app.put('/months/:monthKey', auth.sessionOrJwt, financial.updateMonth);
    app.get('/health', financial.apiHealthCheck);
};
