
/**
 *
 * @param {Request} req
 */
exports.uReqCleaner = async function (req) {
    delete req.body.password;
    delete req.body.email;
    delete req.body.external_id;
    delete req.body.id;
    delete req.body.role;
    delete req.body.createdAt;
    delete req.body.updatedAt;
    delete req.body.PermissionId;
    delete req.body.Permission;
};

/**
 *
 * @param {Request} req
 */
exports.uAdminReqCleaner = async function (req) {
    delete req.body.external_id;
    delete req.body.password;
    delete req.body.id;
    delete req.body.createdAt;
    delete req.body.updatedAt;
    delete req.body.PermissionId;
    delete req.body.Permission;
};


/**
 *
 * @param {object} obj
 * @property {string} password
 */
exports.lResCleaner = async function (obj) {
    delete obj.password;
};