
const { createRemoteJWKSet, jwtVerify } = require('jose');
require('dotenv').config();

const authIssuer = process.env.AUTH_ISSUER || 'http://localhost:3000';
const authAudience = process.env.AUTH_AUDIENCE || 'api://default';
const authJwksUrl = process.env.AUTH_JWKS_URL || `${authIssuer}/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(authJwksUrl));

async function validateAccessToken(token) {
    const { payload } = await jwtVerify(token, jwks, {
        issuer: authIssuer,
        audience: authAudience
    });

    return payload;
}

function getBearerToken(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return null;
    }

    return auth.slice('Bearer '.length).trim();
}

function normalizeRoles(roles) {
    if (!roles) {
        return [];
    }

    if (Array.isArray(roles)) {
        return roles;
    }

    return [String(roles)];
}

class AuthService {
    /**
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @param {import('express').NextFunction} next
     */
    async sessionOrJwt(req, res, next) {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({ error: 'unauthorized' });
        }

        try {
            const payload = await validateAccessToken(token);

            req.userId = payload.sub;
            req.userExternalId = payload.sub;
            req.auth = {
                roles: normalizeRoles(payload.roles),
                clientId: payload.client_id
            };
            req.user = {
                id: payload.sub,
                roles: req.auth.roles,
                clientId: req.auth.clientId
            };
            req.is_master_admin = req.auth.roles.includes('admin');

            return next();
        } catch (err) {
            return res.status(401).json({ error: 'invalid_token' });
        }
    }

    async loggedOrNot(req, res, next) {
        const token = getBearerToken(req);
        console.log('entra aqui ', token)
        if (!token) {
            req.user = undefined;
            return next();
        }

        try {
            const payload = await validateAccessToken(token);

            req.userId = payload.sub;
            req.userExternalId = payload.sub;
            req.auth = {
                roles: normalizeRoles(payload.roles),
                clientId: payload.client_id
            };
            req.user = {
                id: payload.sub,
                roles: req.auth.roles,
                clientId: req.auth.clientId
            };
            req.is_master_admin = req.auth.roles.includes('admin');

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
                return res.status(401).json({ error: 'unauthorized' });
            }
            return res.status(200).json({
                userId: req.userId,
                roles: (req.auth && req.auth.roles) || [],
                clientId: req.auth ? req.auth.clientId : undefined
            });
        } catch (err) {
            console.error(err);
            return res.status(401).json({ error: 'unauthorized' });
        }
    }

    hasPermissions(permissions) {
        if (!Array.isArray(permissions)) {
            permissions = [permissions];
        }

        return function (req, res, next) {
            const roles = (req.auth && Array.isArray(req.auth.roles)) ? req.auth.roles : [];

            if (!req.user || roles.length === 0) {
                return res.sendStatus(403);
            } else if (roles.includes('admin')) {
                return next();
            }

            const hasAll = permissions.every(permission => roles.includes(permission));
            if (hasAll) {
                return next();
            }

            return res.status(401).json({ permissions: "You don't have permissions for use this route." });
        };
    }
}

module.exports = new AuthService();