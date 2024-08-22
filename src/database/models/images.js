const { DataTypes } = require("sequelize");

/**
 * @typedef Images
 * @type {object}
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {number} created_at
 * @property {number} updated_at
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function Session(sequelize) {
    const Images = sequelize.define("Images", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        url: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    }, {
        tableName: "Images",
        associate: function(models) {
            Images.belongsTo(models.Users, {
                onDelete: "cascade"
            });
        }
    });


    return Images;
};
