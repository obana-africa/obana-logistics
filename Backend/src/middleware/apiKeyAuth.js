const tenantController = require('../controllers/tenantController');

/**
 * Middleware to authenticate API requests using API key
 * API key should be sent in the header: Authoriation: obana_xxx
 */
const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
 
        
        if (!apiKey || !apiKey.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'API key required in Authorization header'
            });
        }
        
        apiKey = apiKey.substring(7);
        const tenant = await tenantController.validateApiKey(apiKey);

        if (!tenant) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or inactive API key'
            });
        }

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
