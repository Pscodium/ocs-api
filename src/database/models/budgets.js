const { DataTypes } = require("sequelize");

/**
 * @typedef Budget
 * @type {object}
 * @property {string} id
 * @property {string} month_key
 * @property {string} category_id
 * @property {string} category_name
 * @property {number} limit
 * @property {number} spent
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function Budget(sequelize) {
    const Budget = sequelize.define("Budget", {
        id: {
            type: DataTypes.STRING(50),
            primaryKey: true
        },
        month_key: {
            type: DataTypes.STRING(7),
            allowNull: false,
            field: 'monthKey'
        },
        category_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'categoryId'
        },
        category_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'categoryName'
        },
        limit: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        spent: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        }
    }, {
        tableName: "budgets",
        associate: function(models) {
            Budget.belongsTo(models.Users, {
                onDelete: "cascade"
            });
        }
    });

    return Budget;
};
