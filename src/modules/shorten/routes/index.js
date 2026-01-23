module.exports = function routeInitialization(app, auth) {
    require('./shorten.routes').init(app, auth);
    return app;
};

