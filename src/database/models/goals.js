const { DataTypes } = require("sequelize");

/**
 * @typedef Goal
 * @type {object}
 * @property {string} id
 * @property {string} month_key
 * @property {string} name
 * @property {number} target_amount
 * @property {number} current_amount
 * @property {Date} deadline
 * @property {string} category
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function Goal(sequelize) {
    const Goal = sequelize.define("Goal", {
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
        target_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            field: 'targetAmount'
        },
        current_amount: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
            field: 'currentAmount'
        },
        deadline: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        category: {
            type: DataTypes.ENUM('emergency', 'purchase', 'vacation', 'education', 'retirement', 'other'),
            allowNull: false
        }
    }, {
        tableName: "goals",
        associate: function(models) {
            Goal.belongsTo(models.Users, {
                onDelete: "cascade"
            });
        }
    });

    return Goal;
};
