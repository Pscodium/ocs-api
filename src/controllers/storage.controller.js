const db = require('../config/sequelize');
const uuid = require('uuid');
const randomColor = require('randomcolor');
const { StorageInstance } = require('../services/aws/s3');

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.fileUpload = async (req, res) => {
    try {
        const s3 = new StorageInstance()
        const file = req.file;
        const { folderId } = req.params;
        const filePattern = file.originalname.split('.');
        const fileName = `${uuid.v4()}.${filePattern[filePattern.length - 1]}`;
        const type = file.mimetype;
        const content = file.buffer;

        if (!file && !folderId) {
            return res.status(400).json({ error: "Invalid Body" });
        }

        const folderExists = await db.Folder.findOne({
            where: {
                id: folderId
            }
        })

        if (!folderExists) {
            return res.status(400).json({ error: "Folder doesn't exists" })
        }

        const fileUrl = await s3.uploadFile(fileName, content, `${folderExists.name}/`);

        if (!fileUrl) {
            return res.status(500).json({ error: "MINIO - Failed to upload"})
        }

        const uploaded = await db.Files.create({
            name: fileName,
            url: fileUrl,
            UserId: req.userId,
            type
        });

        await folderExists.addFiles(uploaded);
        await folderExists.save();

        return res.status(200).json(uploaded);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'MINIO - Request Failed' });
    }
}

exports.deleteFile = async (req, res) => {
    try {
        const { id, folderId } = req.params;
        const s3 = new StorageInstance()
        const fileExists = await db.Files.findOne({
            where: {
                id
            }
        });

        const folderExists = await db.Folder.findOne({
            where: {
                id: folderId
            }
        });

        if (!fileExists || !folderExists) {
            return res.status(404).json({ error: 'SEQUELIZE - Not Found' });
        };

        await s3.deleteObject(fileExists.name, `${folderExists.name}/`);
        await folderExists.removeFile(fileExists);
        await fileExists.destroy();
        
        return res.sendStatus(200);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'MINIO - Request Failed' });
    }
}


exports.getFiles = async (req, res) => {
    try {
        const files = await db.Files.findAll({
            include: [{
                model: db.Users
            }],
            order: [['createdAt', 'DESC']],
        })

        if (!files.length) {
            return res.status(200).json([])
        }

        return res.status(200).json(files);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
    }
}

exports.getFolders = async (req, res) => {
    try {
        const folders = await db.Folder.findAll({
            include: [{
                model: db.Files,
                as: 'Files',
                order: [['createdAt', 'DESC']],
            }],
            attributes: {
                include: [
                    [db.sequelize.literal('(SELECT COUNT(*) FROM `file_folders` WHERE `file_folders`.`FolderId` = `Folder`.`id`)'), 'filesCount']
                ]
            },
            order: [['createdAt', 'DESC']],
        })

        if (!folders.length) {
            return res.status(200).json([])
        }

        return res.status(200).json(folders);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
    }
}

exports.createFolder = async (req, res) => {
    try {
        const { folderName, type } = req.body;
        const s3 = new StorageInstance()
        const validFolderName = `${folderName}/`;

        if (!folderName) {
            return res.status(400).json({ message: "Folder must have a name" })
        }

        await s3.createFolder(validFolderName)

        const folder = await db.Folder.create({
            name: folderName,
            UserId: req.userId,
            hex: randomColor(),
            type
        })

        return res.status(200).json(folder);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
    }
}

exports.deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const s3 = new StorageInstance()

        const folderExists = await db.Folder.findOne({
            where: {
                id
            },
            include: [
                {
                    model: db.Files,
                    as: "Files"
                }
            ]
        })

        if (!folderExists) {
            return res.status(404).json({ message: "Folder doesn't exists" })
        }

        const validFolderName = `${folderExists.name}/`;

        await s3.deleteFolder(validFolderName)

        const files = folderExists.Files;

        if (files.length > 0) {
            for (const file of files) {
                await file.destroy();
            }
        }

        await folderExists.setFiles([]);
        await folderExists.destroy()

        return res.sendStatus(200);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
    }
};