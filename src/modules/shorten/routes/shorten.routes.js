const shorten = require('../controllers/shorten.controller');

/**
 *
 * @param {import('express').Express} app
 * @param {import('../../../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.post('/shorten', auth.sessionOrJwt, shorten.shortenUrl);
    app.get('/:code', shorten.redirectUrl);
    app.get('/user/urls', auth.sessionOrJwt, shorten.getUserUrls);
    app.delete('/user/url/:code', auth.sessionOrJwt, shorten.removeUserUrl);
};
