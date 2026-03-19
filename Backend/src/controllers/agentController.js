const db = require('../models/db.js');
const utils = require('../../utils.js');
const { createUserAttributes } = require('./userController');
const mailer = require('../mailer/sendgrid');

const Agent = db.agents;
const User = db.users;


const listAgents = async (req, res) => {
    try {
        const agents = await Agent.findAll({
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'email', 'phone'],
            }],
            order: [['createdAt', 'DESC']]
        });

        
        const agentData = await Promise.all(agents.map(async (agent) => {
            const userAttributes = await db.user_attributes.findAll({
                where: { user_id: agent.user_id },
                include: { model: db.attributes, as: 'attribute' }
            });

            const agentJson = agent.toJSON();
            const attributes = {};
            userAttributes.forEach(attr => {
                if (attr.attribute) {
                    attributes[attr.attribute.slug] = attr.value;
                }
            });

            return {
                ...agentJson,
                user: {
                    ...agentJson.user,
                    first_name: attributes.first_name || '',
                    last_name: attributes.last_name || '',
                }
            };
        }));

        return res.status(200).send(utils.responseSuccess(agentData));
    } catch (error) {
        console.error('Error fetching agents:', error);
        return res.status(500).send(utils.responseError(error.message));
    }
};

// Get a single agent by ID
const getAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const agent = await Agent.findByPk(id, {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'email', 'phone']
            }]
        });

        if (!agent) {
            return res.status(404).send(utils.responseError('Agent not found'));
        }

        return res.status(200).send(utils.responseSuccess(agent));
    } catch (error) {
        console.error('Error fetching agent:', error);
        return res.status(500).send(utils.responseError(error.message));
    }
};

// Update an agent
const updateAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const agent = await Agent.findByPk(id, {
            include: [{ model: User, as: 'user' }]
        });

        if (!agent) {
            return res.status(404).send(utils.responseError('Agent not found'));
        }

        const previousVerificationStatus = agent.verification_status;
        const previousStatus = agent.status;

        const updateData = req.body;
        await agent.update(updateData);

        // Handle Notifications
        if (agent.user && agent.user.email) {
            // 1. Verification Status Change
            if (previousVerificationStatus !== agent.verification_status) {
                await mailer.sendMail({
                    email: agent.user.email,
                    subject: `Agent Verification Update: ${agent.verification_status.toUpperCase()}`,
                    template: 'agentVerified', // Using a generic template for verification outcomes
                    content: {
                        verification_status: agent.verification_status,
                        is_verified: agent.verification_status === 'verified',
                        agent_code: agent.agent_code
                    }
                });
            }

            // 2. Account Status Change (e.g., suspended, active)
            if (previousStatus !== agent.status) {
                await mailer.sendMail({
                    email: agent.user.email,
                    subject: `Account Status Update: ${agent.status.replace('_', ' ').toUpperCase()}`,
                    template: 'agentStatusUpdate',
                    content: {
                        status: agent.status,
                        agent_code: agent.agent_code
                    }
                });
            }
        }

        const updatedAgent = await Agent.findByPk(id);
        return res.status(200).send(utils.responseSuccess(updatedAgent));
    } catch (error) {
        console.error('Error updating agent:', error);
        return res.status(500).send(utils.responseError(error.message));
    }
};

// Delete an agent
const deleteAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const agent = await Agent.findByPk(id);

        if (!agent) {
            return res.status(404).send(utils.responseError('Agent not found'));
        }

        // Instead of deleting the user, we just delete the agent profile.
        // The user remains and their role can be reset to 'customer'.
        const userId = agent.user_id;
        await agent.destroy();
        
        // Update user role attribute to 'customer'
        await createUserAttributes(userId, { role: 'customer' });

        return res.status(200).send(utils.responseSuccess('Agent profile deleted successfully. User role reset to customer.'));
    } catch (error) {
        console.error('Error deleting agent:', error);
        return res.status(500).send(utils.responseError(error.message));
    }
};

module.exports = {
    listAgents,
    getAgent,
    updateAgent,
    deleteAgent
};