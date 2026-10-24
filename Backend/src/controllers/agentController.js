const db = require('../models/db.js');
const utils = require('../../utils.js');
const { createUserAttributes } = require('./userController');
const mailer = require('../mailer/kudisms');
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
/**
 * Take on an agent.
 *
 * There was no way to do this: agents could be listed, read, changed and
 * removed, but the only way one came into being was a migration or a hand
 * written row. So the vendor who starts handling a corridor on Monday could
 * not be added on Monday.
 *
 * An agent is three things, and all three are made here so none can be left
 * behind: the login, the role and name as user attributes, and the agent
 * record. An email already on the books is adopted rather than duplicated —
 * two rows sharing an address is the kind of thing nobody notices until a
 * password reset goes to the wrong one.
 *
 * No password is set. A generated one has to travel somewhere to be useful,
 * and the place it usually travels is a chat message; the holder sets their
 * own through the reset flow instead.
 */
const createAgent = async (req, res) => {
    const body = req.body ?? {};
    const email = String(body.email ?? '').trim().toLowerCase();
    const firstName = String(body.first_name ?? '').trim();
    const lastName = String(body.last_name ?? '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).send(utils.responseError('Enter a valid email address for the agent'));
    }
    if (!firstName) {
        return res.status(400).send(utils.responseError("Enter the agent's first name"));
    }

    const t = await db.sequelize.transaction();
    try {
        let user = await User.findOne({ where: { email }, transaction: t });
        if (!user) {
            user = await User.create(
                { email, phone: String(body.phone ?? '').trim() || null },
                { transaction: t }
            );
        } else if (body.phone && !user.phone) {
            await user.update({ phone: String(body.phone).trim() }, { transaction: t });
        }

        const existing = await Agent.findOne({ where: { user_id: user.id }, transaction: t });
        if (existing) {
            await t.rollback();
            return res.status(409).send(utils.responseError(`${email} is already an agent (${existing.agent_code})`));
        }

        /* A code they can be called by, unique and readable: OBANA-AGT-7KQ2F9. */
        const code =
            String(body.agent_code ?? '').trim() ||
            `OBANA-AGT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        const agent = await Agent.create(
            {
                agent_code: code,
                user_id: user.id,
                country: String(body.country ?? '').trim() || null,
                state: String(body.state ?? '').trim() || null,
                city: String(body.city ?? '').trim() || null,
                lga: String(body.lga ?? '').trim() || null,
                /* The lane this agent handles, as "IT>NG". A cross-border
                   shipment on that lane is assigned to them automatically. */
                assigned_zone: String(body.assigned_zone ?? '').trim() || null,
                service_radius: Number(body.service_radius) || null,
                status: body.status ?? 'active',
                verification_status: body.verification_status ?? 'pending'
            },
            { transaction: t }
        );

        await createUserAttributes(user.id, { role: 'agent', first_name: firstName, last_name: lastName });
        await t.commit();

        /* Told after the record exists, and never allowed to undo it: an agent
           who was taken on but not emailed is a message somebody can resend. */
        if (email) {
            mailer
                .sendMail({
                    email,
                    subject: 'You have been added as an Obana agent',
                    template: 'agentWelcome',
                    content: { agent_code: agent.agent_code, first_name: firstName }
                })
                .catch((err) => console.error('[AGENT] welcome mail failed:', err?.message || err));
        }

        const created = await Agent.findByPk(agent.id, { include: [{ model: User, as: 'user' }] });
        return res.status(201).send(utils.responseSuccess(created));
    } catch (error) {
        await t.rollback().catch(() => {});
        console.error('Error creating agent:', error);
        return res.status(500).send(utils.responseError(error.message));
    }
};

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
    createAgent,
    listAgents,
    getAgent,
    updateAgent,
    deleteAgent
};