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
     *
     * @param {string} fileName - Nome do arquivo
     * @param {string | Buffer} content - Conteúdo/Buffer do arquivo
     */
    async uploadFile(fileName, content) {
        try {
            const { Location } = await this.client.upload({
                Bucket: CONFIG.providers.storage.bucket,
                Key: fileName,
                Body: content,
            }).promise();
            return Location;
        } catch (err) {
            console.error(err);
        }
    }

    /**
     *
     * @param {string} objectName - Nome do objeto/arquivo
     */
    async deleteObject(objectName) {
        try {
            return await this.client.deleteObject({
                Bucket: CONFIG.providers.storage.bucket,
                Key: objectName
            }).promise();
        } catch (err) {
            console.error(err);
        }
    }
}

exports.StorageInstance = StorageInstance;