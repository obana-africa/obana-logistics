const db = require('../models/db');

/**
 * Middleware to authenticate API requests using API key
 * API key should be sent in the header: Authoriation: obana_xxx
 */
const authenticateApiKey = async (req, res, next) => {
    try {
        let apiKey = req.headers['x-api-key'];
 
        
        if (!apiKey || !apiKey.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'API key required in Authorization header'
            });
        }
        
        apiKey = apiKey.substring(7);
        
        // Find the user attribute by API key
        const apiKeyAttribute = await db.attributes.findOne({ where: { slug: 'api_key' } });

        if (!apiKeyAttribute) {
          return res.status(500).json({ success: false, message: 'API Key attribute not found' });
        }

        const userAttribute = await db.user_attributes.findOne({
          where: { attribute_id: apiKeyAttribute.id, value: apiKey },
          include: [{ model: db.users, as: 'user' }]
        });

        if (!userAttribute || !userAttribute.user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or inactive API key'
            });
        }

        const tenant = userAttribute.user;
        req.tenant = tenant;
        next();
    } catch (error) {
        console.error('API Key authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

module.exports = {
    authenticateApiKey
};
