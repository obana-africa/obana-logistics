const db = require('../models/db.js');
const { Op } = require('sequelize');
const crypto = require('crypto');
const mailer = require('../mailer/sendgrid');
const userController = require('./userController');


class WebhookController {

    /**
     * MAIN TERMINAL AFRICA WEBHOOK HANDLER
     * Use this as the single source of truth for Terminal Africa webhooks
     */
    handleTerminalAfricaWebhook = async (req, res) => {
        const io = req.app.get('socketio');

        try {
            // Verify webhook signature
            const SECRET_KEY = process.env.TERMINAL_AFRICA_SECRET_KEY || process.env.NEXT_PUBLIC_TERMINAL_AFRICA_SECRET_KEY;
            const signature = req.headers['x-terminal-signature'];
            const payload = req.body;

            const hash = req.headers['x-terminal-signature'];

            // Simplified event detection: TA sometimes wraps the object in {event, data} 
            // or sends the raw shipment object.
            let event = payload.event;
            let data = payload.data;

            if (!event && payload.shipment_id) {
                // Fallback for raw shipment object payload
                data = payload;
                event = `shipment.${data.status?.replace('-', '.') || 'updated'}`;
            }

            if (!data || !data.shipment_id) {
                console.warn('Webhook received without valid shipment data');
                return res.status(400).send('Invalid payload');
            }

            // Process the webhook
            await this.processTerminalAfricaEvent(event, data, io);

            // await this.logWebhook(event, data?.shipment_id, null, payload);
            return res.status(200).send('Webhook processed');

        } catch (error) {
            console.error('Webhook processing error:', error);
            // await this.logWebhook('processing_error', null, null, req.body, error.message);
            return res.status(500).send('Error processing webhook');
        }
    }

    /**
     * PROCESS TERMINAL AFRICA EVENTS
     */
    processTerminalAfricaEvent = async (event, data, io) => {
        // Find shipment by shipment_id
        let shipment = null;
        if (data?.shipment_id) {
            shipment = await db.shippings.findOne({
                where: { external_shipment_id: data.shipment_id },
                include: [
                    { model: db.addresses, as: 'delivery_address' }
                ]
            });
        }



        // Shipment status mapping
        const eventToStatus = {
            'shipment.created': 'created',
            'shipment.updated': 'in_transit', 
            'shipment.in.transit': 'in_transit',
            'shipment.out.for.delivery': 'dispatched',
            'shipment.delivered': 'delivered',
            'shipment.cancelled': 'cancelled',
            'shipment.exception': 'exception'
        };

        // Handle events
        switch (event) {
            case 'shipment.created':
            case 'shipment.updated':
            case 'shipment.in-transit':
            case 'shipment.in.transit':
            case 'shipment.out-for-delivery':
            case 'shipment.delivered':
            case 'shipment.cancelled':
            case 'shipment.exception':
                await this.handleShipmentEvent(event, data, shipment, io);
                break;

            case 'transaction.success':
                // await this.handleTransactionSuccess(event, data, order, io);

                break;

            case 'transaction.failed':
                await this.handleTransactionFailed(event, data, order, io);
                break;

            case 'tracking.updated':
                await this.handleTrackingUpdate(event, data, shipment, order, io);
                break;

            default:
                console.log(`Unhandled webhook event: ${event}`);
                // await this.logWebhook(event, data?.shipment_id, order?.id, data, 'Unhandled event type');
                break;
        }
    }

    /**
     * HANDLE SHIPMENT EVENTS
     */
    handleShipmentEvent = async (event, data, shipment, io) => {
        const eventToStatus = {
            'shipment.created': 'created',
            'shipment.updated': 'in_transit',
            'shipment.in.transit': 'in_transit',
            'shipment.in_transit': 'in_transit',
            'shipment.in-transit': 'in_transit',
            'shipment.out.for.delivery': 'dispatched',
            'shipment.delivered': 'delivered',
            'shipment.cancelled': 'cancelled',
            'shipment.exception': 'exception'
        };

        const status = eventToStatus[event] || 'unknown';

        if (shipment) {
            // Update shipment status
            await shipment.update({
                status: status,
                
            });

            // Create tracking record
            await db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: status,
                description: data.status_description || `External carrier updated status to ${status}`,
                location: data.location || '',
                metadata: JSON.stringify(data),
                source: 'carrier_api',
                performed_by: 'terminal_africa'
            });

            // Send status email to customer
            await this.sendShipmentStatusEmail(shipment, status, data);

