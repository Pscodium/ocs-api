const { DataTypes } = require("sequelize");

/**
 * @typedef Files
 * @type {object}
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string} type
 * @property {boolean} private
 * @property {number} created_at
 * @property {number} updated_at
 */

/**
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('sequelize')} Sequelize
 * @returns
 */
module.exports = function Files(sequelize) {
    const Files = sequelize.define("Files", {
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
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        private: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: "files",
        associate: function(models) {
            Files.belongsTo(models.Users, {
                onDelete: "cascade"
            });
            Files.belongsToMany(models.Folder, {
                as: "Folder",
                through: "file_folders",
                foreignKey: "FileId",
                timestamps: true,
                onDelete: 'CASCADE'
            });
        }
    });


    return Files;
};
