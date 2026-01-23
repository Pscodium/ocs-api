
module.exports = function routeInitialization(app, authenticate) {
    require('./user.routes').init(app, authenticate);
    require('./articles.routes').init(app, authenticate);
    require('./storage.routes').init(app, authenticate);
    return app;
};

