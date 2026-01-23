require('dotenv').config();
process.env.PRE_SYNC_DATABASE = true;
const disabled_logs = process.env.DISABLED_LOGS;
const express = require('express');
const { Router } = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');

const routeInitialization = require('./routes');
const logger = require('./services/logs.service');
const { logs } = require('./middleware/logs');
const authentication = require('./middleware/authentication');
const cookieParser = require('cookie-parser');
const { bootstrapServers } = require('./config/servers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [process.env.FRONTEND_ORIGIN, process.env.ELECTRON_ORIGIN],
        credentials: true
    }
});

app.set('io', io);

function start() {
    try {
        const allowedOrigins = [process.env.FRONTEND_ORIGIN, process.env.ELECTRON_ORIGIN];

        const options = {
            origin: allowedOrigins,
            credentials: true
        };

        const router = Router();
        const routes = routeInitialization(router, authentication);

        app.use(bodyParser.json());
        app.use(cookieParser());
        app.use(cors(options));
        app.use(!disabled_logs ? logs : null);
        app.use(routes);

        io.on('connection', (socket) => {
            if (!disabled_logs) {
                console.log(logger.success(`Socket connected: ${socket.id}`));
            }
            
            socket.on('disconnect', () => {
                if (!disabled_logs) {
                    console.log(logger.warning(`Socket disconnected: ${socket.id}`));
                }
            });
        });

        server.listen(process.env.API_PORT, () => {
            if (!disabled_logs) {
                console.log(logger.success("Connection established!"));
                console.log(logger.available(`Server running on port ${process.env.API_PORT}`));
                bootstrapServers();
            }
        });
    } catch (err) {
        console.error(`[Server Error] - ${err.message}`);
    }
}

start();
exports.start = start;
module.exports = app;