const db = require("../config/sequelize");
const randomColor = require('randomcolor');

exports.create = async (req, res) => {
    try {
        const { title, body, tags } = req.body;

        const article = await db.Articles.create({
            title,
            body,
            UserId: req.userId
        });

        if (tags) {
            for (let i = 0; i < tags.length; i++) {
                if (!tags[i].title) {
                    return;
                }
                const tagExists = await db.Tags.findOne({
                    where: db.sequelize.where(
                        db.sequelize.fn("LOWER", db.sequelize.col('title')),
                        db.sequelize.fn("LOWER", tags[i].title)
                    )
                });
                if (tagExists) {
                    const tag = await db.Tags.findOne({
                        where: db.sequelize.where(
                            db.sequelize.fn("LOWER", db.sequelize.col('title')),
                            db.sequelize.fn("LOWER", tags[i].title)
                        )
                    });
                    tag.count += 1;
                    await tag.save();
                    await tag.addArticle(article);
                } else {
                    const tag = await db.Tags.create({
                        title: tags[i].title,
                        hex: randomColor(),
                        count: db.sequelize.literal('count + 1')
                    });
                    await tag.addArticle(article);
                }
            }
        }

        return res.status(200).json(article);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.getArticlesByTagId = async (req, res) => {
    try {
        const { tagId } = req.params;

        const articles = await db.Articles.findAll({
            include: [
                {
                    model: db.Tags,
                    as: "Tags",
                    through: {
                        attributes: []
                    },
                    where: {
                        id: tagId
                    }
                }
            ],
            order: [['title', 'ASC']],
        });

        return res.status(200).json(articles);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.getAllArticles = async (req, res) => {
    try {
        const articles = await db.Articles.findAll({
            include: [
                {
                    model: db.Tags,
                    as: "Tags",
                    through: {
                        attributes: []
                    }
                }
            ],
            order: [['title', 'ASC']],
        });
        return res.status(200).json(articles);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.updateArticle = async (req, res) => {
    try {
        const { id } = req.params;
        
        const articleExists = await db.Articles.findOne({
            where: { id }
        });
        
        if (!articleExists) {
            return res.status(404).json({ message: "Article not found" })
        }

        await db.Articles.update(req.body, {
            where: { id }
        });

        return res.sendStatus(200);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.deleteArticle = async (req, res) => {
    try {
        const { id } = req.params;
        
        const articleExists = await db.Articles.findOne({
            where: { id },
            include: [
                {
                    model: db.Tags,
                    as: "Tags"
                }
            ]
        });

        if (!articleExists) {
            return res.status(404).json({ message: "Article not found" })
        }

        await articleExists.setTags([]);
        await articleExists.destroy();

        return res.sendStatus(200);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.deleteTag = async (req, res) => {
    try {
        const { id } = req.params;
        
        const tagExists = await db.Tags.findOne({
            where: { id },
        })

        if (!tagExists) {
            return res.status(404).json({ message: "Tag not found" })
        }

        await tagExists.setArticles([]);
        await tagExists.destroy();

        return res.sendStatus(200);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}

exports.getAllTags = async (req, res) => {
    try {
        const tags = await db.Tags.findAll({
            include: [
                {
                    model: db.Articles,
                    as: "Articles",
                    through: {
                        attributes: []
                    }
                }
            ],
            attributes: {
                include: [
                    [db.sequelize.literal('(SELECT COUNT(*) FROM `article_tags` WHERE `article_tags`.`TagId` = `Tags`.`id`)'), 'articlesCount']
                ]
            },
            group: ['Tags.id', 'Articles.id'],
            order: [['title', 'ASC']],
        })

        return res.status(200).json(tags);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}