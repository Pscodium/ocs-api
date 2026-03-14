const { DataTypes } = require("sequelize");

/**
 * @typedef MonthCategory
 * @type {object}
 * @property {string} id
 * @property {string} month_key
 * @property {string} category_id
 * @property {string} name
 * @property {string} type
 * @property {number} split_by
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
module.exports = function MonthCategory(sequelize) {
    const MonthCategory = sequelize.define("MonthCategory", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
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
        split_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'splitBy'
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'sortOrder'
        }
    }, {
        tableName: "month_categories",
        indexes: [
            {
                fields: ['userId', 'monthKey']
            }
        ],
        associate: function() {}
    });

    return MonthCategory;
};
