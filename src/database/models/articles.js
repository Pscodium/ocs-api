const { DataTypes } = require("sequelize");

/**
 * @typedef Articles
 * @type {object}
 * @property {string} id
 * @property {string} title
 * @property {string} content
 * @property {string[]} files
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function Articles(sequelize) {
    const Articles = sequelize.define("Articles", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        hex: {
            type: DataTypes.STRING({ length: 7 }),
            allowNull: false,
            defaultValue: "#000000"
        },
        files: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        tableName: "articles",
        associate: function(models) {
            Articles.belongsTo(models.Users, {
                onDelete: "cascade"
            });

            // Articles <-> Category via ArticleCategory
            Articles.belongsToMany(models.Category, {
                through: models.ArticleCategory,
                foreignKey: 'article_id',
                otherKey: 'category_id',
                as: 'categories'
            });

            // Articles <-> SubCategory via ArticleCategory
            Articles.belongsToMany(models.SubCategory, {
                through: models.ArticleCategory,
                foreignKey: 'article_id',
                otherKey: 'sub_category_id',
                as: 'subCategories'
            });
        },
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });


    return Articles;
};
