require('dotenv').config();
const { CONFIG } = require('./config');
const S3 = require('aws-sdk/clients/s3');
const logger = require('../logs.service');

class StorageInstance {
    constructor() {
        this.client = new S3({
            endpoint: CONFIG.providers.storage.endpoint,
            apiVersion: 'latest',
            region: CONFIG.providers.storage.region,
            accessKeyId: CONFIG.providers.storage.accessKeyId,
            secretAccessKey: CONFIG.providers.storage.secretAccessKey,
            signatureVersion: CONFIG.providers.storage.signatureVersion,
            s3ForcePathStyle: true
        });
    }

    /**
     * Upload file with progress tracking
     * @param {string} fileName - Nome do arquivo
     * @param {string | Buffer} content - Conteúdo/Buffer do arquivo
     * @param {string} folderName - Caminho da pasta
     * @param {function} progressCallback - Callback for progress updates (0-100)
     */
    async uploadFileWithProgress(fileName, content, folderName = '', progressCallback) {
        try {
            const upload = this.client.upload({
                Bucket: CONFIG.providers.storage.bucket,
                Key: `${folderName}${fileName}`,
                Body: content,
            });

            let lastReportedProgress = -1;

            if (typeof progressCallback === 'function') {
                upload.on('httpUploadProgress', (progress) => {
                    if (progress.total) {
                        const currentProgress = Math.round((progress.loaded * 100) / progress.total);
                        
                        if (currentProgress !== lastReportedProgress) {
                            progressCallback(currentProgress);
                            lastReportedProgress = currentProgress;
                        }
                    }
                });
            }

            const result = await upload.promise();
            
            if (lastReportedProgress < 100 && typeof progressCallback === 'function') {
                progressCallback(100);
            }
            
            return result.Location;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    /**
     * Original upload file method (kept for backward compatibility)
     * @param {string} fileName - Nome do arquivo
     * @param {string | Buffer} content - Conteúdo/Buffer do arquivo
     */
    async uploadFile(fileName, content, folderName = '') {
        try {
            const { Location } = await this.client.upload({
                Bucket: CONFIG.providers.storage.bucket,
                Key: `${folderName}${fileName}`,
                Body: content,
            }).promise();
            return Location;
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Delete an object from S3
     * @param {string} objectName - Nome do objeto/arquivo
     * @param {string} [folderName] - (Opcional) Caminho da pasta onde o arquivo está localizado
     */
    async deleteObject(objectName, folderName = '') {
        try {
            return await this.client.deleteObject({
                Bucket: CONFIG.providers.storage.bucket,
                Key: `${folderName}${objectName}`
            }).promise();
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Cria uma "pasta" no S3 adicionando um objeto com uma barra no final.
     * @param {string} folderName - Nome da pasta (terminando com "/")
     */
    async createFolder(folderName) {
        try {
            const params = {
                Bucket: CONFIG.providers.storage.bucket,
                Key: folderName,
                Body: '',
            };

            await this.client.putObject(params).promise();
            logger.changed(`Pasta criada: ${folderName}`);
        } catch (err) {
            logger.warning(`Erro ao criar pasta: ${err}`);
            throw err;
        }
    }

    /**
     * Deleta uma pasta e todos os objetos dentro dela, mesmo que esteja vazia
     * @param {string} folderName - Nome da pasta (terminando com "/")
     */
    async deleteFolder(folderName) {
        try {
            const listedObjects = await this.client.listObjectsV2({
                Bucket: CONFIG.providers.storage.bucket,
                Prefix: folderName
            }).promise();

            if (listedObjects.Contents.length > 0) {
                const deleteParams = {
                    Bucket: CONFIG.providers.storage.bucket,
                    Delete: { Objects: [] }
                };

                listedObjects.Contents.forEach(({ Key }) => {
                    deleteParams.Delete.Objects.push({ Key });
                });

                await this.client.deleteObjects(deleteParams).promise();
            }

            await this.client.deleteObject({
                Bucket: CONFIG.providers.storage.bucket,
                Key: folderName
            }).promise();

            logger.changed(`Pasta deletada: ${folderName}`);
        } catch (err) {
            logger.warning(`Erro ao deletar a pasta: ${err}`);
            throw err;
        }
    }
}

exports.StorageInstance = StorageInstance;