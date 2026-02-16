/* eslint-disable no-prototype-builtins */
require('dotenv').config();
process.env.PRE_SYNC_DATABASE = false;

const db = require('../../config/sequelize');
const logger = require('../../services/logs.service');

async function load() {

    const reseted = await restartDb();
    if (reseted) {
        console.log(logger.success('\n\nDatabase sucessfully loaded...'));
        process.exit(0);
    }
}




async function restartDb() {
    try {
        (async () => {
            try {
                await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

                const models = Object.values(db.sequelize.models);

                await Promise.all(models.map(async (model) => {
                    try {
                        await model.destroy({ where: {} });
                    } catch (err) {
                        console.log(logger.alert(`Error deleting the contents of the ${model.tableName} table.\nError: ${err}`));
                    }
                }));

                await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');


                console.log(logger.success('Data successfully cleared.'));
            } catch (error) {
                console.error(`Error when cleaning tables ${error}`);
            }
        })();

        console.log(logger.success("Connection established!"));
        return true;


    } catch (err) {
        if (err.name === 'SequelizeDatabaseError' && err.parent && err.parent.code === 'ER_LOCK_DEADLOCK') {
            console.log(logger.warning('Deadlock detected. Trying again...'));
        } else {
            console.error(logger.alert('Error when resetting the database:', err.message));
        }
    }

}



load().then(() => {
    console.log("Pre load database completed! \n\n");
    process.exit(0);
})
    .catch((err) => {
        console.log(err);
        process.exit(1);
    });

