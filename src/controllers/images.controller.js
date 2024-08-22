const db = require('../config/sequelize');
const uuid = require('uuid');
const { StorageInstance } = require('../services/aws/s3');

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.imageUpload = async (req, res) => {
    try {
        const s3 = new StorageInstance()
        const file = req.file;
        const fileName = `${file.originalname}-${uuid.v4()}`;
        const content = file.buffer;

        if (!file) {
            return res.status(400).json({ error: "Invalid Body" });
        }

        const imageUrl = await s3.uploadFile(fileName, content);

        if (!imageUrl) {
            return res.status(500).json({ error: "MINIO - Failed to upload"})
        }

        const image = await db.Images.create({
            name: fileName,
            url: imageUrl,
            UserId: req.userId
        });

        return res.status(200).json(image);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'MINIO - Request Failed' });
    }
}

exports.imageDelete = async (req, res) => {
    try {
        const { id } = req.params;
        const s3 = new StorageInstance()
        const imageExists = await db.Images.findOne({
            where: {
                id
            }
        });

        if (!imageExists) {
            return res.status(404).json({ error: 'SEQUELIZE - Not Found' });
        }

        await s3.deleteObject(imageExists.name);
        await imageExists.destroy();
        
        return res.sendStatus(200);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'MINIO - Request Failed' });
    }
}


exports.getImages = async (req, res) => {
    try {
        const images = await db.Images.findAll({
            include: [{
                model: db.Users
            }],
            order: [['createdAt', 'DESC']],
        })

        return res.status(200).json(images);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
    }
}