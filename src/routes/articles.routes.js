const articles = require("../controllers/articles.controller");
const enums = require("../database/enums/index");

/**
 *
 * @param {import('../index')} app
 * @param {import('../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.post('/article/create/:categoryId/:subCategoryId', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.create);
    app.post('/article/create/:categoryId', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.create);
    app.post('/category', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.createCategory);
    app.post('/sub/category/:categoryId', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.createSubCategory);
    app.get('/categories', articles.getAllCategories);
    app.put('/article/:articleId', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.updateArticle);
    app.delete('/article/:id', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.deleteArticle);
    app.delete('/category/:categoryId', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.deleteCategory);
    app.delete('/sub/category/:subCategoryId', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL, enums.Permissions.CAN_POST]), articles.deleteSubCategory);
};
