/* eslint-disable no-sync */
/* eslint-disable no-unused-vars */
require('dotenv').config();
const pre_sync_database = process.env.PRE_SYNC_DATABASE;
const disabled_logs = process.env.DISABLED_LOGS;
const fs = require('fs');
const path = require('path');
const { Sequelize, ModelStatic, Model } = require('sequelize');
const logger = require('../services/logs.service');
const enums = require('./enums/index');

const modelsDir = path.join(__dirname, 'models');

/**
 * @typedef {object} dbProps
 * @property {Sequelize} sequelize
 * @property {import('./enums/index').enums} enums
 *
 * @typedef {Object.<string, ModelStatic<Model<any, any>>>} models
 *
 * @typedef {dbProps & models} db
 */

/**
 *
 * @param {Sequelize} sequelize
 * @returns {db}
 */
function createDbObject() {
    return {
        sequelize: null,
        enums: enums
    };
}

class DatabaseInstance {
    constructor(props) {
        this.db = createDbObject();
        this.newSequelizeConnection(props.sync);
    }

    newSequelizeConnection(sync) {
        const sequelize = new Sequelize(String(process.env.DB_NAME), String(process.env.DB_USER), String(process.env.DB_PASSWORD), {
            host: process.env.DB_HOST,
            port: String(process.env.DB_PORT),
            dialect: 'mysql',
            logging: false
        });
        this.db.sequelize = sequelize;

        fs.readdirSync(modelsDir)
            .filter(file => file.endsWith('.js'))
            // import model files and save model names
            .forEach((file) => {
                let modelName = null;

                const model = require(path.join(modelsDir, file))(sequelize);
                modelName = model.name;
                this.db[modelName] = model;
            });

        Object.keys(this.db).forEach(modelName => {
            // eslint-disable-next-line no-prototype-builtins
            if (this.db[modelName] && this.db[modelName].hasOwnProperty('options') && this.db[modelName].options.hasOwnProperty('associate')) {
                this.db[modelName].options.associate(this.db);
            }
        });

        if (sync) {
            this.synchronize();
        } else {
            this.resetSync();
        }
    }

    synchronize() {
        this.db.sequelize.sync({ force: false, alter: true, logging: false }).then(() => {
            if (!disabled_logs) {
                console.log(logger.available("All tables have been synchronized."));
            }
        });
    }

    resetSync() {
        this.db.sequelize.sync({ force: true, alter: true, logging: false }).then(() => {
            if (!disabled_logs) {
                console.log(logger.available("All tables have been synchronized."));
            }
        });
    }
}

exports.DatabaseInstance = DatabaseInstance;