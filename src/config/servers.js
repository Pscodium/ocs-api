require('dotenv').config();
const express = require('express');
const { Router } = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const { logs } = require('../middleware/logs');
const logger = require('../services/logs.service');
const shortenRoutes = require('../modules/shorten/routes');
const financialRoutes = require('../modules/financial/routes')
const authentication = require('../middleware/authentication');

const allowedOrigins = [process.env.FRONTEND_ORIGIN, process.env.ELECTRON_ORIGIN, process.env.FINANCIAL_ORIGIN];
const disabled_logs = process.env.DISABLED_LOGS;

exports.bootstrapServers = function() {
    serverStartup('Shorten Server', process.env.SHORTEN_PORT, true, allowedOrigins, disabled_logs, shortenRoutes, authentication);
    serverStartup('Financial Server', process.env.FINANCIAL_PORT, true, allowedOrigins, disabled_logs, financialRoutes, authentication);
}


const serverSetup = function(hasCookieParser, allowedOrigins = [], disabled_logs = false) {
    const app = express();
    const options = {
        origin: allowedOrigins,
        credentials: true
    };
    app.use(bodyParser.json());
    if (hasCookieParser) {
        app.use(cookieParser());
    }
    app.use(cors(options));
    app.use(!disabled_logs ? logs : null);
    const router = Router();

    return { app, router };
}


function serverStartup(serverName, port, hasCookieParser, allowedOrigins = [], disabled_logs = false, routesCallback, auth) {
    const { app, router } = serverSetup(hasCookieParser, allowedOrigins, disabled_logs);
    const routes = routesCallback(router, auth);

    app.use(routes);
    app.listen(port, () => {
        if (!disabled_logs) {
            console.log(logger.available(`🚀 ${serverName} is running on port ${port}`));
        }
    })
}