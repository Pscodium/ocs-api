const { DataTypes } = require("sequelize");

/**
 * @typedef MonthBill
 * @type {object}
 * @property {string} id
 * @property {string} userId
 * @property {string} month_key
 * @property {string} category_id
 * @property {string} name
 * @property {string} type
 * @property {number} amount
 * @property {Date} due_date
 * @property {boolean} paid
 * @property {number} sort_order
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function MonthBill(sequelize) {
    const MonthBill = sequelize.define("MonthBill", {
        id: {
            type: DataTypes.STRING(100),
            primaryKey: true,
            allowNull: false
        },
        userId: {
            type: DataTypes.STRING(191),
            allowNull: true,
            field: 'userId'
        },
        month_key: {
            type: DataTypes.STRING(7),
            allowNull: false,
            field: 'monthKey'
        },
        category_id: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'categoryId'
        },
        name: {
            type: DataTypes.STRING(191),
            allowNull: true
        },
        type: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        due_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            field: 'dueDate'
        },
        paid: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'sortOrder'
        }
    }, {
        tableName: "month_bills",
        indexes: [
            {
                fields: ['userId', 'monthKey']
            },
            {
                fields: ['userId', 'monthKey', 'categoryId']
            }
        ],
        associate: function() {}
    });

    return MonthBill;
};
