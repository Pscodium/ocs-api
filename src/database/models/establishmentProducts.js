const { DataTypes } = require("sequelize");

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @returns
 */
module.exports = function EstablishmentProducts(sequelize) {
    const EstablishmentProducts = sequelize.define("EstablishmentProducts", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false
        },
        establishmentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "establishments",
                key: "id"
            },
            field: "establishmentId"
        },
        nome: {
            type: DataTypes.STRING,
            allowNull: false
        },
        descricao: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        categoria: {
            type: DataTypes.STRING,
            allowNull: false
        },
        preco: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        imagem: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: "establishment_products",
        associate: function(models) {
            EstablishmentProducts.belongsTo(models.Establishments, {
                as: "estabelecimento",
                foreignKey: "establishmentId",
                onDelete: "CASCADE"
            });
        },
        indexes: [
            {
                fields: ["establishmentId"]
            },
            {
                fields: ["categoria"]
            },
            {
                fields: ["preco"]
            }
        ],
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return EstablishmentProducts;
};
