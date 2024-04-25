const doSync = process.env.PRE_SYNC_DATABASE;
const { DatabaseInstance } = require('../database/index');

const options = Object.assign({
    sync: doSync
}, {});

const sequelize = new DatabaseInstance(options);
const db = sequelize.db;
db.instance = sequelize;

module.exports = db;