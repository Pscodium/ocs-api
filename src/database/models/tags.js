const { DataTypes } = require("sequelize");

/**
 * @typedef Tags
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
module.exports = function Tags(sequelize) {
    const Tags = sequelize.define("Tags", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        views: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        hex: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "#000000"
        }
    }, {
        tableName: "tags",
        associate: function(models) {
            Tags.belongsToMany(models.Articles, {
                as: 'Articles',
                through: "article_tags",
                foreignKey: "TagId",
                timestamps: true,
                onDelete: 'CASCADE'
            });
        },
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
    });

    return Tags;
};