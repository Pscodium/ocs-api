const db = require('../../../config/sequelize');

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.createMonth = async function(req, res) {
    try {
        const userId = req.userId
        const monthData = req.body;

        if (!monthData.monthKey) {
            return res.status(400).json({ error: 'monthKey é obrigatório' });
        }

        // Validar formato monthKey (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(monthData.monthKey)) {
            return res.status(400).json({ error: 'monthKey deve estar no formato YYYY-MM' });
        }

        const existing = await db.Month.findOne({
            where: {
                userId: userId,
                month_key: monthData.monthKey
            }
        });

        if (existing) {
            return res.status(204).json({ message: 'Mês já existe' });
        }

        await db.Month.create({
            month_key: monthData.monthKey,
            data: JSON.stringify(monthData),
            UserId: userId
        });

        return res.status(201).json(monthData);
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
exports.getMonths = async function(req, res) {
    try {
        const userId = req.userId
        
        const result = await db.Month.findAll({
            where: {
                userId: userId
            },
            order: [['month_key', 'DESC']]
        });

        const months = result.map(row => JSON.parse(row.data));

        return res.json(months);
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
exports.updateMonth = async function(req, res) {
    try {
        const userId = req.userId
        const { monthKey } = req.params
        const monthData = req.body;

        const result = await db.Month.update(
            { data: JSON.stringify(monthData) },
            {
                where: {
                    month_key: monthKey,
                    userId: userId
                }
            }
        );

        if (result.length === 0) {
            return res.status(404).json({ error: 'Mês não encontrado' });
        }

        const month = await db.Month.findOne({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        return res.json(JSON.parse(month.data));
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.getMonthByKey = async function(req, res) {
    try {
        const userId = req.userId
        const { monthKey } = req.params;

        const month = await db.Month.findOne({
            where: {
                month_key: monthKey,
                userId: userId
            }
        });

        if (!month) {
            return res.status(404).json({ error: 'Mês não encontrado' });
        }

        return res.json(JSON.parse(month.data));
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
exports.apiHealthCheck = async function(req, res) {
    return res.json({ status: 'ok' });
}