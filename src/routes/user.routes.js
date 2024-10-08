const users = require("../controllers/user.controller");
const enums = require("../database/enums/index");

/**
 *
 * @param {import('../index')} app
 * @param {import('../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.post('/register', auth.register);
    app.post('/login', auth.login);
    app.post('/electron/login', auth.unexpiredLogin);
    app.get('/check/auth', auth.sessionOrJwt, auth.check);
    app.get('/logout', auth.sessionOrJwt, auth.sessionLogout);
    app.get('/data/user', auth.sessionOrJwt, users.getUserData);
    app.get('/users', auth.sessionOrJwt, users.getUsers);
    app.get('/user/:id', auth.sessionOrJwt, users.getUserById);
    app.get('/user/profile/:nickname', users.getUserByNickname);
    app.delete('/user/:id', auth.sessionOrJwt, users.deleteUser);
    app.put('/user/update', auth.sessionOrJwt, users.userUpdateAccountInfo);
    app.put('/user/update/:id', auth.sessionOrJwt, auth.hasPermissions([enums.Permissions.MANAGE_USERS, enums.Permissions.CAN_MANAGE_ROLES]), users.updateUserById);
};
