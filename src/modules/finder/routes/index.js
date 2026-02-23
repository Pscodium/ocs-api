module.exports = function routeInitialization(app, auth) {
    require('./finder.routes').init(app, auth);
    return app;
};