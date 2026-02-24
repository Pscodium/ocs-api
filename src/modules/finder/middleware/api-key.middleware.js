/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
exports.apiKeyValidator = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ error: 'API Key is required' });
    }

    if (apiKey !== process.env.FINDER_API_KEY) {
        return res.status(401).json({ error: 'Invalid API Key' });
    }

    next();
};
