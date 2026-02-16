/**
 *
 * @param {import('../index')} app
 * @param {import('../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.get('/check/auth', auth.sessionOrJwt, auth.check);
};
