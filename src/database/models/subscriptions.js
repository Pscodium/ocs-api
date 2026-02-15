const { DataTypes } = require("sequelize");

/**
 * @typedef Subscription
 * @type {object}
 * @property {string} id
 * @property {string} month_key
 * @property {string} name
 * @property {number} amount
 * @property {string} billing_cycle
 * @property {Date} next_billing_date
 * @property {string} category
 * @property {boolean} active
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
module.exports = function Subscription(sequelize) {
    const Subscription = sequelize.define("Subscription", {
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
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        billing_cycle: {
            type: DataTypes.ENUM('monthly', 'quarterly', 'yearly'),
            allowNull: false,
            field: 'billingCycle'
        },
        next_billing_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            field: 'nextBillingDate'
        },
        category: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: "subscriptions",
        associate: function(models) {
            Subscription.belongsTo(models.Users, {
                onDelete: "cascade"
            });
        }
    });

    return Subscription;
};
