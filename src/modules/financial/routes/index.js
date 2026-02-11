module.exports = function routeInitialization(app, auth) {
    require('./financial.routes').init(app, auth);
    return app;
};

