/* eslint-disable no-prototype-builtins */
require('dotenv').config();
process.env.PRE_SYNC_DATABASE = false;

const db = require('../../config/sequelize');
const logger = require('../../services/logs.service');
let addedUsers = 0;

async function load() {

    const reseted = await restartDb();
    if (reseted) {
        await createUser({
            email: 'nexto@email.com',
            firstName: 'Nexto',
            lastName: 'Admin',
            password: '123456',
            nickname: 'NextoAdm',
            isAdmin: true,
            profileIcon: 'https://images7.memedroid.com/images/UPLOADED660/5ea5f78b5cbb1.jpeg',
            bannerProfile: 'https://t.ctcdn.com.br/kC0J0zzhQG39M0iYo3NxtI02pG0=/640x360/smart/i517469.jpeg',
            biography: 'ADMIN CRIA DA COMUNIDADE',
            title: 'ADM FUCKING MASTER'
        });
        await createUser({
            email: 'test@email.com',
            firstName: 'Test',
            lastName: 'Dev',
            password: '123456',
            nickname: 'Tester',
            isAdmin: false,
            profileIcon: 'https://akamai.sscdn.co/letras/215x215/fotos/6/b/5/4/6b54a50864b997103d0416d49da5766b.jpg',
            bannerProfile: 'https://yt3.googleusercontent.com/dsIAou2N-JZS0RvAfgmmMttOzHuqewZJZR-9XoNEO4ATo0-8HXdPtSF5PD1emiDfZUbzACod=s900-c-k-c0x00ffffff-no-rj',
            biography: 'USUÁRIO TESTE SUPREMO',
            title: 'SOU UM USUÁRIO BURRO DE TESTE'
        });


        console.log(logger.changed('Created users on script: ' + addedUsers));
        console.log(logger.success('\n\nDatabase sucessfully loaded...'));
        process.exit(0);
    }
}


/**
 * @typedef {object} UserProps
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} email
 * @property {string} password
 * @property {string} nickname,
 * @property {boolean} isAdmin
 */

/**
 *
 * @param {UserProps} param0
 * @returns
 */
async function createUser({ firstName, lastName, email, password, nickname, isAdmin }) {
    try {
        const passwordHashed = db.Users.encryptPassword(password);

        const permissions = await db.Permissions.create({
            master_admin_level: isAdmin
        });
        const user = await db.Users.create({
            email: email,
            firstName: firstName,
            lastName: lastName,
            nickname: nickname,
            password: passwordHashed,
            PermissionId: permissions.id
        });
        permissions.UserId = user.id;
        await permissions.save();
        addedUsers++;
        return user.id;
    } catch (err) {
        console.error(`[User Registration Error] - ${err}`);
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

