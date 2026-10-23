const express = require('express');
const router = express.Router();
const db = require('../models/db.js')
const shipmentController = require('../controllers/shipmentsController');
const auth = require('../routes/auth');

const controller =  shipmentController


    
    
router.post('', auth.authenticateToken,  controller.createShipment);
    
    
// Public, unauthenticated tracking (used by the home-page tracking modal / emailed links)
router.get('/public/track/:shipment_reference', controller.publicTrackShipment);

router.get('/track/:shipment_reference', auth.authenticateToken, controller.getShipment);
    
    
    router.get('/users/:user_id', auth.authenticateToken, auth.verifyRole(['admin', 'driver', 'agent', 'customer']), controller.getUserShipments);
 
    router.put('/status/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin','driver','agent']), controller.updateShipmentStatus);
    /* The papers a shipment is about. Anyone who is part of a shipment may see
       and attach its documents — the sender included, since the invoice and the
       packing list usually come from them. The controller checks which
       shipments that means for each role; a customer may withdraw only what
       they attached themselves. */
    router.get('/:shipment_id/documents', auth.authenticateToken, auth.verifyRole(['admin', 'driver', 'agent', 'customer']), controller.listShipmentDocuments);
    router.post('/:shipment_id/documents', auth.authenticateToken, auth.verifyRole(['admin', 'agent', 'driver', 'customer']), controller.addShipmentDocument);
    router.delete('/:shipment_id/documents/:document_id', auth.authenticateToken, auth.verifyRole(['admin', 'agent', 'customer']), controller.removeShipmentDocument);

    router.put('/:shipment_id/assign-driver', auth.authenticateToken, auth.verifyRole(['admin', 'agent']), controller.assignDriver);
    router.post('/confirm-external/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin']), controller.confirmExternalShipment);
    router.post('/push-to-partner/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin']), controller.pushToPartner);


    router.post('/cancel/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin', 'customer']), controller.cancelShipment);
    
    router.get('/admin/stats', auth.authenticateToken, auth.verifyRole(['admin']), controller.getAdminStats);
    router.get('/agent/stats', auth.authenticateToken, auth.verifyRole(['agent']), controller.getAgentStats);
    router.get('/customer/stats', auth.authenticateToken, auth.verifyRole(['customer', 'admin']), controller.getCustomerStats);
    router.get('', auth.authenticateToken, auth.verifyRole(['admin']), controller.getAllShipments);
    router.delete('/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin']), controller.deleteShipment);
    
    
module.exports = router;
