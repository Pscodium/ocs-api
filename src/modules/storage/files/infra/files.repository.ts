import { prisma } from '../../../../config/database';

/**
 * Files/Folder repository on PRISMA (docs §8 step 6). Uses the explicit join model
 * FileFolder (table `file_folders`). Results are reshaped to the legacy Sequelize
 * shape: folders expose a flat `Files: File[]` array (belongsToMany `as: "Files"`).
 */
type FileRow = { file: Record<string, unknown> };
type FolderWithJoin = Record<string, unknown> & { files?: FileRow[]; _count?: { files: number } };

function reshapeFolder(folder: FolderWithJoin, withCount = false): Record<string, unknown> {
    const { files, _count, ...rest } = folder;
    const out: Record<string, unknown> = { ...rest, Files: (files ?? []).map((f) => f.file) };
    if (withCount) out.filesCount = _count?.files ?? 0;
    return out;
}

export interface FileData {
    name: string;
    url: string;
    userId?: string;
    type: string;
}

export interface FolderData {
    name: string;
    userId?: string;
    private?: boolean;
    hex: string;
    type?: string;
}

export class FilesRepository {
    async findFolderWithFiles(id: string): Promise<Record<string, unknown> | null> {
        const folder = await prisma.folder.findUnique({
            where: { id },
            include: { files: { include: { file: true } } },
        });
        return folder ? reshapeFolder(folder as FolderWithJoin) : null;
    }

    findFolder(id: string) {
        return prisma.folder.findUnique({ where: { id } });
    }

    findFileById(id: string) {
        return prisma.files.findUnique({ where: { id } });
    }

    /** File with the given name that is linked to the given folder (legacy inner join). */
    findFileByNameInFolder(name: string, folderId: string) {
        return prisma.files.findFirst({
            where: { name, folders: { some: { FolderId: folderId } } },
        });
    }

    createFile(data: FileData) {
        return prisma.files.create({ data });
    }

    async linkFileFolder(fileId: string, folderId: string): Promise<void> {
        await prisma.fileFolder.create({ data: { FileId: fileId, FolderId: folderId } });
    }

    async unlinkFileFolder(fileId: string, folderId: string): Promise<void> {
        await prisma.fileFolder.deleteMany({ where: { FileId: fileId, FolderId: folderId } });
    }

    async deleteFile(id: string): Promise<void> {
        await prisma.fileFolder.deleteMany({ where: { FileId: id } });
        await prisma.files.delete({ where: { id } });
    }

    listFiles() {
        return prisma.files.findMany({ orderBy: { createdAt: 'desc' } });
    }

    /** Folders visible to userId (own + public) or only public when anonymous,
     *  each with a flat Files array + filesCount. NOTE: fixes the legacy `UserId`
     *  vs `userId` column mismatch by filtering on the real `userId` column. */
    async listFolders(userId?: string): Promise<Record<string, unknown>[]> {
        const where = userId ? { OR: [{ private: false }, { userId }] } : { private: false };
        const folders = await prisma.folder.findMany({
            where,
            include: { files: { include: { file: true } }, _count: { select: { files: true } } },
            orderBy: { createdAt: 'desc' },
        });
        return folders.map((f) => reshapeFolder(f as FolderWithJoin, true));
    }

    createFolder(data: FolderData) {
        return prisma.folder.create({ data });
    }

    /** Deletes a folder, its files and their links (legacy: destroy files, setFiles([]), destroy folder). */
    async deleteFolderCascade(id: string): Promise<void> {
        const links = await prisma.fileFolder.findMany({ where: { FolderId: id }, select: { FileId: true } });
        const fileIds = links.map((l) => l.FileId);
        await prisma.fileFolder.deleteMany({ where: { FolderId: id } });
        if (fileIds.length > 0) {
            await prisma.fileFolder.deleteMany({ where: { FileId: { in: fileIds } } });
            await prisma.files.deleteMany({ where: { id: { in: fileIds } } });
        }
        await prisma.folder.delete({ where: { id } });
    }
}
