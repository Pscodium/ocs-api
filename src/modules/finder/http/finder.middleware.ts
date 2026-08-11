import type { RequestHandler } from 'express';
import { env } from '../../../config/env';

/**
 * API-key gate for the finder module (TS port of api-key.middleware.js).
 * Finder uses a static API key, not JWT (docs §2.3, §7 "auth divergente").
 */
export const apiKeyValidator: RequestHandler = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        res.status(401).json({ error: 'API Key is required' });
        return;
    }
    if (apiKey !== env.FINDER_API_KEY) {
        res.status(401).json({ error: 'Invalid API Key' });
        return;
    }
    next();
};
