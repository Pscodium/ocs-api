const db = require('../../../config/sequelize');
const { Sequelize, Op } = require('sequelize');

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
                as: 'products'
            }],
            order: [
                ['id', 'ASC'],
                [{ model: db.EstablishmentProducts, as: 'products' }, 'id', 'ASC']
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
                as: 'products'
            }],
            order: [[{ model: db.EstablishmentProducts, as: 'products' }, 'id', 'ASC']]
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

        if (payload.id != null) {
            return res.status(400).json({ error: 'id não deve ser enviado no payload de criação' });
        }

        if (!payload.name || !payload.category || !payload.description || !payload.address || payload.latitude == null || payload.longitude == null) {
            return res.status(400).json({ error: 'name, category, description, address, latitude e longitude são obrigatórios' });
        }

        const establishmentData = {
            name: payload.name,
            latitude: payload.latitude,
            longitude: payload.longitude,
            category: payload.category,
            description: payload.description,
            address: payload.address
        };

        const establishment = await db.Establishments.create(establishmentData);

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
            name: payload.name ?? establishment.name,
            latitude: payload.latitude ?? establishment.latitude,
            longitude: payload.longitude ?? establishment.longitude,
            category: payload.category ?? establishment.category,
            description: payload.description ?? establishment.description,
            address: payload.address ?? establishment.address
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
        const establishmentId = req.params.establishmentId ?? req.params.id;

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
        const establishmentId = req.params.establishmentId ?? req.params.id;
        const payload = req.body;

        if (payload.id != null) {
            return res.status(400).json({ error: 'id não deve ser enviado no payload de criação' });
        }
        
        if (!payload.name || !payload.category || !payload.description) {
            return res.status(400).json({ error: 'name, category e description são obrigatórios' });
        }

        const establishment = await db.Establishments.findByPk(establishmentId);
        if (!establishment) {
            return res.status(404).json({ error: 'Estabelecimento não encontrado' });
        }

        const product = await db.EstablishmentProducts.create({
            establishmentId,
            name: payload.name,
            description: payload.description,
            category: payload.category,
            stock: payload.stock ?? null
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
        const establishmentId = req.params.establishmentId ?? req.params.id;
        const productId = req.params.productId ?? req.params.id;
        const payload = req.body;

        const where = { id: productId };
        if (req.params.productId) {
            where.establishmentId = establishmentId;
        }

        const product = await db.EstablishmentProducts.findOne({ where });
        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        await product.update({
            name: payload.name ?? product.name,
            description: payload.description ?? product.description,
            category: payload.category ?? product.category,
            stock: payload.stock ?? product.stock
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
        const establishmentId = req.params.establishmentId ?? req.params.id;
        const productId = req.params.productId ?? req.params.id;

        const where = { id: productId };
        if (req.params.productId) {
            where.establishmentId = establishmentId;
        }

        const deleted = await db.EstablishmentProducts.destroy({
            where
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

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns
 */
exports.getAllProductCategories = async function(req, res) {
    try {
        const categories = await db.EstablishmentProducts.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('category')), 'category']],
            where: {
                category: {
                    [Op.ne]: null
                }
            },
            order: [['category', 'ASC']],
            raw: true
        });

        return res.status(200).json(categories.map((item) => item.category).filter(Boolean));
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
exports.reverseGeocode = async function(req, res) {
    try {
        const { lat, lng } = req.query;

        if (lat == null || lng == null) {
            return res.status(400).json({ error: 'lat e lng são obrigatórios' });
        }

        const parsedLat = Number(lat);
        const parsedLng = Number(lng);
        if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
            return res.status(400).json({ error: 'lat e lng devem ser numéricos' });
        }

        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${parsedLat}&lon=${parsedLng}`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ocs-api/1.0'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Falha no serviço de geocoding reverso' });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
};

exports.fetchEstablishments = exports.getEstablishments;
exports.fetchEstablishmentById = exports.getEstablishmentById;
exports.addProduct = exports.createProduct;
