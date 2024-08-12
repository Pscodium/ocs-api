const { DataTypes } = require("sequelize");

/**
 * @typedef Articles
 * @type {object}
 * @property {string} id
 * @property {string} title
 * @property {string} body
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
        body: {
            type: DataTypes.TEXT,
            allowNull: false
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
            Articles.belongsToMany(models.Tags, {
                as: "Tags",
                through: "article_tags",
                foreignKey: "ArticleId",
                timestamps: true,
                onDelete: 'CASCADE'
            });
        },
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });


    return Articles;
};
