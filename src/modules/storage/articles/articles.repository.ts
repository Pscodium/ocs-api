import { prisma } from '../../../config/database';

/**
 * Articles/Tags repository on PRISMA (docs §8 step 6; ORM = Prisma). Uses the
 * explicit join model ArticleTag (table `article_tags`).
 *
 * ⚠️ Parity: the legacy Sequelize controller returned articles with a flat `Tags`
 * array (belongsToMany `as: "Tags"`, join attributes excluded). Prisma's explicit
 * join yields nested `{ tag }` rows, so results are RESHAPED here to reproduce the
 * legacy `Tags: Tag[]` shape. Verify against the real payloads after db:pull.
 */
type TagRow = { tag: Record<string, unknown> };
type ArticleWithJoin = Record<string, unknown> & { tags?: TagRow[] };

function reshapeArticle(article: ArticleWithJoin): Record<string, unknown> {
    const { tags, ...rest } = article;
    return { ...rest, Tags: (tags ?? []).map((t) => t.tag) };
}

export class ArticlesRepository {
    async createArticle(title: string, body: string, userId?: string) {
        return prisma.articles.create({ data: { title, body, userId } });
    }

    /** Case-insensitive tag lookup by title (MySQL default collation is CI). */
    findTagByTitle(title: string) {
        return prisma.tags.findFirst({ where: { title } });
    }

    async incrementTagAndLink(tagId: string, articleId: string): Promise<void> {
        await prisma.tags.update({ where: { id: tagId }, data: { count: { increment: 1 } } });
        await prisma.articleTag.create({ data: { ArticleId: articleId, TagId: tagId } });
    }

    async createTagAndLink(title: string, hex: string, articleId: string): Promise<void> {
        const tag = await prisma.tags.create({ data: { title, hex, count: 1 } });
        await prisma.articleTag.create({ data: { ArticleId: articleId, TagId: tag.id } });
    }

    async getArticlesByTagId(tagId: string): Promise<Record<string, unknown>[]> {
        const rows = await prisma.articles.findMany({
            where: { tags: { some: { TagId: tagId } } },
            include: { tags: { where: { TagId: tagId }, include: { tag: true } } },
            orderBy: { title: 'asc' },
        });
        return rows.map((r) => reshapeArticle(r as ArticleWithJoin));
    }

    async getAllArticles(): Promise<Record<string, unknown>[]> {
        const rows = await prisma.articles.findMany({
            include: { tags: { include: { tag: true } } },
            orderBy: { title: 'asc' },
        });
        return rows.map((r) => reshapeArticle(r as ArticleWithJoin));
    }

    findArticle(id: string) {
        return prisma.articles.findUnique({ where: { id } });
    }

    async updateArticle(id: string, data: Record<string, unknown>): Promise<void> {
        await prisma.articles.update({ where: { id }, data });
    }

    /** Removes an article and its tag links (setTags([]) + destroy in legacy). */
    async deleteArticle(id: string): Promise<void> {
        await prisma.articleTag.deleteMany({ where: { ArticleId: id } });
        await prisma.articles.delete({ where: { id } });
    }

    findTag(id: string) {
        return prisma.tags.findUnique({ where: { id } });
    }

    async deleteTag(id: string): Promise<void> {
        await prisma.articleTag.deleteMany({ where: { TagId: id } });
        await prisma.tags.delete({ where: { id } });
    }

    /** Tags with their linked Articles + articlesCount (legacy subquery -> _count). */
    async getAllTags(): Promise<Record<string, unknown>[]> {
        const rows = await prisma.tags.findMany({
            include: {
                articles: { include: { article: true } },
                _count: { select: { articles: true } },
            },
            orderBy: { title: 'asc' },
        });
        return rows.map((tag) => {
            const { articles, _count, ...rest } = tag as Record<string, unknown> & {
                articles: Array<{ article: Record<string, unknown> }>;
                _count: { articles: number };
            };
            return { ...rest, Articles: articles.map((a) => a.article), articlesCount: _count.articles };
        });
    }
}
