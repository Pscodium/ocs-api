const db = require("../config/sequelize");
const randomColor = require('randomcolor');

exports.create = async (req, res) => {
    try {
        const { title, content, hex } = req.body;
        const { categoryId, subCategoryId } = req.params;
        let subCategory = null;

        if (!title || !content) {
            return res.status(400).json({ message: "Title and content are required" });
        }

        if (!categoryId) {
            return res.status(400).json({ message: "Category ID is required" });
        }

        const category = await db.Category.findOne({
            where: { id: categoryId }
        });

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        if (subCategoryId) {
            subCategory = await db.SubCategory.findOne({
                where: { id: subCategoryId }
            });

            if (!subCategory) {
                return res.status(404).json({ message: "Sub-category not found" });
            }
        }

        const article = await db.Articles.create({
            title,
            content,
            hex,
            UserId: req.userId
        });

        await db.ArticleCategory.create({
            article_id: article.id,
            category_id: category.id,
            sub_category_id: subCategory ? subCategory.id : null
        });
        

        return res.status(200).json(article);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.createCategory = async (req, res) => {
    try {
        const { title, hex } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Category title is required" });
        }

        const category = await db.Category.create({ title, hex: hex || randomColor() });
        return res.status(201).json(category);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.createSubCategory = async (req, res) => {
    try {
        const { title, hex } = req.body;
        const { categoryId } = req.params;

        if (!title) {
            return res.status(400).json({ message: "Sub-category title is required" });
        }
        if (!categoryId) {
            return res.status(400).json({ message: "Category ID is required" });
        }

        const category = await db.Category.findOne({
            where: { id: categoryId }
        });

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        const subCategory = await db.SubCategory.create({ title, hex: hex || randomColor(), category_id: category.id });
        return res.status(201).json(subCategory);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await db.Category.findAll({
            attributes: ['id', 'title', 'hex'],
            include: [
                {
                    model: db.SubCategory,
                    as: 'subCategories',
                    attributes: ['id', 'title', 'hex'],
                    include: [
                        {
                            model: db.Articles,
                            as: 'articles',
                            attributes: ['id', 'title', 'content', 'hex', 'files'],
                            through: { attributes: [] }
                        }
                    ]
                },
                {
                    model: db.Articles,
                    as: 'articles',
                    attributes: ['id', 'title', 'content', 'hex', 'files'],
                    // somente artigos diretamente vinculados à category (sem sub_category)
                    through: { attributes: [], where: { sub_category_id: null } }
                }
            ],
            order: [
                ['title', 'ASC'],
                [{ model: db.SubCategory, as: 'subCategories' }, 'title', 'ASC'],
                [{ model: db.SubCategory, as: 'subCategories' }, { model: db.Articles, as: 'articles' }, 'title', 'ASC']
            ]
        });

        return res.status(200).json(categories);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.updateArticle = async (req, res) => {
    try {
        const { articleId } = req.params;
        const { title, content, hex, files } = req.body;

        const article = await db.Articles.findOne({ where: { id: articleId } });

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        await article.update({ title, content, hex, files });
        return res.status(200).json(article);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.deleteArticle = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { id } = req.params;
        const article = await db.Articles.findOne({ where: { id }, transaction });
        if (!article) {
            await transaction.rollback();
            return res.status(404).json({ message: "Article not found" });
        }

        // remover mappings na tabela through antes de apagar o artigo para evitar FK constraint
        await db.ArticleCategory.destroy({ where: { article_id: id }, transaction });

        await article.destroy({ transaction });

        await transaction.commit();
        return res.sendStatus(204);
    } catch (e) {
        console.error(e);
        try { await transaction.rollback(); } catch (er) { console.error(er); }
        return res.sendStatus(500);
    }
}

exports.deleteCategory = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { categoryId } = req.params;

        const category = await db.Category.findOne({ where: { id: categoryId }, transaction });
        if (!category) {
            await transaction.rollback();
            return res.status(404).json({ message: "Category not found" });
        }

        const subCategories = await db.SubCategory.findAll({ where: { category_id: categoryId }, transaction });

        for (const sc of subCategories) {
            const mappings = await db.ArticleCategory.findAll({ where: { sub_category_id: sc.id }, attributes: ['article_id'], transaction });
            const articleIds = [...new Set(mappings.map(m => m.article_id))];

            await db.ArticleCategory.destroy({ where: { sub_category_id: sc.id }, transaction });

            for (const articleId of articleIds) {
                const remaining = await db.ArticleCategory.count({ where: { article_id: articleId }, transaction });
                if (remaining === 0) {
                    await db.Articles.destroy({ where: { id: articleId }, transaction });
                }
            }
        }

        const directMappings = await db.ArticleCategory.findAll({ where: { category_id: categoryId, sub_category_id: null }, attributes: ['article_id'], transaction });
        const directArticleIds = [...new Set(directMappings.map(m => m.article_id))];

        await db.ArticleCategory.destroy({ where: { category_id: categoryId, sub_category_id: null }, transaction });

        for (const articleId of directArticleIds) {
            const remaining = await db.ArticleCategory.count({ where: { article_id: articleId }, transaction });
            if (remaining === 0) {
                await db.Articles.destroy({ where: { id: articleId }, transaction });
            }
        }

        await db.SubCategory.destroy({ where: { category_id: categoryId }, transaction });

        await db.ArticleCategory.destroy({ where: { category_id: categoryId }, transaction });

        await category.destroy({ transaction });

        await transaction.commit();
        return res.sendStatus(204);
    } catch (e) {
        console.error(e);
        try { await transaction.rollback(); } catch (er) { console.error(er); }
        return res.sendStatus(500);
    }
}

exports.deleteSubCategory = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const { subCategoryId } = req.params;

        const subCategory = await db.SubCategory.findOne({ where: { id: subCategoryId }, transaction });
        if (!subCategory) {
            await transaction.rollback();
            return res.status(404).json({ message: "Sub-category not found" });
        }

        const mappings = await db.ArticleCategory.findAll({ where: { sub_category_id: subCategoryId }, attributes: ['article_id'], transaction });
        const articleIds = [...new Set(mappings.map(m => m.article_id))];

        await db.ArticleCategory.destroy({ where: { sub_category_id: subCategoryId }, transaction });

        for (const articleId of articleIds) {
            const remaining = await db.ArticleCategory.count({ where: { article_id: articleId }, transaction });
            if (remaining === 0) {
                await db.Articles.destroy({ where: { id: articleId }, transaction });
            }
        }

        await subCategory.destroy({ transaction });

        await transaction.commit();
        return res.sendStatus(204);
    } catch (e) {
        console.error(e);
        try { await transaction.rollback(); } catch (er) { console.error(er); }
        return res.sendStatus(500);
    }
}