const { Op } = require('sequelize');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../models/db');
const mailer = require('../mailer/sendgrid');

const TERMINAL_AFRICA_BASE_URL = process.env.TERMINAL_AFRICA_BASE_URL;
const TERMINAL_AFRICA_SECRET_KEY = process.env.TERMINAL_AFRICA_SECRET_KEY;

const taClient = axios.create({
    baseURL: TERMINAL_AFRICA_BASE_URL,
    headers: { 'Authorization': `Bearer ${TERMINAL_AFRICA_SECRET_KEY}`, 'Content-Type': 'application/json' }
});

const validateShipmentPayload = (payload) => {
    const errors = [];
console.log("PAYLOAD", JSON.stringify(payload))
    if (!payload.pickup_address) {
        errors.push('pickup_address is required');
    } else {
        const addr = payload.pickup_address;
        if (!addr.line1) errors.push('pickup_address.line1 is required');
        if (!addr.city) errors.push('pickup_address.city is required');
        if (!addr.state) errors.push('pickup_address.state is required');
        if (!addr.country) errors.push('pickup_address.country is required');
        if (!addr.phone) errors.push('pickup_address.phone is required');
    }

    if (!payload.delivery_address) {
        errors.push('delivery_address is required');
    } else {
        const addr = payload.delivery_address;
        if (!addr.line1) errors.push('delivery_address.line1 is required');
        if (!addr.city) errors.push('delivery_address.city is required');
        if (!addr.state) errors.push('delivery_address.state is required');
        if (!addr.country) errors.push('delivery_address.country is required');
        if (!addr.phone) errors.push('delivery_address.phone is required');
    }
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
        errors.push('items array is required with at least one item');
    }
    if (!payload.transport_mode) {
        errors.push('transport_mode is required (road, air, or sea)');
    } else if (!['road', 'air', 'sea'].includes(payload.transport_mode)) {
        errors.push('transport_mode must be one of: road, air, sea');
    }
    if (!payload.service_level) {
        errors.push('service_level is required (Express, Standard, or Economy)');
    } else if (!['Express', 'Standard', 'Economy'].includes(payload.service_level)) {
        errors.push('service_level must be one of: Express, Standard, Economy');
    }

    console.log(errors)

    return {
        valid: errors.length === 0,
        errors
    };
};

const generateShipmentReference = (isInternal = true) => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    const prefix = isInternal ? 'OBN' : 'TERM';
    return `${prefix}-${dateStr}-${random}`;
};

const calculateShipmentTotals = (items) => {
    let totalWeight = 0;
    let totalValue = 0;
    let itemCount = 0;

    if (items && Array.isArray(items)) {
        items.forEach(item => {
            const weight = parseFloat(item.weight) || 0;
            const value = parseFloat(item.total_price) || parseFloat(item.value) || parseFloat(item.price) || 0;
            const quantity = parseInt(item.quantity) || 1;
            
            totalWeight += weight;
            // totalWeight += weight * quantity;
            totalValue += value;
            itemCount += quantity;
        });
    }

    return { totalWeight, totalValue, itemCount };
};

const getVehicleTypesForTransportMode = (transportMode) => {

    const modeToVehicles = {
        'road': ['car', 'van', 'truck', 'bike'],
        'air': ['car', 'van'],  
        'sea': ['van', 'truck']  
    };
    
    return modeToVehicles[transportMode] || ['car', 'bike', 'van', 'truck'];
};

const triggerPostCreationProcesses = async (shipmentId, isInternal) => {
    setImmediate(async () => {
        try {
            
            await sendShipmentConfirmation(shipmentId);
            
            
            if (isInternal) {
                await notifyPickupTeam(shipmentId);
            }
            
         
            await updateOrderStatus(shipmentId);
            
        } catch (error) {
            console.error('Error in post-creation processes:', error);
        
        }
    });
};

const sendShipmentConfirmation = async (shipmentId) => {
    try {
        const shipment = await db.shippings.findByPk(shipmentId, {
            include: [
                { model: db.addresses, as: 'delivery_address' }
            ]
        });
        
        if (shipment && shipment.delivery_address?.contact_email) {
            console.log(`[NOTIFICATION] Sending confirmation email to ${shipment.delivery_address.contact_email} for shipment ${shipment.shipment_reference}`);
            
        }
    } catch (error) {
        console.error('Error sending confirmation:', error);
    }
};

const notifyPickupTeam = async (shipmentId) => {
    try {
        const shipment = await db.shippings.findByPk(shipmentId, {
            include: [
                { model: db.addresses, as: 'pickup_address' }
            ]
        });
        
        if (shipment && shipment.carrier_type === 'internal') {
            console.log(`[AGENT NOTIFICATION] New internal shipment ${shipment.shipment_reference} needs pickup from ${shipment.pickup_address?.line1}`);
            
        }
    } catch (error) {
        console.error('Error notifying pickup team:', error);
    }
};

const updateOrderStatus = async (shipmentId) => {
    try {
    
        console.log(`[ORDER SYNC] Would update order status for shipment ${shipmentId}`);
    } catch (error) {
        console.error('Error updating order status:', error);
    }
};

