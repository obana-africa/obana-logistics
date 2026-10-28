const db = require('../models/db');
const utils = require('../../utils');

/**
 * Bookings in progress, and the customers a booking can be started from.
 *
 * Two small things that answer the same complaint: filling this form in is
 * work, and the work is being thrown away. A draft keeps an unfinished
 * booking; the customer list stops the next one starting from a blank page.
 */

const MAX_DRAFTS = 50;

/** Only ever this person's own. A draft is private to whoever started it. */
const ownerOf = (req) => Number(req.user?.id) || 0;

/** "Lagos → Abuja" or whatever of it exists, so a list reads as journeys. */
const labelFor = (form, given) => {
    const named = String(given ?? '').trim();
    if (named) return named.slice(0, 120);
    const where = (a) => String(a?.city || a?.state || '').trim();
    const from = where(form?.pickup_address);
    const to = where(form?.delivery_address);
    if (from && to) return `${from} → ${to}`;
    return from || to || 'Untitled draft';
};

const asDraft = (row) => ({
    id: row.id,
    label: row.label,
    form: row.form ?? {},
    created_at: row.createdAt ?? row.created_at,
    updated_at: row.updatedAt ?? row.updated_at,
});

const listDrafts = async (req, res) => {
    try {
        const rows = await db.shipment_drafts.findAll({
            where: { user_id: ownerOf(req) },
            order: [['updated_at', 'DESC']],
            limit: MAX_DRAFTS,
        });
        return res.status(200).send(utils.responseSuccess(rows.map(asDraft)));
    } catch (error) {
        console.error('[drafts] list failed:', error.message);
        return res.status(500).send(utils.responseError('Could not load your drafts'));
    }
};

const saveDraft = async (req, res) => {
    try {
        const user_id = ownerOf(req);
        if (!user_id) return res.status(401).send(utils.responseError('Sign in to save a draft'));

        const form = req.body?.form;
        if (!form || typeof form !== 'object' || Array.isArray(form)) {
            return res.status(400).send(utils.responseError('There is nothing to save'));
        }
        const label = labelFor(form, req.body?.label);

        /* Saving again over the same draft rather than making a new one each
           time: somebody pressing save twice means one draft, not two. */
        const id = Number(req.body?.id) || Number(req.params?.id) || 0;
        if (id) {
            const existing = await db.shipment_drafts.findOne({ where: { id, user_id } });
            if (!existing) return res.status(404).send(utils.responseError('That draft is no longer there'));
            await existing.update({ form, label });
            return res.status(200).send(utils.responseSuccess(asDraft(existing)));
        }

        /* A cap, because a form that saves on a timer would otherwise fill the
           table with one person's abandoned attempts. The oldest goes. */
        const count = await db.shipment_drafts.count({ where: { user_id } });
        if (count >= MAX_DRAFTS) {
            const oldest = await db.shipment_drafts.findOne({ where: { user_id }, order: [['updated_at', 'ASC']] });
            if (oldest) await oldest.destroy();
        }

        const created = await db.shipment_drafts.create({ user_id, form, label });
        return res.status(201).send(utils.responseSuccess(asDraft(created)));
    } catch (error) {
        console.error('[drafts] save failed:', error.message);
        return res.status(500).send(utils.responseError('Could not save that draft'));
    }
};

const deleteDraft = async (req, res) => {
    try {
        const removed = await db.shipment_drafts.destroy({
            where: { id: Number(req.params.id) || 0, user_id: ownerOf(req) },
        });
        if (!removed) return res.status(404).send(utils.responseError('That draft is no longer there'));
        return res.status(200).send(utils.responseSuccess({ deleted: true }));
    } catch (error) {
        console.error('[drafts] delete failed:', error.message);
        return res.status(500).send(utils.responseError('Could not delete that draft'));
    }
};

/**
 * People this account has sent to before.
 *
 * Read off the shipments themselves rather than a contacts table, because the
 * delivery address on a past shipment is the only record that is certainly
 * real: it was typed, checked and delivered against.
 *
 * One entry per person, newest first, matched on the phone number — the same
 * customer is routinely written "Bob Onyeukwu" one week and "bob" the next,
 * and the number is the thing that does not drift. Nine digits, so the same
 * phone written 0803… and +234803… is one person and not two.
 */
const recentCustomers = async (req, res) => {
    try {
        const user_id = ownerOf(req);
        if (!user_id) return res.status(401).send(utils.responseError('Sign in first'));

        const rows = await db.sequelize.query(
            `SELECT d.name, d.phone, d.contact_email AS email, d.line1, d.line2,
                    d.city, d.state, d.country, d.postal_code,
                    MAX(s."createdAt") AS last_used
               FROM shippings s
               JOIN addresses d ON d.id = s.delivery_address_id
              WHERE s.user_id = :user_id
                AND COALESCE(d.phone, '') <> ''
              GROUP BY d.name, d.phone, d.contact_email, d.line1, d.line2,
                       d.city, d.state, d.country, d.postal_code
              ORDER BY MAX(s."createdAt") DESC
              LIMIT 200`,
            { replacements: { user_id }, type: db.sequelize.QueryTypes.SELECT },
        );

        const seen = new Set();
        const customers = [];
        for (const row of rows) {
            const key = String(row.phone ?? '').replace(/\D/g, '').slice(-9);
            if (key.length < 7 || seen.has(key)) continue;
            seen.add(key);
            customers.push({
                name: row.name ?? '',
                phone: row.phone ?? '',
                email: row.email ?? '',
                line1: row.line1 ?? '',
                line2: row.line2 ?? '',
                city: row.city ?? '',
                state: row.state ?? '',
                country: row.country ?? '',
                postal_code: row.postal_code ?? '',
                last_used: row.last_used,
            });
            if (customers.length >= 50) break;
        }

        return res.status(200).send(utils.responseSuccess(customers));
    } catch (error) {
        console.error('[customers] recent lookup failed:', error.message);
        return res.status(500).send(utils.responseError('Could not load your previous customers'));
    }
};

module.exports = { listDrafts, saveDraft, deleteDraft, recentCustomers };
