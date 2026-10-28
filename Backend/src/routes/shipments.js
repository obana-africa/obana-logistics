const express = require('express');
const router = express.Router();
const db = require('../models/db.js')
const shipmentController = require('../controllers/shipmentsController');
const auth = require('../routes/auth');
const drafts = require('../controllers/shipmentDraftsController');

const controller =  shipmentController


    
    
router.post('', auth.authenticateToken,  controller.createShipment);

/* Bookings in progress, and the people this account has sent to before.
   Above the '/:shipment_id' routes below, or "drafts" would be read as a
   shipment id and answer 404 for everyone. */
router.get('/drafts', auth.authenticateToken, drafts.listDrafts);
router.post('/drafts', auth.authenticateToken, drafts.saveDraft);
router.put('/drafts/:id', auth.authenticateToken, drafts.saveDraft);
router.delete('/drafts/:id', auth.authenticateToken, drafts.deleteDraft);
router.get('/recent-customers', auth.authenticateToken, drafts.recentCustomers);
    
    
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
    /* The summary as a PDF, for anyone already entitled to see the shipment.
       Admins and agents forward it to customers; a customer can fetch their
       own without having to ask. */
    router.get('/:shipment_id/summary.pdf', auth.authenticateToken, auth.verifyRole(['admin', 'driver', 'agent', 'customer']), controller.downloadShipmentSummary);
    router.get('/:shipment_id/documents', auth.authenticateToken, auth.verifyRole(['admin', 'driver', 'agent', 'customer']), controller.listShipmentDocuments);
    router.post('/:shipment_id/documents', auth.authenticateToken, auth.verifyRole(['admin', 'agent', 'driver', 'customer']), controller.addShipmentDocument);
    router.delete('/:shipment_id/documents/:document_id', auth.authenticateToken, auth.verifyRole(['admin', 'agent', 'customer']), controller.removeShipmentDocument);

    /* The waybill number, with or without the paperwork behind it. */
    router.put('/:shipment_id/awb', auth.authenticateToken, auth.verifyRole(['admin', 'agent', 'driver']), controller.setShipmentAwb);

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
