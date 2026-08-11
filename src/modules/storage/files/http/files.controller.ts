import type { Request, RequestHandler, Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { StorageInstance } from '../infra/s3.service';
import { FilesRepository } from '../infra/files.repository';

/**
 * Files/folders HTTP layer (ported from storage.controller.js, ~507 lines). DB via
 * Prisma (FilesRepository); S3 via StorageInstance; realtime progress via socket.io.
 * Responses, status codes and socket event names are preserved verbatim (docs §1.4).
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createFilesController(repo = new FilesRepository()) {
    const io = (req: Request): SocketServer => req.app.get('io') as SocketServer;

    const fileUpload: RequestHandler = async (req: Request, res: Response) => {
        try {
            const s3 = new StorageInstance();
            const files = (req.files as Express.Multer.File[]) ?? [];
            const { folderId } = req.params;
            const fileIds: string[] = req.body.fileIds ? JSON.parse(req.body.fileIds) : [];
            const socket = io(req);

            if (!files || !files.length || !folderId) {
                return res.status(400).json({ error: 'Invalid Body' });
            }

            const folderExists = await repo.findFolderWithFiles(folderId);
            if (!folderExists) {
                return res.status(400).json({ error: "Folder doesn't exist" });
            }

            const uploadedFiles: unknown[] = [];
            const totalFiles = files.length;
            const sessionId = Date.now();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileId = fileIds[i] || `${sessionId}-${i}`;
                const fileName = file.originalname;

                socket.emit(`upload-progress-${req.userId}`, { fileId, fileName, progress: 0, index: i, total: totalFiles });

                let lastProgress = 0;
                const progressTracker = (progress: number): void => {
                    if (progress - lastProgress >= 1) {
                        socket.emit(`upload-progress-${req.userId}`, { fileId, fileName, progress, index: i, total: totalFiles });
                        lastProgress = progress;
                    }
                };

                const existingFile = await repo.findFileByNameInFolder(fileName, folderId);
                let finalFileName = fileName;
                if (existingFile) {
                    const nameParts = fileName.split('.');
                    const extension = nameParts.pop();
                    const baseName = nameParts.join('.');
                    finalFileName = `${baseName} (${Date.now()}).${extension}`;
                }

                const fileUrl = await s3.uploadFileWithProgress(
                    finalFileName,
                    file.buffer,
                    `${(folderExists as { name: string }).name}/`,
                    progressTracker,
                );

                if (!fileUrl) {
                    socket.emit(`upload-error-${req.userId}`, { fileId, fileName, error: 'Failed to upload to S3', index: i });
                    continue;
                }

                const uploaded = await repo.createFile({ name: finalFileName, url: fileUrl, userId: req.userId, type: file.mimetype });
                await repo.linkFileFolder(uploaded.id, folderId);

                if (lastProgress < 100) {
                    socket.emit(`upload-progress-${req.userId}`, { fileId, fileName, progress: 100, index: i, total: totalFiles });
                }
                await sleep(100);
                socket.emit(`upload-complete-${req.userId}`, { fileId, fileName, fileData: uploaded, index: i, total: totalFiles });
                uploadedFiles.push(uploaded);
            }

            const updatedFolder = await repo.findFolderWithFiles(folderId);
            await sleep(200);
            socket.emit(`upload-all-complete-${req.userId}`, {
                folderId,
                folderData: updatedFolder,
                totalFiles: uploadedFiles.length,
                filesData: uploadedFiles,
            });

            return res.status(200).json(uploadedFiles);
        } catch (err) {
            console.error(err);
            io(req).emit(`upload-error-${req.userId}`, { error: 'MINIO - Request Failed', message: (err as Error).message });
            return res.status(500).json({ error: 'MINIO - Request Failed' });
        }
    };

    const proxy: RequestHandler = async (req: Request, res: Response) => {
        const { url } = req.query;
        if (!url) return res.status(400).send('URL é necessária');
        try {
            const response = await fetch(String(url), { method: 'GET', headers: { Origin: 'http://localhost' } });
            if (!response.ok) return res.status(response.status).send('Erro ao buscar a imagem');
            const data = await response.text();
            res.set('Content-Type', response.headers.get('content-type') ?? '');
            res.send(data);
        } catch (error) {
            console.error('Erro ao buscar a imagem:', error);
            res.status(500).send('Erro ao buscar a imagem');
        }
    };

    const deleteFile: RequestHandler = async (req: Request, res: Response) => {
        try {
            const { id, folderId } = req.params;
            const s3 = new StorageInstance();
            const fileExists = await repo.findFileById(id);
            const folderExists = await repo.findFolder(folderId);
            if (!fileExists || !folderExists) {
                return res.status(404).json({ error: 'SEQUELIZE - Not Found' });
            }
            await s3.deleteObject(fileExists.name ?? '', `${folderExists.name}/`);
            await repo.unlinkFileFolder(fileExists.id, folderExists.id);
            await repo.deleteFile(fileExists.id);
            return res.sendStatus(200);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'MINIO - Request Failed' });
        }
    };

    const deleteMultipleFiles: RequestHandler = async (req: Request, res: Response) => {
        try {
            const { fileIds, folderId, deleteIds } = req.body as { fileIds?: string[]; folderId?: string; deleteIds?: string[] };
            const s3 = new StorageInstance();
            const socket = io(req);

            if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0 || !folderId) {
                return res.status(400).json({ error: 'Invalid request body' });
            }
            const folderExists = await repo.findFolder(folderId);
            if (!folderExists) {
                return res.status(404).json({ error: 'Folder not found' });
            }

            const deletedFiles: string[] = [];
            const totalFiles = fileIds.length;
            const sessionId = Date.now();
            socket.emit(`delete-start-${req.userId}`, { sessionId, total: totalFiles, folderId });

            for (let i = 0; i < fileIds.length; i++) {
                const fileId = fileIds[i];
                const deleteId = deleteIds && deleteIds[i] ? deleteIds[i] : `${sessionId}-${i}`;
                socket.emit(`delete-progress-${req.userId}`, { deleteId, fileId, progress: 0, index: i, total: totalFiles });
                try {
                    const fileExists = await repo.findFileById(fileId);
                    if (!fileExists) {
                        socket.emit(`delete-error-${req.userId}`, { deleteId, fileId, error: 'File not found', index: i });
                        continue;
                    }
                    socket.emit(`delete-progress-${req.userId}`, { deleteId, fileId, fileName: fileExists.name, progress: 50, index: i, total: totalFiles });
                    await s3.deleteObject(fileExists.name ?? '', `${folderExists.name}/`);
                    await repo.unlinkFileFolder(fileExists.id, folderExists.id);
                    await repo.deleteFile(fileExists.id);
                    socket.emit(`delete-progress-${req.userId}`, { deleteId, fileId, fileName: fileExists.name, progress: 100, index: i, total: totalFiles });
                    await sleep(50);
                    socket.emit(`delete-complete-${req.userId}`, { deleteId, fileId, fileName: fileExists.name, index: i, total: totalFiles });
                    deletedFiles.push(fileId);
                } catch (err) {
                    console.error(`Error deleting file ${fileId}:`, err);
                    socket.emit(`delete-error-${req.userId}`, { deleteId, fileId, error: (err as Error).message || 'Failed to delete file', index: i });
                }
            }

            const updatedFolder = await repo.findFolderWithFiles(folderId);
            await sleep(100);
            socket.emit(`delete-all-complete-${req.userId}`, {
                sessionId,
                folderId,
                folderData: updatedFolder,
                totalFiles: deletedFiles.length,
                deletedFiles,
            });

            return res.status(200).json({ success: true, deletedCount: deletedFiles.length, deletedFiles });
        } catch (err) {
            console.error(err);
            io(req).emit(`delete-error-${req.userId}`, { error: 'Operation Failed', message: (err as Error).message });
            return res.status(500).json({ error: 'Delete operation failed' });
        }
    };

    const getFiles: RequestHandler = async (_req: Request, res: Response) => {
        try {
            const files = await repo.listFiles();
            if (!files.length) return res.status(200).json([]);
            return res.status(200).json(files);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
        }
    };

    const getFolders: RequestHandler = async (req: Request, res: Response) => {
        try {
            const folders = await repo.listFolders(req.userId);
            if (!folders.length) return res.status(200).json([]);
            return res.status(200).json(folders);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
        }
    };

    const createFolder: RequestHandler = async (req: Request, res: Response) => {
        try {
            const { folderName, type, private: isPrivate, hex } = req.body;
            const s3 = new StorageInstance();
            if (!folderName) {
                return res.status(400).json({ message: 'Folder must have a name' });
            }
            await s3.createFolder(`${folderName}/`);
            const folder = await repo.createFolder({ name: folderName, userId: req.userId, private: isPrivate, hex, type });
            return res.status(200).json(folder);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
        }
    };

    const deleteFolder: RequestHandler = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const s3 = new StorageInstance();
            const folderExists = await repo.findFolder(id);
            if (!folderExists) {
                return res.status(404).json({ message: "Folder doesn't exists" });
            }
            await s3.deleteFolder(`${folderExists.name}/`);
            await repo.deleteFolderCascade(id);
            return res.sendStatus(200);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'SEQUELIZE - Request Failed' });
        }
    };

    return { fileUpload, proxy, deleteFile, deleteMultipleFiles, getFiles, getFolders, createFolder, deleteFolder };
}

export type FilesController = ReturnType<typeof createFilesController>;
