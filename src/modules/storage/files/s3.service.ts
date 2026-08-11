import S3 from 'aws-sdk/clients/s3';
import { CONFIG } from './s3.config';
import * as logger from '../../../shared/logger';

type ProgressCallback = (percent: number) => void;

/**
 * S3-compatible storage client (ported from services/aws/s3.js). Uses aws-sdk v2.
 * Behavior preserved verbatim — including that logger.changed/warning results are
 * discarded (legacy did not console.log them).
 */
export class StorageInstance {
    private readonly client: S3;

    constructor() {
        this.client = new S3({
            endpoint: CONFIG.providers.storage.endpoint,
            apiVersion: 'latest',
            region: CONFIG.providers.storage.region,
            accessKeyId: CONFIG.providers.storage.accessKeyId,
            secretAccessKey: CONFIG.providers.storage.secretAccessKey,
            signatureVersion: CONFIG.providers.storage.signatureVersion,
            s3ForcePathStyle: true,
        });
    }

    async uploadFileWithProgress(
        fileName: string,
        content: string | Buffer,
        folderName = '',
        progressCallback?: ProgressCallback,
    ): Promise<string | null> {
        try {
            const upload = this.client.upload({
                Bucket: CONFIG.providers.storage.bucket as string,
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

    async uploadFile(fileName: string, content: string | Buffer, folderName = ''): Promise<string | undefined> {
        try {
            const { Location } = await this.client
                .upload({
                    Bucket: CONFIG.providers.storage.bucket as string,
                    Key: `${folderName}${fileName}`,
                    Body: content,
                })
                .promise();
            return Location;
        } catch (err) {
            console.error(err);
            return undefined;
        }
    }

    async deleteObject(objectName: string, folderName = ''): Promise<unknown> {
        try {
            return await this.client
                .deleteObject({ Bucket: CONFIG.providers.storage.bucket as string, Key: `${folderName}${objectName}` })
                .promise();
        } catch (err) {
            console.error(err);
            return undefined;
        }
    }

    async createFolder(folderName: string): Promise<void> {
        try {
            await this.client
                .putObject({ Bucket: CONFIG.providers.storage.bucket as string, Key: folderName, Body: '' })
                .promise();
            logger.changed(`Pasta criada: ${folderName}`);
        } catch (err) {
            logger.warning(`Erro ao criar pasta: ${err}`);
            throw err;
        }
    }

    async deleteFolder(folderName: string): Promise<void> {
        try {
            const listedObjects = await this.client
                .listObjectsV2({ Bucket: CONFIG.providers.storage.bucket as string, Prefix: folderName })
                .promise();

            if (listedObjects.Contents && listedObjects.Contents.length > 0) {
                const objects: Array<{ Key: string }> = [];
                listedObjects.Contents.forEach(({ Key }) => {
                    if (Key) objects.push({ Key });
                });
                await this.client
                    .deleteObjects({ Bucket: CONFIG.providers.storage.bucket as string, Delete: { Objects: objects } })
                    .promise();
            }

            await this.client
                .deleteObject({ Bucket: CONFIG.providers.storage.bucket as string, Key: folderName })
                .promise();
            logger.changed(`Pasta deletada: ${folderName}`);
        } catch (err) {
            logger.warning(`Erro ao deletar a pasta: ${err}`);
            throw err;
        }
    }
}
