const { DataTypes } = require("sequelize");

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @returns
 */
module.exports = function EstablishmentProducts(sequelize) {
    const EstablishmentProducts = sequelize.define("EstablishmentProducts", {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: DataTypes.UUIDV4
        },
        establishmentId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "establishments",
                key: "id"
            },
            field: "establishmentId"
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        stock: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: "establishment_products",
        associate: function(models) {
            EstablishmentProducts.belongsTo(models.Establishments, {
                as: "establishment",
                foreignKey: "establishmentId",
                onDelete: "CASCADE"
            });
        },
        indexes: [
            {
                fields: ["establishmentId"]
            },
            {
                fields: ["category"]
            },
            {
                fields: ["stock"]
            }
        ],
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return EstablishmentProducts;
};
