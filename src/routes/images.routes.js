const images = require("../controllers/images.controller");
const enums = require("../database/enums/index");
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 *
 * @param {import('../index')} app
 * @param {import('../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.post('/image/upload', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL]), upload.single('media'), images.imageUpload)
    app.delete('/image/delete/:id', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MASTER_ADMIN_LEVEL]), images.imageDelete);
    app.get('/images', images.getImages);
};
