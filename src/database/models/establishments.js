const { DataTypes } = require("sequelize");

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @returns
 */
module.exports = function Establishments(sequelize) {
    const Establishments = sequelize.define("Establishments", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false
        },
        nome: {
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
        categoria: {
            type: DataTypes.STRING,
            allowNull: false
        },
        endereco: {
            type: DataTypes.STRING,
            allowNull: false
        },
        telefone: {
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
                as: "produtos",
                foreignKey: "establishmentId",
                onDelete: "CASCADE"
            });
        },
        indexes: [
            {
                fields: ["categoria"]
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
