/* eslint-disable prefer-const */
const db = require('../config/sequelize');
const { uReqCleaner, uAdminReqCleaner } = require('../services/request.service');
require('dotenv').config();

exports.getUserData = async (req, res) => {
    try {
        const user = await db.Users.findOne({
            where: {
                id: req.userId
            },
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
            return res.status(404).json({ success: false });
        }

        const session = await db.Session.findOne({
            where: {
                userId: req.userId
            }
        });

        if (!session) {
            return res.status(403).json({ success: false });
        }

        user.dataValues.token = session.sessionId;

        if (session.jwt) {
            user.dataValues.token = session.jwt;
        }

        return res.json(user);
    } catch (err) {
        console.error(err);
        return res.status(401).json({ success: false });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const query = req.query;
        const page = query.page;
        let includePerm = {
            model: db.Permissions,
            attributes: {
                exclude: ['id', 'UserId']
            }
        };
        let queryObj = {
            include: [
                includePerm
            ],
            attributes: {
                exclude: ['password', 'PermissionId']
            }
        };

        if (!req.is_master_admin) {
            includePerm.attributes.exclude.push('master_admin_level');
        }

        if (page) {
            const maxResults = query.limit || 10;
            const offset = page * maxResults;

            queryObj.limit = maxResults;
            queryObj.offset = offset;
        }

        if (queryObj) {
            const users = await db.Users.findAll(queryObj);

            return res.status(200).json(users);
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.Users.findOne({
            where: {
                id: id
            },
            attributes: {
                exclude: ['password', 'PermissionId']
            }
        });
        if (!user) {
            return res.status(404).json({ success: false });
        }
        return res.status(200).json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false });
    }
};

exports.getUserByNickname = async (req, res) => {
    try {
        const { nickname } = req.params;

        const user = await db.Users.findOne({
            where: {
                nickname: nickname
            },
            attributes: {
                exclude: ['password', 'PermissionId']
            }
        });
        if (!user) {
            return res.status(404).json({ success: false });
        }
        return res.status(200).json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false });
    }
};

exports.userUpdateAccountInfo = async (req, res) => {
    try {
        const user = await db.Users.findOne({
            where: { id: req.userId }
        });
        if (!user) {
            return res.status(404).json({ success: false });
        }
        await uReqCleaner(req);
        await db.Users.update(req.body, {
            where: {
                id: req.userId
            }
        });

        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false });
    }
};

exports.updateUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await db.Users.findOne({
            where: { id }
        });
        if (!user) {
            return res.status(404).json({ success: false });
        }
        await uAdminReqCleaner(req);
        await db.Users.update(req.body, {
            where: {
                id: id
            }
        });

        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.Users.findOne({
            where: { id }
        });
        if (!user) {
            return res.status(404).json({ success: false });
        }
        await db.Permissions.destroy({
            where: { id: user.PermissionId }
        });
        await db.Users.destroy({
            where: { id }
        });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false });
    }
};
