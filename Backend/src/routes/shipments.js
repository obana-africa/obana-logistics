const express = require('express');
const router = express.Router();
const db = require('../models/db.js')
const shipmentController = require('../controllers/shipmentsController');
const auth = require('../routes/auth');
const { authenticateApiKey } = require('../middleware/apiKeyAuth');
const controller =  shipmentController

// Helper middleware: Accept either JWT or API key
const authenticateRequest = (req, res, next) => {
    const hasJWT = req.headers['authorization'];
    const hasApiKey = req.headers['api-key'];

    if (hasJWT) {
        // Use JWT authentication
        auth.authenticateToken(req, res, next);
    } else if (hasApiKey) {
        // Use API key authentication
        authenticateApiKey(req, res, next);
    } else {
        return res.status(401).json({
            success: false,
            message: 'Authentication required: Provide Authorization (JWT) or Authorization header'
        });
    }
};
    
    
router.post('', authenticateRequest,  controller.createShipment);
    
    
router.get('/track/:shipment_reference', authenticateRequest, controller.getShipment);
    
    
    router.get('/users/:user_id', auth.authenticateToken, auth.verifyRole(['admin', 'driver', 'agent', 'customer']), controller.getUserShipments);
 
    router.put('/status/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin','driver','agent']), controller.updateShipmentStatus);
    router.put('/:shipment_id/assign-driver', auth.authenticateToken, auth.verifyRole(['admin', 'agent']), controller.assignDriver);


    router.post('/cancel/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin', 'customer']), controller.cancelShipment);
    
    router.get('/admin/stats', auth.authenticateToken, auth.verifyRole(['admin']), controller.getAdminStats);
    router.get('/agent/stats', auth.authenticateToken, auth.verifyRole(['agent']), controller.getAgentStats);
    router.get('/customer/stats', auth.authenticateToken, auth.verifyRole(['customer', 'admin']), controller.getCustomerStats);
    router.get('', auth.authenticateToken, auth.verifyRole(['admin']), controller.getAllShipments);
    router.delete('/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin']), controller.deleteShipment);
    
    
module.exports = router;
