const { DataTypes } = require("sequelize");

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @returns
 */
module.exports = function Establishments(sequelize) {
    const Establishments = sequelize.define("Establishments", {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: DataTypes.UUIDV4
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: false
        },
        longitude: {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: false
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false
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
        tableName: "establishments",
        associate: function(models) {
            Establishments.hasMany(models.EstablishmentProducts, {
                as: "products",
                foreignKey: "establishmentId",
                onDelete: "CASCADE"
            });
        },
        indexes: [
            {
                fields: ["category"]
            },
            {
                fields: ["latitude", "longitude"]
            }
        ],
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return Establishments;
};
