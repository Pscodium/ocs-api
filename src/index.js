require('dotenv').config();
process.env.PRE_SYNC_DATABASE = true;
const disabled_logs = process.env.DISABLED_LOGS;
const express = require('express');
const { Router } = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const routeInitialization = require('./routes/config');
const logger = require('./services/logs.service');
const { logs } = require('./middleware/logs');
const authentication = require('./middleware/authentication');
const cookieParser = require('cookie-parser');

const app = express();

function start() {
    try {
        const allowedOrigins = [process.env.FRONTEND_ORIGIN];

        const options = {
            origin: String(allowedOrigins),
            credentials: true
        };

        const router = Router();
        const routes = routeInitialization(router, authentication);

        app.use(bodyParser.json());
        app.use(cookieParser());
        app.use(cors(options));
        app.use(!disabled_logs ? logs : null);
        app.use(routes);

        app.listen(process.env.API_PORT);

        if (!disabled_logs) {
            console.log(logger.success("Connection established!"));
        }
    } catch (err) {
        console.error(`[Server Error] - ${err.message}`);
    }
}

start();
exports.start = start;
module.exports = app;