/**
 * Send email notification for new internal shipment
 */
const sendNewShipmentEmail = async (shipment, deliveryAddress, pickupAddress) => {
    try {
        
        let agentData = { name: 'Unassigned', email: '', code: '' };
        if (shipment.agent_id) {
            const agent = await db.agents.findByPk(shipment.agent_id, {
                include: [{ model: db.users, as: 'user' }]
            });
            
            if (agent && agent.user) {
                // Fetch attributes to get agent's name
                const attributes = await db.user_attributes.findAll({
                    where: { user_id: agent.user.id },
                    include: [{ model: db.attributes, as: 'attribute' }]
                });
                
                const attrMap = {};
                attributes.forEach(a => { if (a.attribute) attrMap[a.attribute.slug] = a.value; });
                
                agentData = {
                    name: `${attrMap.first_name || ''} ${attrMap.last_name || ''}`.trim() || 'Agent',
                    email: agent.user.email,
                    code: agent.agent_code
                };
            }
        }

        
        let customerEmail = deliveryAddress.contact_email;
        if (shipment.user_id) {
             const user = await db.users.findByPk(shipment.user_id);
             if (user && user.email) {
                 customerEmail = user.email;
             }
        }
        
        const emailData = {
            shipment_reference: shipment.shipment_reference,
            order_reference: shipment.order_reference,
            customer_name: deliveryAddress.name || 'Customer',
            customer_email: customerEmail,
            vendor_name: shipment.vendor_name,
            total_items: shipment.total_items,
            total_weight: shipment.total_weight,
            product_value: shipment.product_value,
            shipping_fee: shipment.shipping_fee,
            currency: shipment.currency,
            pickup_contact_name: pickupAddress.name || 'Vendor',
            pickup_address_line: `${pickupAddress.line1}${pickupAddress.line2 ? ', ' + pickupAddress.line2 : ''}`,
            pickup_city: pickupAddress.city,
            pickup_state: pickupAddress.state,
            pickup_country: pickupAddress.country,
            pickup_phone: pickupAddress.phone,
            pickup_instructions: pickupAddress.instructions || '',

            delivery_contact_name: deliveryAddress.name || 'Customer',
            delivery_address_line: `${deliveryAddress.line1}${deliveryAddress.line2 ? ', ' + deliveryAddress.line2 : ''}`,
            delivery_city: deliveryAddress.city,
            delivery_state: deliveryAddress.state,
            delivery_country: deliveryAddress.country,
            delivery_phone: deliveryAddress.phone,
            delivery_instructions: deliveryAddress.instructions || '',
            
            agent_name: agentData.name,
            agent_email: agentData.email,
            agent_code: agentData.code,
            
            is_insured: shipment.is_insured,
            insurance_amount: shipment.insurance_amount,
            
            
            notes: shipment.notes || '',
            
            
            dashboard_url: process.env.DASHBOARD_URL || 'https://logistics.obana.africa'
        };

        
        if (customerEmail) {
            await mailer.sendMail({
                email: customerEmail, 
                subject: `Your Shipment has been created: ${shipment.shipment_reference}`,
                content: emailData,
                template: 'newShipmentCustomer'
            });
        }

        
        if (agentData.email) {
            await mailer.sendMail({
                email: agentData.email, 
                subject: `New Shipment Assigned: ${shipment.shipment_reference}`,
                content: emailData,
                template: 'newShipmentAgent'
            });
        }

        
        const adminEmails = [ 'chimebukaanyanwu@gmail.com', 'product@obana.africa', 'shipment@obana.africa'];
        for (const email of adminEmails) {
            await mailer.sendMail({
                email: email, 
                subject: `New Shipment Alert: ${shipment.shipment_reference}`,
                content: emailData,
                template: 'newShipmentAdmin'
            });
        }
        
        console.log(`Role-based emails sent for shipment ${shipment.shipment_reference}`);

    } catch (error) {
        console.error('Error sending shipment email:', error);
        
    }
}

/**
 * Send status update email
 */
