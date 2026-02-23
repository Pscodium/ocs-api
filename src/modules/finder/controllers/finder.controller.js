const db = require('../../../config/sequelize');

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.getEstablishments = async function(req, res) {
    try {
        const establishments = await db.Establishments.findAll({
            include: [{
                model: db.EstablishmentProducts,
                as: 'produtos'
            }],
            order: [
                ['id', 'ASC'],
                [{ model: db.EstablishmentProducts, as: 'produtos' }, 'id', 'ASC']
            ]
        });

        return res.status(200).json(establishments);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.getEstablishmentById = async function(req, res) {
    try {
        const { id } = req.params;

        const establishment = await db.Establishments.findByPk(id, {
            include: [{
                model: db.EstablishmentProducts,
                as: 'produtos'
            }],
            order: [[{ model: db.EstablishmentProducts, as: 'produtos' }, 'id', 'ASC']]
        });

        if (!establishment) {
            return res.status(404).json({ error: 'Estabelecimento não encontrado' });
        }

        return res.status(200).json(establishment);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.createEstablishment = async function(req, res) {
    try {
        const payload = req.body;

        if (!payload.id || !payload.nome || payload.latitude == null || payload.longitude == null) {
            return res.status(400).json({ error: 'id, nome, latitude e longitude são obrigatórios' });
        }

        const exists = await db.Establishments.findByPk(payload.id);
        if (exists) {
            return res.status(409).json({ error: 'Estabelecimento já existe' });
        }

        const establishment = await db.Establishments.create({
            id: payload.id,
            nome: payload.nome,
            latitude: payload.latitude,
            longitude: payload.longitude,
            categoria: payload.categoria,
            endereco: payload.endereco,
            telefone: payload.telefone
        });

        return res.status(201).json(establishment);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.updateEstablishment = async function(req, res) {
    try {
        const { id } = req.params;
        const payload = req.body;

        const establishment = await db.Establishments.findByPk(id);
        if (!establishment) {
            return res.status(404).json({ error: 'Estabelecimento não encontrado' });
        }

        await establishment.update({
            nome: payload.nome ?? establishment.nome,
            latitude: payload.latitude ?? establishment.latitude,
            longitude: payload.longitude ?? establishment.longitude,
            categoria: payload.categoria ?? establishment.categoria,
            endereco: payload.endereco ?? establishment.endereco,
            telefone: payload.telefone ?? establishment.telefone
        });

        return res.status(200).json(establishment);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.deleteEstablishment = async function(req, res) {
    try {
        const { id } = req.params;

        const deleted = await db.Establishments.destroy({
            where: { id: id }
        });

        if (!deleted) {
            return res.status(404).json({ error: 'Estabelecimento não encontrado' });
        }

        return res.sendStatus(204);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.getProductsByEstablishment = async function(req, res) {
    try {
        const { establishmentId } = req.params;

        const products = await db.EstablishmentProducts.findAll({
            where: { establishmentId: establishmentId },
            order: [['id', 'ASC']]
        });

        return res.status(200).json(products);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.createProduct = async function(req, res) {
    try {
        const { establishmentId } = req.params;
        const payload = req.body;

        if (!payload.id || !payload.nome || payload.preco == null) {
            return res.status(400).json({ error: 'id, nome e preco são obrigatórios' });
        }

        const establishment = await db.Establishments.findByPk(establishmentId);
        if (!establishment) {
            return res.status(404).json({ error: 'Estabelecimento não encontrado' });
        }

        const exists = await db.EstablishmentProducts.findByPk(payload.id);
        if (exists) {
            return res.status(409).json({ error: 'Produto já existe' });
        }

        const product = await db.EstablishmentProducts.create({
            id: payload.id,
            establishmentId: Number(establishmentId),
            nome: payload.nome,
            descricao: payload.descricao,
            categoria: payload.categoria,
            preco: payload.preco,
            imagem: payload.imagem
        });

        return res.status(201).json(product);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.updateProduct = async function(req, res) {
    try {
        const { id } = req.params;
        const payload = req.body;

        const product = await db.EstablishmentProducts.findByPk(id);
        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        await product.update({
            nome: payload.nome ?? product.nome,
            descricao: payload.descricao ?? product.descricao,
            categoria: payload.categoria ?? product.categoria,
            preco: payload.preco ?? product.preco,
            imagem: payload.imagem ?? product.imagem
        });

        return res.status(200).json(product);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.deleteProduct = async function(req, res) {
    try {
        const { id } = req.params;

        const deleted = await db.EstablishmentProducts.destroy({
            where: { id: id }
        });

        if (!deleted) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        return res.sendStatus(204);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};
