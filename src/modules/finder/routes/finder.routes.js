const finder = require('../controllers/finder.controller');
const { apiKeyValidator } = require('../middleware/api-key.middleware');

/**
 *
 * @param {import('express').Express} app
 * @param {import('../../../middleware/authentication')} auth
 */
exports.init = function(app, _auth) {
	app.get('/establishments', apiKeyValidator, finder.getEstablishments);
	app.get('/establishments/:id', apiKeyValidator, finder.getEstablishmentById);
	app.post('/establishments', apiKeyValidator, finder.createEstablishment);
	app.patch('/establishments/:id', apiKeyValidator, finder.updateEstablishment);
	app.put('/establishments/:id', apiKeyValidator, finder.updateEstablishment);
	app.delete('/establishments/:id', apiKeyValidator, finder.deleteEstablishment);

	app.post('/establishments/:id/products', apiKeyValidator, finder.createProduct);
	app.patch('/establishments/:id/products/:productId', apiKeyValidator, finder.updateProduct);
	app.put('/establishments/:id/products/:productId', apiKeyValidator, finder.updateProduct);
	app.delete('/establishments/:id/products/:productId', apiKeyValidator, finder.deleteProduct);

	app.get('/products/categories', apiKeyValidator, finder.getAllProductCategories);
	app.get('/establishments/product-categories', apiKeyValidator, finder.getAllProductCategories);
	app.get('/geocode/reverse', apiKeyValidator, finder.reverseGeocode);

	// Legacy routes (backward compatibility)
	app.get('/finder/establishments', apiKeyValidator, finder.getEstablishments);
	app.get('/finder/establishments/:id', apiKeyValidator, finder.getEstablishmentById);
	app.post('/finder/establishments', apiKeyValidator, finder.createEstablishment);
	app.patch('/finder/establishments/:id', apiKeyValidator, finder.updateEstablishment);
	app.put('/finder/establishments/:id', apiKeyValidator, finder.updateEstablishment);
	app.delete('/finder/establishments/:id', apiKeyValidator, finder.deleteEstablishment);

	app.get('/finder/establishments/:establishmentId/products', apiKeyValidator, finder.getProductsByEstablishment);
	app.post('/finder/establishments/:establishmentId/products', apiKeyValidator, finder.createProduct);
	app.patch('/finder/products/:id', apiKeyValidator, finder.updateProduct);
	app.put('/finder/products/:id', apiKeyValidator, finder.updateProduct);
	app.delete('/finder/products/:id', apiKeyValidator, finder.deleteProduct);
};
