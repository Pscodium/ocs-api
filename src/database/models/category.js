const { DataTypes } = require("sequelize");

/**
 * @typedef Category
 * @type {object}
 * @property {string} id
 * @property {string} title
 * @property {number} count
 * @property {number} views
 * @property {string} hex
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function Category(sequelize) {
    const Category = sequelize.define("Category", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        hex: {
            type: DataTypes.STRING({ length: 7 }),
            allowNull: false,
            defaultValue: "#000000"
        }
    }, {
        tableName: "category",
        associate: function(models) {
            // uma categoria tem muitas subcategorias
            Category.hasMany(models.SubCategory, {
                foreignKey: 'category_id',
                as: 'subCategories'
            });

            // categoria <-> artigos via tabela de relacionamento ArticleCategory
            Category.belongsToMany(models.Articles, {
                through: models.ArticleCategory,
                foreignKey: 'category_id',
                otherKey: 'article_id',
                as: 'articles'
            });
        },
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return Category;
};