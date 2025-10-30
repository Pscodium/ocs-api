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
module.exports = function SubCategory(sequelize) {
    const SubCategory = sequelize.define("SubCategory", {
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
        tableName: "sub_category",
        associate: function(models) {
            SubCategory.belongsTo(models.Category, {
                foreignKey: "category_id",
                as: "Category"
            });

            // subcategoria <-> artigos via ArticleCategory
            SubCategory.belongsToMany(models.Articles, {
                through: models.ArticleCategory,
                foreignKey: 'sub_category_id',
                otherKey: 'article_id',
                as: 'articles'
            });
        },
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return SubCategory;
};