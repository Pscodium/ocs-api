const db = require('../config/sequelize');
const { StorageInstance } = require('../services/aws/s3');

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @returns 
 */
exports.fileUpload = async (req, res) => {
    try {
        const s3 = new StorageInstance();
        const files = req.files;
        const { folderId } = req.params;

        const io = req.app.get('io');
        
        if (!files || !files.length || !folderId) {
            return res.status(400).json({ error: "Invalid Body" });
        }

        const folderExists = await db.Folder.findOne({
            where: {
                id: folderId
            },
            include: [{
                model: db.Files,
                as: 'Files'
            }]
        });

        if (!folderExists) {
            return res.status(400).json({ error: "Folder doesn't exist" });
        }

        const uploadedFiles = [];
        const totalFiles = files.length;

        const sessionId = Date.now();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileId = `${sessionId}-${i}`;
            
            io.emit(`upload-progress-${req.userId}`, {
                fileId,
                fileName: file.originalname,
                progress: 0,
                index: i,
                total: totalFiles
            });
            
            let lastProgress = 0;
            
            const progressTracker = (progress) => {
                if (progress - lastProgress >= 1) {
                    io.emit(`upload-progress-${req.userId}`, {
                        fileId,
                        fileName: file.originalname,
                        progress,
                        index: i,
                        total: totalFiles
                    });
                    lastProgress = progress;
                }
            };
            
            const fileUrl = await s3.uploadFileWithProgress(
                file.originalname, 
                file.buffer, 
                `${folderExists.name}/`,
                progressTracker
            );

            if (!fileUrl) {
                io.emit(`upload-error-${req.userId}`, {
                    fileId,
                    fileName: file.originalname,
                    error: "Failed to upload to S3",
                    index: i
                });
                
                continue;
            }

            const uploaded = await db.Files.create({
                name: file.originalname,
                url: fileUrl,
                UserId: req.userId,
                type: file.mimetype
            });

            await folderExists.addFile(uploaded);
            
            if (lastProgress < 100) {
                io.emit(`upload-progress-${req.userId}`, {
                    fileId,
                    fileName: file.originalname,
                    progress: 100,
                    index: i,
                    total: totalFiles
                });
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            io.emit(`upload-complete-${req.userId}`, {
                fileId,
                fileName: file.originalname,
                fileData: uploaded,
                index: i,
                total: totalFiles
            });
            
            uploadedFiles.push(uploaded);
        }

        await folderExists.save();

        const updatedFolder = await db.Folder.findOne({
            where: { id: folderId },
            include: [{
                model: db.Files,
                as: 'Files'
            }]
        });

        await new Promise(resolve => setTimeout(resolve, 200));
        
        io.emit(`upload-all-complete-${req.userId}`, {
            folderId,
            folderData: updatedFolder,
            totalFiles: uploadedFiles.length,
            filesData: uploadedFiles
        });

        return res.status(200).json(uploadedFiles);
    } catch (err) {
        console.error(err);

        const io = req.app.get('io');
        io.emit(`upload-error-${req.userId}`, {
            error: 'MINIO - Request Failed',
            message: err.message
        });
        
        return res.status(500).json({ error: 'MINIO - Request Failed' });
    }
}

