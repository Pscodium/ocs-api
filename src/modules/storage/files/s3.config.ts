import { env } from '../../../config/env';

export const CONFIG = {
    providers: {
        storage: {
            endpoint: env.STORAGE_ENDPOINT,
            region: env.STORAGE_REGION,
            bucket: env.STORAGE_BUCKET,
            path: env.STORAGE_PATH,
            accessKeyId: env.STORAGE_ACCESS_KEY_ID,
            secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
            signatureVersion: 'v4',
        },
    },
} as const;
