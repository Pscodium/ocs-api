require('dotenv').config();
const redis = require('../../../config/redis.js');

const { nanoid } = require('nanoid');

const TTL_12_DAYS = 60 * 60 * 24 * 12;

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.shortenUrl = async function(req, res) {
    try {
        const { url } = req.body

        if (!url) {
            return res.status(400).json({ error: "URL é obrigatória" })
        }

        const code = nanoid(6)

        await redis.hSet(`url:${code}`, {
            original: url,
            clicks: '0',
            userId: String(req.userId),
            createdAt: String(Date.now())
        })

        await redis.expire(`url:${code}`, TTL_12_DAYS)

        return res.json({
            shortUrl: `${process.env.SHORTEN_BASE_URL}/${code}`
        })
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.redirectUrl = async function(req, res) {
    try {
        const { code } = req.params

        const data = await redis.hGetAll(`url:${code}`)

        if (!data?.original) {
            return res.status(404).json({ error: "URL não encontrada" })
        }

        await redis.hIncrBy(`url:${code}`, "clicks", 1)

        return res.redirect(data.original)
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * Retorna todos os links ativos de um usuário (paginado)
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.getUserUrls = async function(req, res) {
    try {
        const userId = String(req.userId)
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 10

        if (!userId) {
            return res.status(401).json({ error: "Usuário não autenticado" })
        }

        if (page < 1 || limit < 1) {
            return res.status(400).json({ error: "Page e limit devem ser maiores que 0" })
        }

        const userUrls = []
        let cursor = '0'

        do {
            const result = await redis.scan(cursor, {
                MATCH: 'url:*',
                COUNT: '100'
            })

            cursor = String(result.cursor)
            const keys = result.keys

            for (const key of keys) {
                const data = await redis.hGetAll(key)
                
                // Filtra apenas os links do usuário
                if (data?.userId === userId) {
                    const code = key.replace('url:', '')
                    userUrls.push({
                        code,
                        original: data.original,
                        shortUrl: `${process.env.SHORTEN_BASE_URL}/${code}`,
                        clicks: parseInt(data.clicks) || 0,
                        createdAt: parseInt(data.createdAt)
                    })
                }
            }
        } while (cursor !== '0')

        // Calcula paginação
        const totalItems = userUrls.length
        const totalPages = Math.ceil(totalItems / limit)
        const skip = (page - 1) * limit
        const paginatedUrls = userUrls.slice(skip, skip + limit)

        return res.json({
            data: paginatedUrls,
            page,
            totalPages,
            totalItems
        })
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

/**
 * Remove um link curto do usuário autenticado
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.removeUserUrl = async function(req, res) {
    try {
        const userId = String(req.userId)
        const { code } = req.params

        if (!userId) {
            return res.status(401).json({ error: "Usuário não autenticado" })
        }

        if (!code) {
            return res.status(400).json({ error: "Código é obrigatório" })
        }

        const key = `url:${code}`
        const data = await redis.hGetAll(key)

        if (!data?.original) {
            return res.status(404).json({ error: "URL não encontrada" })
        }

        if (data.userId !== userId) {
            return res.status(403).json({ error: "URL não pertence ao usuário" })
        }

        await redis.del(key)

        return res.sendStatus(204)
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

