
module.exports = function routeInitialization(app, authenticate) {
    require('./user.routes').init(app, authenticate);
    require('./articles.routes').init(app, authenticate);
    require('./images.routes').init(app, authenticate);
    return app;
};

