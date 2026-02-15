const { DataTypes } = require("sequelize");

/**
 * @typedef Investment
 * @type {object}
 * @property {string} id
 * @property {string} month_key
 * @property {string} name
 * @property {string} type
 * @property {number} amount
 * @property {number} current_value
 * @property {Date} purchase_date
 * @property {string} notes
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function Investment(sequelize) {
    const Investment = sequelize.define("Investment", {
        id: {
            type: DataTypes.STRING(50),
            primaryKey: true
        },
        month_key: {
            type: DataTypes.STRING(7),
            allowNull: false,
            field: 'monthKey'
        },
        name: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('stocks', 'funds', 'crypto', 'savings', 'real-estate', 'other'),
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        current_value: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            field: 'currentValue'
        },
        purchase_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            field: 'purchaseDate'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: "investments",
        associate: function(models) {
            Investment.belongsTo(models.Users, {
                onDelete: "cascade"
            });
        }
    });

    return Investment;
};
