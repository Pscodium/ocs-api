import type { Router } from 'express';
import multer from 'multer';
import { auth } from '../../../shared/middleware/auth.middleware';
import { Permissions } from '../../../shared/enums';
import { createFilesController } from './files.controller';

/**
 * Files slice of the storage module (docs §3.2 `modules/storage/files/`): upload,
 * folders, proxy. Native TS + Prisma. Original paths already began with /storage,
 * so mounting these relative paths under the '/storage' prefix reproduces them
 * exactly (docs §4 "/storage/... já casa com o prefixo") — canonical == legacy.
 */
const upload = multer({ storage: multer.memoryStorage() });

export function registerFilesRoutes(router: Router): void {
    const f = createFilesController();
    const admin = auth.hasPermissions([Permissions.ADMIN]);

    router.post('/upload/:folderId', auth.sessionOrJwt, admin, upload.array('media', 50), f.fileUpload);
    router.delete('/delete/:id/folder/:folderId', auth.sessionOrJwt, admin, f.deleteFile);
    router.post('/delete/bulk', auth.sessionOrJwt, admin, f.deleteMultipleFiles);
    router.post('/folders/create', auth.sessionOrJwt, admin, f.createFolder);
    router.delete('/folders/delete/:id', auth.sessionOrJwt, admin, f.deleteFolder);
    router.get('/proxy', f.proxy);
    router.get('/folders', auth.loggedOrNot, f.getFolders);
    router.get('/files', auth.loggedOrNot, f.getFiles);
}
