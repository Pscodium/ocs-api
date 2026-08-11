import randomColor from 'randomcolor';
import { HttpError } from '../../../core/http/httpError';
import { ArticlesRepository } from './articles.repository';

interface TagInput {
    title?: string;
}

/** Only these fields are updatable (legacy Sequelize ignored unknown body keys;
 *  Prisma would throw, so we whitelist to preserve behavior). */
const ARTICLE_FIELDS = ['title', 'body', 'files', 'userId'] as const;

export class ArticlesService {
    constructor(private readonly repo = new ArticlesRepository()) {}

    /**
     * Creates an article and links its tags. Returns { aborted: true } to reproduce
     * the legacy behavior where a tag without a title causes an early `return` with
     * NO response sent (the request hangs). Preserved as-is (docs §1.4).
     */
    async createArticle(
        title: string,
        body: string,
        userId: string | undefined,
        tags: TagInput[] | undefined,
    ): Promise<{ article: unknown } | { aborted: true }> {
        const article = await this.repo.createArticle(title, body, userId);

        if (tags) {
            for (const t of tags) {
                if (!t.title) return { aborted: true };
                const existing = await this.repo.findTagByTitle(t.title);
                if (existing) {
                    await this.repo.incrementTagAndLink(existing.id, article.id);
                } else {
                    await this.repo.createTagAndLink(t.title, randomColor(), article.id);
                }
            }
        }
        return { article };
    }

    getArticlesByTagId(tagId: string) {
        return this.repo.getArticlesByTagId(tagId);
    }

    getAllArticles() {
        return this.repo.getAllArticles();
    }

    getAllTags() {
        return this.repo.getAllTags();
    }

    async updateArticle(id: string, body: Record<string, unknown>): Promise<void> {
        const exists = await this.repo.findArticle(id);
        if (!exists) throw HttpError.notFound('Article not found');
        const data: Record<string, unknown> = {};
        for (const key of ARTICLE_FIELDS) {
            if (key in body) data[key] = body[key];
        }
        await this.repo.updateArticle(id, data);
    }

    async deleteArticle(id: string): Promise<void> {
        const exists = await this.repo.findArticle(id);
        if (!exists) throw HttpError.notFound('Article not found');
        await this.repo.deleteArticle(id);
    }

    async deleteTag(id: string): Promise<void> {
        const exists = await this.repo.findTag(id);
        if (!exists) throw HttpError.notFound('Tag not found');
        await this.repo.deleteTag(id);
    }
}
