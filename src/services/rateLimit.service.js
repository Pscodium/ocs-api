const { getRateLimitStatus } = require('../middleware/featureFlags');

/**
 * Service to manage rate limiting operations
 */
class RateLimitService {
    /**
     * Get rate limit status for multiple resources
     * @param {string} userId - User ID
     * @param {string} plan - User plan
     * @returns {Promise<Object>} - Rate limit status for all resources
     */
    async getUserRateLimitStatus(userId, plan) {
        const resources = ['months', 'budgets', 'investments', 'goals', 'subscriptions'];
        const operations = ['create', 'update', 'delete'];
        
        const status = {};

        for (const resource of resources) {
            status[resource] = {};
            for (const operation of operations) {
                const limitStatus = await getRateLimitStatus(userId, plan, resource, operation);
                if (limitStatus) {
                    status[resource][operation] = limitStatus;
                }
            }
        }

        return status;
    }

    /**
     * Get rate limit status for a specific resource
     * @param {string} userId - User ID
     * @param {string} plan - User plan
     * @param {string} resource - Resource name
     * @returns {Promise<Object>} - Rate limit status for the resource
     */
    async getResourceRateLimitStatus(userId, plan, resource) {
        const operations = ['create', 'update', 'delete'];
        const status = {};

        for (const operation of operations) {
            const limitStatus = await getRateLimitStatus(userId, plan, resource, operation);
            if (limitStatus) {
                status[operation] = limitStatus;
            }
        }

        return status;
    }
}

module.exports = new RateLimitService();
