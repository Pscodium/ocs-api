const finder = require('../controllers/finder.controller');
const { apiKeyValidator } = require('../middleware/api-key.middleware');

/**
 *
 * @param {import('express').Express} app
 * @param {import('../../../middleware/authentication')} auth
 */
exports.init = function(app, _auth) {
	app.get('/finder/establishments', apiKeyValidator, finder.getEstablishments);
	app.get('/finder/establishments/:id', apiKeyValidator, finder.getEstablishmentById);
	app.post('/finder/establishments', apiKeyValidator, finder.createEstablishment);
	app.put('/finder/establishments/:id', apiKeyValidator, finder.updateEstablishment);
	app.delete('/finder/establishments/:id', apiKeyValidator, finder.deleteEstablishment);

	app.get('/finder/establishments/:establishmentId/products', apiKeyValidator, finder.getProductsByEstablishment);
	app.post('/finder/establishments/:establishmentId/products', apiKeyValidator, finder.createProduct);
	app.put('/finder/products/:id', apiKeyValidator, finder.updateProduct);
	app.delete('/finder/products/:id', apiKeyValidator, finder.deleteProduct);
};
