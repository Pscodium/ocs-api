
const jwt = require('jsonwebtoken');
const db = require('../config/sequelize');
const moment = require('moment');
const permissionsService = require('../services/permissions.service');
const { lResCleaner } = require('../services/request.service');
const { serialize } = require('cookie');
require('dotenv').config();

class AuthService {

    /**
    *
    * @param {Request} req
    * @param {Response} req
    */
    async register(req, res) {
        try {
            const body = req.body;
            const userExists = await db.Users.findOne({ where: { email: req.body.email } });
            if (userExists) {
                return res.status(409).json({ message: "Email already exists." });
            }
            const userNicknameExists = await db.Users.findOne({ where: { nickname: req.body.nickname } });
            if (userNicknameExists) {
                return res.status(409).json({ message: "Nickname already exists." });
            }
            const passwordValidate = await db.Users.passwordValidate(body.password);
            if (!passwordValidate) {
                return res.status(400).json({ message: "Missing password requirements" });
            }
            const passwordHashed = db.Users.encryptPassword(body.password);

            const permissions = await db.Permissions.create();
            const user = await db.Users.create({
                email: body.email,
                firstName: body.firstName,
                lastName: body.lastName,
                nickname: body.nickname,
                password: passwordHashed,
            });
            await user.setPermission(permissions);
            await permissions.save();
            await permissions.setUser(user);
            await user.save();

            delete user.dataValues.password;

            return res.json(user);
        } catch (err) {
            console.error(err);
            return res.status(404).json({ success: false, message: "Error creating user. Verify request body to validate this error." });
        }
    }

    /**
    *
    * @param {import('express').Request} req
    * @param {import('express').Response} res
    */
    async login(req, res) {
        const { origin } = req.headers;
        const { password, email } = req.body;
        try {

            const user = await db.Users.findOne({
                where: { email: email },
                attributes: {
                    exclude: ['PermissionId']
                },
                include: {
                    model: db.Permissions,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'id', 'UserId']
                    }
                }
            });

            if (!user) {
                return res.status(404).json({ Stack: "[AuthenticationError] - E-mail does not exist." });
            }

            const validatePassword = await user.authenticate(password, user.password);
            if (!validatePassword) {
                return res.status(404).json({ success: false });
            }
            await lResCleaner(user.dataValues);

            const sessionExists = await db.Session.findOne({
                where: {
                    userId: user.id,
                    origin
                }
            });

            if (sessionExists) {
                await sessionExists.destroy()
                const session = await db.Session.create({
                    expiration_date: moment().add(3, 'day').valueOf(),
                    jwt: null,
                    UserId: user.id,
                    origin
                });

                const serialized = serialize('token', session.sessionId, {
                    expires: session.expiration_date,
                    domain: process.env.FRONTEND_DOMAIN,
                    secure: true,
                    sameSite: 'none',
                    path: '/'
                });
                res.set('Set-Cookie', serialized);

                user.dataValues.token = session.sessionId;
                return res.json(user);
            }

            const newSession = await db.Session.create({
                expiration_date: moment().add(3, 'day').valueOf(),
                jwt: null,
                UserId: user.id,
                origin
            });

            const serialized = serialize('token', newSession.sessionId, {
                expires: newSession.expiration_date,
                domain: process.env.FRONTEND_DOMAIN,
                secure: true,
                sameSite: 'none',
                path: '/'
            });
            res.set('Set-Cookie', serialized);

