const { DataTypes } = require("sequelize");

/**
 * @typedef Month
 * @type {object}
 * @property {string} id
 * @property {string} month_key
 * @property {object} data
 * @property {number} created_at
 * @property {number} updated_at
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function Month(sequelize) {
    const Month = sequelize.define("Month", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
        },
        month_key: {
            type: DataTypes.STRING(7),
            allowNull: false,
            field: 'monthKey'
        },
        data: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        tableName: "month",
        associate: function(models) {
            Month.belongsTo(models.Users, {
                onDelete: "cascade"
            });
        }
    });


    return Month;
};
