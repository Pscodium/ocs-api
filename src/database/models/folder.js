const { DataTypes } = require("sequelize");

/**
 * @typedef Folder
 * @type {object}
 * @property {string} id
 * @property {string} name
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
module.exports = function Folder(sequelize) {
    const Folder = sequelize.define("Folder", {
        id: {
            type: DataTypes.UUID,
            defaultValue: sequelize.Sequelize.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: true
        },
        hex: {
            type: DataTypes.STRING,
            allowNull: false
        },
        private: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: "folder",
        associate: function(models) {
            Folder.belongsTo(models.Users, {
                onDelete: "cascade"
            });
            Folder.belongsToMany(models.Files, {
                as: "Files",
                through: "file_folders",
                foreignKey: "FolderId",
                timestamps: true,
                onDelete: 'CASCADE'
            });
        }
    });


    return Folder;
};