const sendStatusUpdateEmail = async (shipment, status, trackingEvent) => {
    try {
        let customerEmail = null;
        if (shipment.user_id) {
            const user = await db.users.findByPk(shipment.user_id);
            if (user) customerEmail = user.email;
        }
        
        if (!customerEmail && shipment.delivery_address_id) {
            const address = await db.addresses.findByPk(shipment.delivery_address_id);
            if (address) customerEmail = address.contact_email;
        }
        
        const emails = customerEmail ? [customerEmail] : [];
        
        const emailData = {
            shipment_reference: shipment.shipment_reference,
            order_reference: shipment.order_reference,
            vendor_name: shipment.vendor_name,
            status: status,
            status_description: trackingEvent.description || `Status changed to ${status}`,
            location: trackingEvent.location || 'Not specified',
            notes: trackingEvent.notes || '',
            updated_by: trackingEvent.performed_by || 'System',
            updated_at: new Date().toLocaleString(),
            dashboard_url: process.env.DASHBOARD_URL || 'https://logistics.obana.africa'
        };

        for (const email of emails) {
            await mailer.sendMail({
                email: email,
                subject: ` Shipment Update: ${shipment.shipment_reference} - ${status.toUpperCase()}`,
                content: emailData,
                template: 'statusUpdate' 
            });
        }

    } catch (error) {
        console.error('Error sending status update email:', error);
    }
}
// Controller object
const shipmentController = {
    /**
     * Get admin dashboard statistics
     */
    getAdminStats: async (req, res) => {
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const [
                totalRoutes,
                activeDrivers,
                pendingShipments,
                revenueResult,
                recentTracking,
                recentUsers,
                recentRoutes
            ] = await Promise.all([
                db.route_templates.count(),
                db.drivers.count({ where: { status: 'active' } }),
                db.shippings.count({ where: { status: 'pending' } }),
                db.shippings.sum('shipping_fee', {
                    where: {
                        createdAt: { [Op.gte]: startOfMonth },
                        status: { [Op.notIn]: ['cancelled', 'failed'] }
                    }
                }),
                db.shipment_tracking.findAll({
                    limit: 5,
                    order: [['createdAt', 'DESC']],
                    include: [{
                        model: db.shippings,
                        as: 'shipment',
                        attributes: ['shipment_reference', 'user_id']
                    }]
                }),
                db.users.findAll({
                    limit: 5,
                    order: [['createdAt', 'DESC']],
                    attributes: ['email', 'phone', 'createdAt']
                }),
                db.route_templates.findAll({
                    limit: 5,
                    order: [['updatedAt', 'DESC']],
                    attributes: ['origin_city', 'destination_city', 'updatedAt']
                })
            ]);

            // Normalize and merge activities
            const activities = [];
            
            recentTracking.forEach(t => {
                activities.push({
                    type: 'shipment',
                    description: t.description || t.status,
                    performed_by: t.performed_by,
                    reference: t.shipment?.shipment_reference,
                    createdAt: t.createdAt
                });
            });

            recentUsers.forEach(u => {
                activities.push({
                    type: 'user',
                    description: 'New User Signup',
                    performed_by: u.email,
                    reference: u.phone,
                    createdAt: u.createdAt
                });
            });

            recentRoutes.forEach(r => {
                activities.push({
                    type: 'route',
                    description: 'Route Template Updated',
                    performed_by: 'System',
                    reference: `${r.origin_city} -> ${r.destination_city}`,
                    createdAt: r.updatedAt
                });
            });

            const sortedActivities = activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

            return res.status(200).json({
                success: true,
                data: {
                    totalRoutes,
                    activeDrivers,
                    pendingShipments,
                    revenue: revenueResult || 0,
                    recentActivity: sortedActivities
            }});
        } catch (error) {
            console.error('Error fetching admin stats:', error);
            return res.status(500).json({ success: false, message: 'Error fetching stats' });
        }
    },

    /**
     * Get Agent Dashboard Stats
     */
    getAgentStats: async (req, res) => {
        try {
            const user_id = req.user.id;
            const agent = await db.agents.findOne({ where: { user_id } });
            
            if (!agent) {
                return res.status(404).json({ success: false, message: 'Agent profile not found' });
            }

            const [activeOrders, pendingShipments, customersCount, recentShipments] = await Promise.all([
                db.shippings.count({ where: { agent_id: agent.id, status: { [Op.notIn]: ['delivered', 'cancelled', 'failed'] } } }),
                db.shippings.count({ where: { agent_id: agent.id, status: 'pending' } }),
                db.shippings.count({ where: { agent_id: agent.id }, distinct: true, col: 'user_id' }),
                db.shippings.findAll({
                    where: { agent_id: agent.id },
                    limit: 5,
                    order: [['createdAt', 'DESC']],
                    attributes: ['id', 'shipment_reference', 'vendor_name', 'status', 'createdAt']
                })
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    activeOrders,
                    pendingShipments,
                    customersCount,
                    recentShipments
                }
            });
        } catch (error) {
            console.error('Error fetching agent stats:', error);
            return res.status(500).json({ success: false, message: 'Error fetching stats' });
        }
    },

    /**
     * Get Customer Dashboard Stats
     */
    getCustomerStats: async (req, res) => {
        try {
            const user_id = req.user.id;

            if (!user_id) {
                return res.status(401).json({ success: false, message: 'User not authenticated' });
            }

            const statusCounts = await db.shippings.findAll({
                where: { user_id: String(user_id) },
                attributes: [
                    'status',
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
                ],
                group: ['status']
            });

            const stats = { total: 0, pending: 0, in_transit: 0, delivered: 0, failed: 0, cancelled: 0, returned: 0 };

            statusCounts.forEach(item => {
                const status = item.dataValues.status;
                const count = parseInt(item.dataValues.count, 10);
                if (stats.hasOwnProperty(status)) {
                    stats[status] = count;
                }
                stats.total += count;
            });

            return res.status(200).json({ success: true, data: stats });
        } catch (error) {
            console.error('Error fetching customer stats:', error);
            return res.status(500).json({ success: false, message: 'Error fetching stats' });
        }
    },

    /**
     * Main endpoint to create shipments
     * Handles both internal and external shipments
     */
    createShipment: async (req, res) => {
        try {
            
            let userId = null;
            let tenantId = null;

            if (req.user && req.user.id) {
                
                userId = req.user.id;
            } else if (req.tenant && req.tenant.id) {
                // Authenticated via API key
                tenantId = req.tenant.id;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const payload = req.body;

            // Normalize Tajiri/Complex payload structure
            // If items are missing at root but present in nested shipments
            if ((!payload.items || payload.items.length === 0) && payload.dispatcher?.shipments?.[0]) {
                const nestedShipment = payload.dispatcher.shipments[0];
                payload.items = nestedShipment.items || [];
                
                if (!payload.rate_id) {
                    payload.rate_id = nestedShipment.rate_id;
                }
                if (!payload.external_shipment_id) {
                    payload.external_shipment_id = nestedShipment.id || nestedShipment.metadata?.shipment_id;
                }
            }
        
            // Validate payload
            const validation = validateShipmentPayload(payload);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payload',
                    errors: validation.errors
                });
            }
            
            const transaction = await db.sequelize.transaction();
            
            try {
                
                const deliveryAddress = await db.addresses.create({
                    address_type: 'delivery',
                    name: `${payload.delivery_address.first_name || ''} ${payload.delivery_address.last_name || ''}`.trim(),
                    phone: payload.delivery_address.phone,
                    contact_email: payload.delivery_address.email,
                    line1: payload.delivery_address.line1,
                    line2: payload.delivery_address.line2 || '',
                    city: payload.delivery_address.city,
                    state: payload.delivery_address.state,
                    country: payload.delivery_address.country,
                    zip_code: payload.delivery_address.zip || '',
                    is_residential: payload.delivery_address.is_residential || false,
                    instructions: payload.delivery_address.instructions || '',
                    metadata: payload.delivery_address.metadata || {}
                }, { transaction });

                
                const pickupAddressData = {
                    address_type: 'pickup',
                    name: payload.pickup_address.contact_name || 'Vendor',
                    phone: payload.pickup_address.phone,
                    contact_email: payload.pickup_address.email || '',
                    line1: payload.pickup_address.line1,
                    line2: payload.pickup_address.line2 || '',
                    city: payload.pickup_address.city,
                    state: payload.pickup_address.state,
                    country: payload.pickup_address.country,
                    zip_code: payload.pickup_address.zip_code || '',
                    is_residential: payload.pickup_address.is_residential || false,
                    instructions: payload.pickup_address.instructions || '',
                    metadata: payload.pickup_address.metadata || {}
                };

                const pickupAddress = await db.addresses.create(pickupAddressData, { transaction });


                // A shipment is internal only if it's explicitly 'obana' AND doesn't have an external shipment ID
                const isInternal = (payload.carrier_slug === 'obana' || 
                                 (payload.dispatcher && payload.dispatcher.carrier_slug === 'obana')) && 
                                 !payload.external_shipment_id;
                
                
                const shipmentReference = generateShipmentReference(isInternal);
                
                
                const { totalWeight, totalValue, itemCount } = calculateShipmentTotals(payload.items);

                
                const shipment = await db.shippings.create({
                    user_id: userId,
                    tenant_id: tenantId,
                    shipment_reference: shipmentReference,
                    order_reference: payload.order_id || `ORDER-${Date.now()}`,
                    vendor_name: payload.vendor_name || 'Unknown Vendor',
                    carrier_type: isInternal ? 'internal' : 'external',
                    carrier_name: isInternal ? 'Obana Logistics' : (payload.dispatcher?.carrier_name || 'External Carrier'),
                    carrier_slug: isInternal ? 'obana' : (payload.dispatcher?.carrier_slug || 'external'),
                    transport_mode: payload.transport_mode || 'road',
                    service_level: payload.service_level || 'Standard',
                    external_carrier_reference: isInternal ? null : payload.carrier_reference,
                    external_rate_id: isInternal ? null : payload.rate_id,
                    external_shipment_id: isInternal ? null : payload.external_shipment_id,
                    delivery_address_id: deliveryAddress.id,
                    pickup_address_id: pickupAddress.id,
                    product_value: totalValue,
                    shipping_fee: payload.shipping_fee || 0,
                    currency: payload.currency?.symbol || 'NGN',
                    total_weight: totalWeight,
                    total_items: itemCount,
                    status: 'pending',
                    is_insured: payload.is_insured || false,
                    insurance_amount: payload.insurance_amount || 0,
                    metadata: {
                        original_payload: payload,
                        dispatcher: payload.dispatcher,
                        carrier_details: {
                            carrier_name: payload.dispatcher?.carrier_name,
                            carrier_logo: payload.dispatcher?.carrier_logo,
                            delivery_time: payload.dispatcher?.delivery_time,
                            delivery_eta: payload.dispatcher?.delivery_eta,
                            pickup_time: payload.dispatcher?.pickup_time,
                            pickup_eta: payload.dispatcher?.pickup_eta
                        }
                    },
                    notes: payload.notes || ''
                }, { transaction });

                
                    try {
          
                        const availableAgent = await db.agents.findOne({
                            where: {
                                status: 'active',
                                state: pickupAddress.state,
                                city: pickupAddress.city
                            },
                             
                                // Simple load balancing: random or by ID for now
                            order: [
                                [db.sequelize.fn('RANDOM')]
                            ]
                        });
                        
                    
                        if (availableAgent) {
                            shipment.agent_id = availableAgent.id;
                            await shipment.save({ transaction });
                            
                            console.log(`[AGENT ASSIGNMENT] Assigned agent ${availableAgent.agent_code} to shipment ${shipmentReference}`);
                        } else {
                            console.warn(`[AGENT ASSIGNMENT] No available agent found for location: ${pickupAddress.city}, ${pickupAddress.state}`);
                        }
                    } catch (agentError) {
                        console.error('[AGENT ASSIGNMENT ERROR]', agentError);
                }

                if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
                    await db.shipment_items.bulkCreate(
                        payload.items.map((item, index) => {
                            const itemNumber = String(index + 1).padStart(3, '0');
                            return {
                            shipment_id: shipment.id,
                            item_id: `ITEM-${itemNumber}`,
                            name: item.name,
                            description: item.description || '',
                            quantity: parseInt(item.quantity) || 1,
                            unit_price: parseFloat(item.price) || parseFloat(item.value) || 0,
                            total_price: parseFloat(item.total_price) || parseFloat(item.value) || 0,
                            weight: parseFloat(item.weight) || 0,
                            dimensions: item.dimensions || null,
                            currency: item.currency || 'NGN',
                            metadata: { original_item: item }
                        }}),
                        { transaction }
                    );
                }

                // 8. Create initial tracking event
                await db.shipment_tracking.create({
                    shipment_id: shipment.id,
                    status: 'created',
                    description: 'Shipment created successfully',
                    source: 'system',
                    performed_by: 'system',
                    metadata: {
                        action: 'shipment_creation',
                        carrier_type: isInternal ? 'internal' : 'external'
                    }
                }, { transaction });
                
                
                if (!isInternal) {
                    console.log(`[EXTERNAL CARRIER] Shipment ${shipmentReference} assigned to ${payload.dispatcher?.carrier_name || 'External Carrier'}`);
                    console.log(`[EXTERNAL CARRIER] Reference: ${payload.carrier_reference}, Rate ID: ${payload.rate_id}`);
                }

                await transaction.commit();
                
                
                sendNewShipmentEmail(shipment, deliveryAddress, pickupAddress);
                
                triggerPostCreationProcesses(shipment.id, isInternal);

                return res.status(201).json({
                    success: true,
                    message: 'Shipment created successfully',
                    data: {
                        shipment_id: shipment.id,
                        shipment_reference: shipment.shipment_reference,
                        tracking_url: `${process.env.BASE_URL || 'http://localhost:3000'}/track/${shipment.shipment_reference}`,
                        carrier: shipment.carrier_name,
                        status: shipment.status,
                        estimated_delivery: shipment.metadata?.carrier_details?.delivery_time || 'To be determined',
                        external_reference: shipment.external_carrier_reference
                    }
                });

            } catch (error) {
                await transaction.rollback();
                console.error('Transaction error:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error creating shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error creating shipment',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Confirm an external shipment (Arrange Pickup on Terminal Africa)
     * Manually triggered by Admin
     */
    confirmExternalShipment: async (req, res) => {
        try {
            const { shipment_id } = req.params;
            const shipment = await db.shippings.findByPk(shipment_id);
            console.log(shipment.carrier_type, shipment.external_rate_id, shipment.external_shipment_id)
            if (!shipment) {
                return res.status(404).json({ success: false, message: 'Shipment not found' });
            }

            if (shipment.carrier_type !== 'external' || !shipment.external_rate_id || !shipment.external_shipment_id) {
                return res.status(400).json({ success: false, message: 'Shipment is not an unconfirmed external shipment' });
            }

            if (shipment.external_carrier_reference) {
                return res.status(400).json({ success: false, message: 'Shipment already confirmed on external carrier' });
            }

            const pickupResponse = await taClient.post('/shipments/pickup', {
                rate_id: shipment.external_rate_id,
                shipment_id: shipment.external_shipment_id,
                purchase_insurance: shipment.is_insured || false
            });

            if (pickupResponse.data && pickupResponse.data.status) {
                const taData = pickupResponse.data.data;
                await shipment.update({
                    external_carrier_reference: taData.extras?.tracking_number,
                    metadata: { ...shipment.metadata, terminal_africa: taData },
                    status: 'pending'
                });

                await db.shipment_tracking.create({
                    shipment_id: shipment.id,
                    status: 'created',
                    description: `Shipment confirmed and pickup arranged via Terminal Africa. Tracking: ${taData.extras?.tracking_number}`,
                    source: 'carrier_api',
                    performed_by: `admin_${req.user.id}`
                });

                return res.status(200).json({
                    success: true,
                    message: 'Pickup arranged successfully',
                    data: taData
                });
            } else {
                throw new Error(pickupResponse.data.message || 'Terminal Africa API Error');
            }
        } catch (error) {
            console.error('Error confirming external shipment:', error?.response?.data || error.message);
            return res.status(500).json({ success: false, message: error.message });
        }
    },

   /**
 * Get all shipments for admin overview/monitoring
 */
getAllShipments: async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            carrier_type,
            start_date,
            end_date,
            search,
            sort_by = 'createdAt',
            sort_order = 'DESC'
        } = req.query;

        // Build where clause
        const where = {};

        // Filter by status
        if (status) {
            if (status === 'active') {
                // Active shipments are those not completed/cancelled
                where.status = {
                    [Op.notIn]: ['delivered', 'cancelled', 'returned']
                };
            } else {
                where.status = status;
            }
        }

        
        if (carrier_type) {
            where.carrier_type = carrier_type;
        }

        
        if (start_date || end_date) {
            where.createdAt = {};
            
            if (start_date) {
                where.createdAt[Op.gte] = new Date(start_date);
            }
            
            if (end_date) {
                where.createdAt[Op.lte] = new Date(end_date);
            }
        }

        // Search filter (by reference, order reference, vendor name, customer)
        if (search) {
            where[Op.or] = [
                { shipment_reference: { [Op.like]: `%${search}%` } },
                { order_reference: { [Op.like]: `%${search}%` } },
                { vendor_name: { [Op.like]: `%${search}%` } },
                { user_id: { [Op.like]: `%${search}%` } }
            ];
        }

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Sorting
        const order = [];
        if (sort_by) {
            order.push([sort_by, sort_order.toUpperCase()]);
        }

        // Get shipments with pagination and includes
        const shipments = await db.shippings.findAndCountAll({
            where,
            include: [
                {
                    model: db.addresses,
                    as: 'delivery_address',
                    attributes: ['city', 'state', 'country', 'phone']
                },
                {
                    model: db.addresses,
                    as: 'pickup_address',
                    attributes: ['city', 'state', 'country']
                },
                {
                    model: db.drivers,
                    as: 'driver',
                    // attributes: ['driver_code', 'first_name', 'last_name', 'phone']
                    attributes: ['driver_code', 'user_id'] 
                },
                {
                    model: db.agents,
                    as: 'agent',
                    attributes: ['agent_code'],
                    required: false,
                    include: [{
                        model: db.users,
                        as: 'user',
                        attributes: ['email'],
                        required: false
                    }]
                },
                {
                    model: db.shipment_tracking,
                    as: 'tracking_events',
                    attributes: ['status', 'createdAt'],
                    order: [['createdAt', 'DESC']],
                    limit: 1
                }
            ],
            attributes: [
                'id',
                'shipment_reference',
                'order_reference',
                'user_id',
                'vendor_name',
                'carrier_type',
                'carrier_name',
                'status',
                'product_value',
                'shipping_fee',
                'currency',
                'total_weight',
                'total_items',
                'actual_delivery_at',
                'createdAt',
                'updatedAt'
            ],
            order,
            limit: parseInt(limit),
            offset: offset,
            distinct: true 
        });

        
        const statistics = {
            total: shipments.count,
            by_status: {},
            by_carrier: {},
            by_day: {}
        };

        
        const statusCounts = await db.shippings.findAll({
            attributes: [
                'status',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['status']
        });

        statusCounts.forEach(item => {
            statistics.by_status[item.status] = parseInt(item.dataValues.count);
        });

        
        const carrierCounts = await db.shippings.findAll({
            attributes: [
                'carrier_type',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['carrier_type']
        });

        carrierCounts.forEach(item => {
            statistics.by_carrier[item.carrier_type] = parseInt(item.dataValues.count);
        });

        
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const dailyCounts = await db.shippings.findAll({
            attributes: [
                [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            where: {
                createdAt: {
                    [Op.gte]: last7Days
                }
            },
            group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
            order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
        });

        dailyCounts.forEach(item => {
            statistics.by_day[item.dataValues.date] = parseInt(item.dataValues.count);
        });

        return res.status(200).json({
            success: true,
            data: {
                shipments: shipments.rows,
                pagination: {
                    total: shipments.count,
                    page: parseInt(page),
                    pages: Math.ceil(shipments.count / parseInt(limit)),
                    limit: parseInt(limit)
                },
                statistics: statistics,
                filters: {
                    status,
                    carrier_type,
                    start_date,
                    end_date,
                    search
                }
            }
        });

    } catch (error) {
        console.error('Error getting all shipments:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching shipments',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},
    /**
     * Get shipment status
     */
    getShipment: async (req, res) => {
        try {
        const userController = require('./userController');
        const { shipment_reference } = req.params;
            const user_id = String(req.user.id);
            const user_role = req.user.role;
            
            let where = { shipment_reference };

            if (user_role === 'admin') {
                
            } else if (user_role === 'driver') {
                const driver = await db.drivers.findOne({ where: { user_id: req.user.id } });
                if (driver) {
                    where.driver_id = driver.id
                } else {
                    where.user_id = user_id;
                }
            } else if (user_role === 'agent') {
                    

                    const agent = await db.agents.findOne({ where: {user_id: req.user.id }})
                    
                    if (agent) {
                        where.agent_id = agent.id
                        
                    }
                } else {
                where.user_id = user_id;
            }
            

            const shipment = await db.shippings.findOne({
                where,
                include: [
                    { 
                        model: db.addresses, 
                        as: 'delivery_address' 
                    },
                    { 
                        model: db.addresses, 
                        as: 'pickup_address' 
                    },
                    { 
                        model: db.shipment_items, 
                        as: 'items' 
                    },
                    { 
                        model: db.shipment_tracking, 
                        as: 'tracking_events',
                        order: [['createdAt', 'DESC']]
                    },
                    {
                        model: db.agents,
                        as: 'agent',
                        required: false,
                        include: [{
                            model: db.users,
                            as: 'user',
                            attributes: { exclude: ['password'] },
                            required: false
                        }]
                    },
                    {
                        model: db.drivers,
                        as: 'driver',
                        required: false 
                    }
                ]
            });


            if (!shipment) {
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }

            const plainShipment = shipment.get({ plain: true });

            if (plainShipment.agent && plainShipment.agent.user) {
                const attributes = await userController.getUserAttributes(plainShipment.agent.user.id);
                if (attributes) {
                    plainShipment.agent.user.attributes = attributes;
                }
            }

            return res.status(200).json({
                success: true,
                data: plainShipment
            });
        } catch (error) {
            console.error('Error fetching shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching shipment'
            });
        }
    },

    /**
     * Update shipment status
     */
    updateShipmentStatus: async (req, res) => {
        try {
            const { shipment_id } = req.params;
            const { status, description, location, notes, source = 'system', performed_by } = req.body;
            
            // Validate status
            const validStatuses = ['pending', 'picked_up', 'dispatched', 'in_transit', 'delivered', 'failed', 'cancelled', 'returned'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const shipment = await db.shippings.findByPk(shipment_id);
            
            if (!shipment) {
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }

            // if the requester is an agent, enforce ownership
            if (req.user && req.user.role === 'agent') {
                const agent = await db.agents.findOne({ where: { user_id: req.user.id } });
                if (!agent || shipment.agent_id !== agent.id) {
                    return res.status(403).json({ success: false, message: 'Unauthorized to update this shipment' });
                }
            }

            // Update shipment status
            const updateData = { status };
            
            if (status === 'delivered') {
                updateData.actual_delivery_at = new Date();
            }
            
            await shipment.update(updateData);

            // Map 'pending' to 'created' for tracking events as 'pending' is not usually a tracking event status
            const trackingStatus = status === 'pending' ? 'created' : status;

            // Create tracking event
            await db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: trackingStatus,
                location: location || '',
                description: description || `Status updated to ${status}`,
                notes: notes || '',
                source,
                performed_by: performed_by || (req.user ? `user_${req.user.id}` : 'system'),
                metadata: {
                    updated_by: performed_by || 'system',
                    previous_status: shipment.status
                }
            });
    await sendStatusUpdateEmail(shipment, status, req.body);
            return res.status(200).json({
                success: true,
                message: 'Shipment status updated',
                data: {
                    shipment_id: shipment.id,
                    status: shipment.status,
                    updated_at: shipment.updatedAt
                }
            });
        } catch (error) {
            console.error('Error updating shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error updating shipment'
            });
        }
    },

    /**
     * Assign driver to shipment
     */
    assignDriver: async (req, res) => {
        try {
            const { shipment_id } = req.params;
            const { driver_id } = req.body;

            const shipment = await db.shippings.findByPk(shipment_id);
            if (!shipment) {
                return res.status(404).json({ success: false, message: 'Shipment not found' });
            }

            // If agent, verify ownership
            if (req.user.role === 'agent') {
                const agent = await db.agents.findOne({ where: { user_id: req.user.id } });
                if (!agent || shipment.agent_id !== agent.id) {
                    return res.status(403).json({ success: false, message: 'Unauthorized access to this shipment' });
                }
            }

            shipment.driver_id = driver_id;
            if (shipment.status === 'pending' || shipment.status === 'created') {
                shipment.status = 'in_transit'; // Or a specific status like 'driver_assigned' if you have it
            }
            await shipment.save();

            await db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: shipment.status,
                description: 'Driver assigned',
                performed_by: req.user ? `user_${req.user.id}` : 'system'
            });

            return res.status(200).json({ success: true, message: 'Driver assigned successfully' });
        } catch (error) {
            console.error('Error assigning driver:', error);
            return res.status(500).json({ success: false, message: 'Error assigning driver' });
        }
    },

    /**
     * Cancel shipment
     */
    cancelShipment: async (req, res) => {
        const { shipment_id } = req.params;
        const { reason } = req.body;

        try {
            const shipment = await db.shippings.findByPk(shipment_id);
            
            if (!shipment) {
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }

            // Check if shipment can be cancelled
            const cancellableStatuses = ['pending'];
            if (!cancellableStatuses.includes(shipment.status)) {
                return res.status(400).json({
                    success: false,
                    message: `Shipment cannot be cancelled in ${shipment.status} status`
                });
            }

            // If external carrier, log cancellation request
            if (shipment.carrier_type === 'external') {
                console.log(`[EXTERNAL CANCELLATION] Would cancel external shipment: ${shipment.external_carrier_reference} with ${shipment.carrier_name}`);
                // TODO: Call external carrier cancellation API
            }

            // Update shipment status
            await shipment.update({
                status: 'cancelled',
                notes: `Cancelled: ${reason || 'No reason provided'}`
            });

            // Add tracking event
            await db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: 'cancelled',
                description: `Shipment cancelled: ${reason || 'No reason provided'}`,
                performed_by: req.user?.id ? `user_${req.user.id}` : 'system',
                source: 'system'
            });

            return res.status(200).json({
                success: true,
                message: 'Shipment cancelled successfully'
            });
        } catch (error) {
            console.error('Error cancelling shipment:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    /**
     * Get all shipments for a user
     */
    getUserShipments: async (req, res) => {
        
        try {
            const { user_id } = req.params;
            const { status, carrier_type, role, page = 1, limit = 20 } = req.query;
            
            let where = {};

            if (role === 'driver') {
                const driver = await db.drivers.findOne({ where: { user_id } });
                if (driver) {
                    where.driver_id = driver.id;
                } else {
                    return res.status(200).json({ success: true, data: { shipments: [], pagination: { total: 0, page: 1, pages: 0, limit: parseInt(limit) } } });
                }
            } else if (role === 'agent') {
                const agent = await db.agents.findOne({ where: { user_id } });
                if (agent) {
                    where.agent_id = agent.id;
                } else {
                    return res.status(200).json({ success: true, data: { shipments: [], pagination: { total: 0, page: 1, pages: 0, limit: parseInt(limit) } } });
                }
            } else {
                where.user_id = user_id;
            }
            
            if (status) where.status = status;
            if (carrier_type) where.carrier_type = carrier_type;
            
            const offset = (page - 1) * limit;
            
            const shipments = await db.shippings.findAndCountAll({
                where,
                include: [
                    { model: db.addresses, as: 'delivery_address' },
                    { model: db.addresses, as: 'pickup_address' },
                    { 
                        model: db.shipment_tracking, 
                        as: 'tracking_events',
                        order: [['createdAt', 'DESC']],
                        limit: 1 
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: offset
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    shipments: shipments.rows,
                    pagination: {
                        total: shipments.count,
                        page: parseInt(page),
                        pages: Math.ceil(shipments.count / limit),
                        limit: parseInt(limit)
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching user shipments:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching shipments'
            });
        }
    },

    /**
     * Webhook handler for external carriers
     */
    handleCarrierWebhook: async (req, res) => {
        try {
            const { carrier } = req.params;
            const webhookData = req.body;
            
            console.log(`[WEBHOOK] Received from ${carrier}:`, JSON.stringify(webhookData, null, 2));
            
            // Look for external reference in webhook data
            let externalReference = webhookData.tracking_number || 
                                   webhookData.reference || 
                                   webhookData.carrier_reference;
            
            if (!externalReference) {
                return res.status(400).json({
                    success: false,
                    message: 'No tracking reference found in webhook'
                });
            }
            
            // Find shipment by external reference
            const shipment = await db.shippings.findOne({
                where: { 
                    external_carrier_reference: externalReference,
                    carrier_type: 'external'
                }
            });
            
            if (!shipment) {
                console.log(`[WEBHOOK] No shipment found for external reference: ${externalReference}`);
                return res.status(404).json({
                    success: false,
                    message: 'Shipment not found'
                });
            }
            
            // Map carrier status to our status
            const statusMapping = {
                'in_transit': 'in_transit',
                'delivered': 'delivered',
                'failed': 'failed',
                'exception': 'failed',
                'cancelled': 'cancelled'
            };
            
            const carrierStatus = webhookData.status || webhookData.tracking_status;
            const ourStatus = statusMapping[carrierStatus] || 'in_transit';
            
            // Update shipment status
            await shipment.update({
                status: ourStatus,
                metadata: {
                    ...shipment.metadata,
                    last_webhook: {
                        carrier: carrier,
                        data: webhookData,
                        received_at: new Date()
                    }
                }
            });
            
            // Create tracking event
            await db.shipment_tracking.create({
                shipment_id: shipment.id,
                status: ourStatus,
                location: webhookData.location || webhookData.city || '',
                description: `Carrier update: ${carrierStatus || 'Status update'}`,
                source: 'carrier_api',
                performed_by: carrier,
                metadata: { webhook_data: webhookData }
            });
            
            return res.status(200).json({
                success: true,
                message: 'Webhook processed successfully'
            });
            
        } catch (error) {
            console.error('Error processing webhook:', error);
            return res.status(500).json({
                success: false,
                message: 'Error processing webhook'
            });
        }
    },

    /**
     * Delete shipment (Admin only)
     */
    deleteShipment: async (req, res) => {
        try {
            const { shipment_id } = req.params;
            const shipment = await db.shippings.findByPk(shipment_id);
            
            if (!shipment) {
                return res.status(404).json({ success: false, message: 'Shipment not found' });
            }

            await shipment.destroy();
            
            return res.status(200).json({ success: true, message: 'Shipment deleted successfully' });
        } catch (error) {
            console.error('Error deleting shipment:', error);
            return res.status(500).json({ success: false, message: 'Error deleting shipment' });
        }
    }
};

module.exports = shipmentController;