exports.proxy = async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send('URL é necessária');
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Origin': 'http://localhost',
            },
        });

        if (!response.ok) {
            return res.status(response.status).send('Erro ao buscar a imagem');
        }

        const data = await response.text();
        res.set('Content-Type', response.headers.get('content-type'));
        res.send(data);
    } catch (error) {
        console.error('Erro ao buscar a imagem:', error);
        res.status(500).send('Erro ao buscar a imagem');
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

exports.deleteMultipleFiles = async (req, res) => {
    try {
        const { fileIds, folderId } = req.body;
        const s3 = new StorageInstance();
        
        const io = req.app.get('io');
        
        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0 || !folderId) {
            return res.status(400).json({ error: "Invalid request body" });
        }

        const folderExists = await db.Folder.findOne({
            where: {
                id: folderId
            },
            include: [{
                model: db.Files,
                as: 'Files'
            }]
        });

        if (!folderExists) {
            return res.status(404).json({ error: "Folder not found" });
        }

        const deletedFiles = [];
        const totalFiles = fileIds.length;
        
        const sessionId = Date.now();
        
        io.emit(`delete-start-${req.userId}`, {
            sessionId,
            total: totalFiles,
            folderId
        });
        
        for (let i = 0; i < fileIds.length; i++) {
            const fileId = fileIds[i];
            const deleteId = `${sessionId}-${i}`;
            
            io.emit(`delete-progress-${req.userId}`, {
                deleteId,
                fileId,
                progress: 0,
                index: i,
                total: totalFiles
            });
            
            try {
                const fileExists = await db.Files.findOne({
                    where: {
                        id: fileId
                    }
                });
    
                if (!fileExists) {
                    io.emit(`delete-error-${req.userId}`, {
                        deleteId,
                        fileId,
                        error: "File not found",
                        index: i
                    });
                    continue;
                }
                
                io.emit(`delete-progress-${req.userId}`, {
                    deleteId,
                    fileId,
                    fileName: fileExists.name,
                    progress: 50,
                    index: i,
                    total: totalFiles
                });
                
                await s3.deleteObject(fileExists.name, `${folderExists.name}/`);
                
                await folderExists.removeFile(fileExists);
                
                await fileExists.destroy();
                
                io.emit(`delete-progress-${req.userId}`, {
                    deleteId,
                    fileId,
                    fileName: fileExists.name,
                    progress: 100,
                    index: i,
                    total: totalFiles
                });
                
                await new Promise(resolve => setTimeout(resolve, 50));
                
                io.emit(`delete-complete-${req.userId}`, {
                    deleteId,
                    fileId,
                    fileName: fileExists.name,
                    index: i,
                    total: totalFiles
                });
                
                deletedFiles.push(fileId);
                
            } catch (err) {
                console.error(`Error deleting file ${fileId}:`, err);
                io.emit(`delete-error-${req.userId}`, {
                    deleteId,
                    fileId,
                    error: err.message || "Failed to delete file",
                    index: i
                });
            }
        }
        
        await folderExists.save();
        
        const updatedFolder = await db.Folder.findOne({
            where: { id: folderId },
            include: [{
                model: db.Files,
                as: 'Files'
            }]
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        io.emit(`delete-all-complete-${req.userId}`, {
            sessionId,
            folderId,
            folderData: updatedFolder,
            totalFiles: deletedFiles.length,
            deletedFiles
        });

        return res.status(200).json({ 
            success: true, 
            deletedCount: deletedFiles.length,
            deletedFiles
        });
    } catch (err) {
        console.error(err);
        const io = req.app.get('io');
        io.emit(`delete-error-${req.userId}`, {
            error: 'Operation Failed',
            message: err.message
        });
        
        return res.status(500).json({ error: 'Delete operation failed' });
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
        const { userId } = req;

        const whereCondition = userId 
            ? {
                [db.sequelize.Sequelize.Op.or]: [
                    { private: false },
                    { UserId: userId } 
                ]
            } 
            : { 
                private: false  // Apenas itens públicos quando não está logado
            };

        const folders = await db.Folder.findAll({
            include: [{
                model: db.Files,
                as: 'Files',
                order: [['createdAt', 'DESC']],
            }],
            where: whereCondition,
            attributes: {
                include: [
                    [db.sequelize.literal('(SELECT COUNT(*) FROM `file_folders` WHERE `file_folders`.`FolderId` = `Folder`.`id`)'), 'filesCount']
                ]
            },
            order: [['createdAt', 'DESC']],
        });

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
        const { folderName, type, private, hex } = req.body;
        const s3 = new StorageInstance()
        const validFolderName = `${folderName}/`;

        if (!folderName) {
            return res.status(400).json({ message: "Folder must have a name" })
        }

        await s3.createFolder(validFolderName)

        const folder = await db.Folder.create({
            name: folderName,
            UserId: req.userId,
            private,
            hex,
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