const db = require('../models/db.js');
const utils = require('../../utils.js');
const { uploadImage } = require('../helpers/cloudinary');
const { createUserAttributes } = require('./userController');

const Agent = db.agents;
const User = db.users;

// List all agents
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

        // Fetch attributes for each user to get names
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
        const agent = await Agent.findByPk(id);

        if (!agent) {
            return res.status(404).send(utils.responseError('Agent not found'));
        }

        const { government_id_image, profile_photo, ...updateData } = req.body;

        // Handle image uploads if new base64 strings are provided
        if (government_id_image && government_id_image.startsWith('data:')) {
            updateData.government_id_image = await uploadImage(government_id_image, 'obana/agents/documents');
        }
        if (profile_photo && profile_photo.startsWith('data:')) {
            updateData.profile_photo = await uploadImage(profile_photo, 'obana/agents/photos');
        }

        await agent.update(updateData);

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