            // Notify frontend
            this.notifyFrontend(io, event, {
                shipment_id: data.shipment_id,
                shipment_reference: shipment.shipment_reference,
                status: status,
                tracking_number: data.tracking_number,
                tracking_url: data.tracking_url
            });
        }
    }

    /**
     * HANDLE TRANSACTION SUCCESS
     */
    handleTransactionSuccess = async (event, data, order, io) => {
        if (order) {
            await order.update({
                payments: 'paid',

                shipping_fee: data.amount
            });

            this.notifyFrontend(io, event, {
                order_id: order.id,
                transaction_id: data.transaction_id,
                amount: data.amount
            });

            await this.sendPaymentEmail(order, 'success', data);
        }
    }

    /**
     * HANDLE TRANSACTION FAILED
     */
    handleTransactionFailed = async (event, data, order, io) => {
        if (order) {
            await order.update({
                payments: 'failed',
                payment_failure_reason: data.reason
            });

            this.notifyFrontend(io, event, {
                order_id: order.id,
                reason: data.reason
            });

            await this.sendPaymentEmail(order, 'failed', data);
        }
    }

    /**
     * HANDLE TRACKING UPDATE
     */
    handleTrackingUpdate = async (event, data, shipment, order, io) => {
        if (shipment) {
            await shipment.update({
                tracking_number: data.tracking_number,
                tracking_url: data.tracking_url
            });

            this.notifyFrontend(io, event, {
                shipment_id: data.shipment_id,
                tracking_number: data.tracking_number,
                tracking_url: data.tracking_url
            });
        }
    }

    sendShipmentStatusEmail = async (shipment, status, data) => {
        try {
            const statusEmails = {
                'created': {
                    subject: 'Shipment Created - Tracking Information',
                    template: 'shipment_created'
                },
                'in_transit': {
                    subject: 'Your Order is In Transit',
                    template: 'shipment_in_transit'
                },
                'out_for_delivery': {
                    subject: 'Your Order is Out for Delivery',
                    template: 'shipment_out_for_delivery'
                },
                'delivered': {
                    subject: 'Order Delivered Successfully',
                    template: 'shipment_delivered'
                },
                'cancelled': {
                    subject: 'Shipment Cancelled',
                    template: 'shipment_cancelled'
                }
            };

            const emailConfig = statusEmails[status];
            if (!emailConfig) return;

            const trackingInfo = shipment?.tracking_number ?
                `<p><strong>Tracking Number:</strong> ${shipment.tracking_number}</p>` :
                '';

            const trackingLink = shipment?.tracking_url ?
                `<p><a href="${shipment.tracking_url}" style="color: #1b3b5f;">Track Your Package</a></p>` :
                '';

            const emailContent = `
                <h2>Shipment Update</h2>
                
                <p><strong>Status:</strong> ${status.replace('_', ' ').toUpperCase()}</p>
                ${trackingInfo}
                ${trackingLink}
                <p>Thank you for your business!</p>
            `;

            // Send to customer (from shipment_details)
            await this.sendCustomerEmail(
                shipment,
                emailConfig.subject,
                emailContent,
                emailConfig.template
            );

            

        } catch (error) {
            console.error('Error sending shipment status email:', error);
        }
    }

    /**
     * PAYMENT EMAIL
     */
    sendPaymentEmail = async (order, status, data) => {
        try {
            const subject = status === 'success'
                ? 'Payment Received Successfully'
                : 'Payment Failed';

            const content = status === 'success'
                ? `
                    <h2>Payment Confirmed</h2>
                    <p>Your payment for order <strong>${order.order_ref}</strong> was successful.</p>
                    <p><strong>Transaction ID:</strong> ${data.transaction_id}</p>
                    <p><strong>Amount Paid:</strong> ₦${data.amount}</p>
                    <p>Thank you for your payment!</p>
                `
                : `
                    <h2>Payment Failed</h2>
                    <p>Your payment for order <strong>${order.order_ref}</strong> failed.</p>
                    <p><strong>Reason:</strong> ${data.reason}</p>
                    <p>Please try again or contact support.</p>
                `;

            await this.sendCustomerEmail(order, subject, content, `payment_${status}`);

        } catch (error) {
            console.error('Error sending payment email:', error);
        }
    }

    /**
     * HANDLE DELIVERY COMPLETION
     */
    handleDeliveryCompletion = async (order) => {
        try {
            order.delivered_at = new Date();
            await order.save();

            // Approve agent commission
            await this.approveAgentCommission(order);

        } catch (error) {
            console.error('Error handling delivery completion:', error);
        }
    }

    /**
     * HANDLE SHIPMENT CANCELLATION
     */
    handleShipmentCancellation = async (order, data) => {
        try {
            order.cancellation_reason = data.cancellation_reason;
            await order.save();

            // Reverse commission if needed
            if (order.commission && order.order_id) {
                await walletController.reverseCommision(order.order_id, order.amount);
            }

        } catch (error) {
            console.error('Error handling shipment cancellation:', error);
        }
    }

    /**
     * APPROVE AGENT COMMISSION
     */
    approveAgentCommission = async (order) => {
        try {
            if (order.agent_id && order.commission > 0) {
                console.log(` Commission approved for agent ${order.agent_id}: ₦${order.commission}`);
                // Implement your commission approval logic here
                // await walletController.approveCommission(order.agent_id, order.commission, order.id);
            }
        } catch (error) {
            console.error('Error approving agent commission:', error);
        }
    }

    
    /**
     * Extract email from shipment_details
     */
    getCustomerEmail = async (shipment) => {
        if (shipment.delivery_address?.contact_email) {
            return shipment.delivery_address.contact_email;
        }
        if (shipment.user_id) {
            const user = await db.users.findByPk(shipment.user_id);
            return user?.email;
        }
        return null;
    };

    /**
     * Send email to customer
     */
    sendCustomerEmail = async (shipment, subject, emailData, template) => {
        try {
            const customerEmail = await this.getCustomerEmail(shipment);

            if (!customerEmail) {
                console.log(' No customer email found for shipment:', shipment.shipment_reference);
                return false;
            }

            await mailer.sendMail({
                email: customerEmail,
                subject: subject,
                content: emailData,
                template: template
            });

            // await this.logWebhook(`email_${template}_sent`, shipment.shipment_reference, null, {
            //     recipient: customerEmail,
            //     subject: subject,
            //     email_type: template,
            //     sent_at: new Date()
            // });

            return true;
        } catch (error) {
            console.error('Error sending customer email:', error);

            // await this.logWebhook(`email_${template}_failed`, shipment.shipment_reference, null, {
            //     error: error.message,
            //     subject: subject
            // });

            return false;
        }
    }

    /**
     * Log webhook events
     */
    logWebhook = async (event_type, shipment_id, order_id, payload, error_message = null) => {
        try {
            await db.webhook_logs.create({
                event_type,
                shipment_id,
                order_id,
                payload: JSON.stringify(payload),
                error_message,
                processed: !error_message
            });
        } catch (error) {
            console.error('Error logging webhook:', error);
        }
    }

    /**
     * Append tracking history
     */
    appendTrackingHistory = async (order, status, description, metadata = {}) => {
        try {
            let trackingHistory = [];

            if (order.tracking_history) {
                try {
                    trackingHistory = JSON.parse(order.tracking_history);
                } catch (e) {
                    console.error('Error parsing tracking history:', e);
                }
            }

            trackingHistory.push({
                timestamp: new Date(),
                status: status,
                description: description,
                metadata: metadata,
                source: 'terminal_africa'
            });

            order.tracking_history = JSON.stringify(trackingHistory);
            await order.save();
        } catch (error) {
            console.error('Error appending tracking history:', error);
        }
    }

    /**
     * Notify frontend via Socket.IO
     */
    notifyFrontend = (io, event, data) => {
        try {
            if (io) {
                io.emit('shipment_update', {
                    event,
                    ...data,
                    timestamp: new Date()
                });
                console.log(` Socket.IO notification sent: ${event} for shipment ${data.shipment_id}`);
            }
        } catch (error) {
            console.error('Error notifying frontend:', error);
        }
    }

    /**
     * Get webhook logs for debugging
     */
    getWebhookLogs = async (req, res) => {
        try {
            const { page = 1, limit = 20, event_type, processed } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (event_type) whereClause.event_type = event_type;
            if (processed !== undefined) whereClause.processed = processed === 'true';

            const logs = await db.webhook_logs.findAndCountAll({
                where: whereClause,
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return res.status(200).json({
                success: true,
                data: logs.rows,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(logs.count / limit),
                    total_items: logs.count
                }
            });

        } catch (error) {
            console.error('Get webhook logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching webhook logs',
                error: error.message
            });
        }
    }


}

// Export singleton instance
module.exports = new WebhookController();