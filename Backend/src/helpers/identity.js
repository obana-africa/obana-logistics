'use strict';

const { normalizePhone } = require('../notifications/whatsapp');

/**
 * Matching people by email and phone.
 *
 * Phones were stored exactly as typed and looked up the same way, so
 * 08031234567, +2348031234567, 2348031234567 and "0803 123 4567" were four
 * different accounts. Someone who signed up in one format and signed in with
 * another was told their account did not exist, and the duplicate check missed
 * them so they could register twice.
 *
 * Rather than migrate the stored values, a lookup now matches every form the
 * same line can take. New rows are written canonical, so the variants shrink
 * to one over time.
 */

const canonicalEmail = (raw) => String(raw ?? '').trim().toLowerCase();

/** The house format, shared with WhatsApp sending: 2348031234567. */
const canonicalPhone = (raw) => normalizePhone(raw);

/**
 * Every spelling of one number, for an `IN` lookup.
 *
 * Includes the original string so a row saved before normalisation — spaces,
 * brackets, a leading plus — is still found.
 */
const phoneVariants = (raw) => {
    const original = String(raw ?? '').trim();
    if (!original) return [];

    const canonical = canonicalPhone(original);
    const digits = original.replace(/\D/g, '');
    const national = (canonical || digits).slice(-10);

    const forms = [original, digits, canonical];
    if (national.length === 10) {
        forms.push(national, `0${national}`, `234${national}`, `+234${national}`);
    }

    return [...new Set(forms.filter(Boolean))];
};

module.exports = { canonicalEmail, canonicalPhone, phoneVariants };