            user.dataValues.token = newSession.sessionId;
            return res.json(user);
        } catch (err) {
            return res.status(500).json({ Stack: `[AuthenticateError] - ${err}` });
        }
    }

    /**
    *
    * @param {import('express').Request} req
    * @param {import('express').Response} res
    */
    async unexpiredLogin(req, res) {
        const { password, email } = req.body;
        try {

            const user = await db.Users.findOne({
                where: { email: email },
                attributes: {
                    exclude: ['PermissionId']
                },
                include: {
                    model: db.Permissions,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'id', 'UserId']
                    }
                }
            });

            if (!user) {
                return res.status(404).json({ Stack: "[AuthenticationError] - E-mail does not exist." });
            }

            const validatePassword = await user.authenticate(password, user.password);
            if (!validatePassword) {
                return res.status(404).json({ success: false });
            }
            await lResCleaner(user.dataValues);

            const sessionExists = await db.Session.findOne({
                where: {
                    userId: user.id,
                    origin: process.env.ELECTRON_ORIGIN
                }
            });

            if (sessionExists) {
                await sessionExists.destroy()
                const session = await db.Session.create({
                    expiration_date: moment().add(999, 'day').valueOf(),
                    jwt: null,
                    UserId: user.id,
                    origin: process.env.ELECTRON_ORIGIN
                });

                const serialized = serialize('token', session.sessionId, {
                    expires: session.expiration_date,
                    domain: process.env.FRONTEND_DOMAIN,
                    secure: true,
                    sameSite: 'none',
                    path: '/'
                });
                res.set('Set-Cookie', serialized);

                user.dataValues.token = session.sessionId;
                return res.json(user);
            }

            const newSession = await db.Session.create({
                expiration_date: moment().add(999, 'years').valueOf(),
                jwt: null,
                UserId: user.id,
                origin: process.env.ELECTRON_ORIGIN
            });

            const serialized = serialize('token', newSession.sessionId, {
                expires: newSession.expiration_date,
                domain: process.env.FRONTEND_DOMAIN,
                secure: true,
                sameSite: 'none',
                path: '/'
            });
            res.set('Set-Cookie', serialized);

            user.dataValues.token = newSession.sessionId;
            return res.json(user);
        } catch (err) {
            return res.status(500).json({ Stack: `[AuthenticateError] - ${err}` });
        }
    }

    /**
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async unexpiredLogout(req, res) {
        try {
            const deletedSessions = await db.Session.destroy({
                where: {
                    userId: req.userId,
                    origin: process.env.ELECTRON_ORIGIN
                }
            });
            if (deletedSessions > 0) {
                res.clearCookie('token', {
                    domain: process.env.FRONTEND_DOMAIN,
                    sameSite: 'none',
                    secure: true,
                    path: '/'
                });

                return res.status(200).json({
                    success: true,
                });
            } else {
                return res.status(401).json({ message: "Not Authorized" });
            }
        } catch (err) {
            return res.status(403).json({ message: err.message });
        }
    }

    /**
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async genericLogout(req, res) {
        const { origin } = req.headers;
        try {
            const deletedSessions = await db.Session.destroy({
                where: {
                    userId: req.userId,
                    origin
                }
            });
            if (deletedSessions > 0) {
                res.clearCookie('token', {
                    domain: process.env.FRONTEND_DOMAIN,
                    sameSite: 'none',
                    secure: true,
                    path: '/'
                });

                return res.status(200).json({
                    success: true,
                });
            } else {
                return res.status(401).json({ message: "Not Authorized" });
            }
        } catch (err) {
            return res.status(403).json({ message: err.message });
        }
    }

    /**
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async sessionLogout(req, res) {
        try {
            const deletedSessions = await db.Session.destroy({
                where: {
                    userId: req.userId,
                    origin: process.env.FRONTEND_ORIGIN
                }
            });
            if (deletedSessions > 0) {
                res.clearCookie('token', {
                    domain: process.env.FRONTEND_DOMAIN,
                    sameSite: 'none',
                    secure: true,
                    path: '/'
                });

                return res.status(200).json({
                    success: true,
                });
            } else {
                return res.status(401).json({ message: "Not Authorized" });
            }
        } catch (err) {
            return res.status(403).json({ message: err.message });
        }
    }

    /**
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @param {import('express').NextFunction} next
     */
    async sessionOrJwt(req, res, next) {
        const { authorization, cookie } = req.headers;

        if (!authorization && !cookie) {
            return res.sendStatus(401);
        }

        const token = cookie? cookie.replace("token=", "") : authorization.replace("Bearer", '').trim();
        const tokenLength = token.length;

        if (tokenLength <= 36) {
            try {
                const data = await db.Session.findOne({
                    where: {
                        expiration_date: db.sequelize.literal('expiration_date > NOW()'),
                        sessionId: token
                    }
                });

                if (!data) {
                    return res.status(401).json({ error: "Invalid sessionId." });
                }

                const user = await db.Users.findOne({
                    where: { id: data.UserId },
                    attributes: {
                        exclude: ['password', 'PermissionId']
                    },
                    include:{
                        model: db.Permissions,
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'id', 'UserId']
                        }
                    }
                });
                if (!user) {
                    throw new Error("User not found");
                }

                req.user = user;
                req.userId = user.id;
                req.is_master_admin = user.Permission.master_admin_level;

                return next();

            } catch (err) {
                return res.sendStatus(401);
            }
        } else {
            try {
                const data = jwt.verify(token, String(process.env.JWT_SECRET_KEY));

                const { id } = data;

                const user = await db.Users.findOne({
                    where: { id: id },
                    include: {
                        model: db.Permissions,
                        attributes: {
                            exclude: ['createdAt', 'updatedAt', 'id']
                        }
                    }
                });
                if (!user) {
                    throw new Error("User not found");
                }

                delete user.dataValues.password;

                req.user = user;
                req.userId = id;
                req.is_master_admin = user.Permission.master_admin_level;

                return next();

            } catch (err) {
                return res.sendStatus(401);
            }
        }
    }

    async loggedOrNot(req, res, next) {
        const { authorization, cookie } = req.headers;

        if (!authorization && !cookie) {
            req.user = undefined;
            return next();
        }

        const token = cookie? cookie.replace("token=", "") : authorization.replace("Bearer", '').trim();
        if (!token) {
            req.user = undefined;
            return next();
        }

        try {
            const data = await db.Session.findOne({
                where: {
                    expiration_date: db.sequelize.literal('expiration_date > NOW()'),
                    sessionId: token
                }
            });

            if (!data) {
                req.user = undefined;
                return next();
            }

            const user = await db.Users.findOne({
                where: { id: data.UserId },
                attributes: {
                    exclude: ['password', 'PermissionId']
                },
                include:{
                    model: db.Permissions,
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'id', 'UserId']
                    }
                }
            });
            if (!user) {
                req.user = undefined;
                next();
                throw new Error("User not found");
            }

            req.user = user;
            req.userId = user.id;
            req.is_master_admin = user.Permission.master_admin_level;

            return next();

        } catch (err) {
            req.user = undefined;
            return next();
        }
    }

    /**
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async check(req, res) {
        try {
            if (!req.user) {
                res.clearCookie('token', {
                    domain: process.env.FRONTEND_DOMAIN,
                    sameSite: 'none',
                    secure: true,
                    path: '/'
                });

                return res.sendStatus(401);
            }
            return res.status(200).json(req.user);
        } catch (err) {
            res.clearCookie('token', {
                domain: process.env.FRONTEND_DOMAIN,
                sameSite: 'none',
                secure: true,
                path: '/'
            });
            console.error(err);
            return res.sendStatus(401);
        }
    }

    hasPermissions(permissions) {
        if (!Array.isArray(permissions)) {
            permissions = [permissions];
        }

        return function (req, res, next) {
            if (!req.user) {
                return res.sendStatus(403);
            } else if (req.is_master_admin) {
                return next();
            }
            permissionsService.hasPermissions(req.userId, permissions)
                .then(function (result) {
                    if (result) {
                        return next();
                    }
                    return res.status(401).json({ permissions: "You don't have permissions for use this route." });
                })
                .catch(function (err) {
                    console.error(err);
                    return res.sendStatus(500);
                });
        };
    }
}

module.exports = new AuthService();