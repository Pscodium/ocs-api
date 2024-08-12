const { DataTypes, UUIDV4 } = require("sequelize");
const bcrypt = require("bcryptjs");
const ENUMS = require("../enums/index");

/**
 * @typedef User
 * @type {object}
 * @property {number} id
 * @property {string} nickname
 * @property {string} external_id
 * @property {ENUMS.UserRoles} role
 * @property {boolean} isActivated
 * @property {string} email
 * @property {string} name
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {(plainText: string) => string} authenticate
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {ModelCtor<Model<any, any>>}
 */
module.exports = function Users(sequelize) {
    const Users = sequelize.define("Users", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
        },
        profileIcon: {
            type: DataTypes.STRING,
            defaultValue: 'https://power.staging.onyo.com/assets/img/placeholder-user.png',
            allowNull: true
        },
        nickname: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                is: /^[a-zA-Z0-9_]+$/
            }
        },
        external_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        role: {
            type: DataTypes.ENUM(ENUMS.values(ENUMS.UserRoles)),
            defaultValue: ENUMS.UserRoles.DEFAULT,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM(ENUMS.values(ENUMS.UserStatus)),
            defaultValue: ENUMS.UserStatus.ACTIVE,
            allowNull: true
        },
        firstName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lastName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        verifiedEmail: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: "users",
        associate: function (models) {
            Users.belongsTo(models.Permissions);
        }
    });

    Users.encryptPassword = function (password) {
        // eslint-disable-next-line no-sync
        this.password = bcrypt.hashSync(password, 8);
        return this.password;
    };

    Users.passwordValidate = async function (password) {
        const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/g;
        return regex.test(password);
    };

    Users.prototype.authenticate = async function (requestPassword, currentPassword) {
        return await bcrypt.compare(requestPassword, currentPassword);
    };

    return Users;
};
