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
module.exports = function ArticleCategory(sequelize) {
    const ArticleCategory = sequelize.define("ArticleCategory", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
        },
        article_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'articles',
                key: 'id'
            }
        },
        category_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'category',
                key: 'id'
            }
        },
        sub_category_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'sub_category',
                key: 'id'
            }
        }
    }, {
        tableName: "article_category",
        associate: function(models) {
            // relacionamentos para facilitar includes/joins
            ArticleCategory.belongsTo(models.Articles, {
                foreignKey: 'article_id',
                as: 'Article'
            });

            ArticleCategory.belongsTo(models.Category, {
                foreignKey: 'category_id',
                as: 'Category'
            });

            ArticleCategory.belongsTo(models.SubCategory, {
                foreignKey: 'sub_category_id',
                as: 'SubCategory'
            });
        },
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return ArticleCategory;
};