const articles = require("../controllers/articles.controller");
const enums = require("../database/enums/index");

/**
 *
 * @param {import('../index')} app
 * @param {import('../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.post('/article/create', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.create);
    app.get('/list/articles/:tagId', articles.getArticlesByTagId);
    app.get('/list-all/articles', articles.getAllArticles);
    app.get('/list-all/tags', articles.getAllTags);
    app.put('/article/update/:id', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.updateArticle)
    app.delete('/article/delete/:id', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.deleteArticle)
};
