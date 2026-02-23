const finder = require('../controllers/finder.controller');

/**
 *
 * @param {import('express').Express} app
 * @param {import('../../../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
	app.get('/finder/establishments', auth.sessionOrJwt, finder.getEstablishments);
	app.get('/finder/establishments/:id', auth.sessionOrJwt, finder.getEstablishmentById);
	app.post('/finder/establishments', auth.sessionOrJwt, finder.createEstablishment);
	app.put('/finder/establishments/:id', auth.sessionOrJwt, finder.updateEstablishment);
	app.delete('/finder/establishments/:id', auth.sessionOrJwt, finder.deleteEstablishment);

	app.get('/finder/establishments/:establishmentId/products', auth.sessionOrJwt, finder.getProductsByEstablishment);
	app.post('/finder/establishments/:establishmentId/products', auth.sessionOrJwt, finder.createProduct);
	app.put('/finder/products/:id', auth.sessionOrJwt, finder.updateProduct);
	app.delete('/finder/products/:id', auth.sessionOrJwt, finder.deleteProduct);
};
