const storage = require("../controllers/storage.controller");
const enums = require("../database/enums/index");
const multer = require('multer');

const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

/**
 *
 * @param {import('../index')} app
 * @param {import('../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.post('/storage/upload/:folderId', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL]), upload.array('media', 50), storage.fileUpload)
    app.delete('/storage/delete/:id/folder/:folderId', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL]), storage.deleteFile);
    app.post('/storage/delete/bulk', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL]), storage.deleteMultipleFiles);
    app.post('/storage/folders/create', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL]), storage.createFolder);
    app.delete('/storage/folders/delete/:id', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL]), storage.deleteFolder);
    app.get('/proxy', storage.proxy)
    app.get('/storage/folders', auth.loggedOrNot, storage.getFolders);
    app.get('/storage/files', auth.loggedOrNot, storage.getFiles);
};
