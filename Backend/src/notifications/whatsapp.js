const axios = require('axios');
const querystring = require('node:querystring');

const KUDISMS_WHATSAPP_URL = 'https://my.kudisms.net/api/whatsapp_custom';

/**
 * Normalise a phone number to KudiSMS/WhatsApp international format (no '+').
 * Defaults local (0-prefixed) numbers to Nigeria (234). E.g. 08012345678 -> 2348012345678
 */
const normalizePhone = (phone, defaultCountryCode = '234') => {
    if (!phone) return null;
    let p = String(phone).trim().replace(/[\s\-().]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    if (p.startsWith('00')) p = p.slice(2);
    if (p.startsWith('0')) p = defaultCountryCode + p.slice(1);
    // Bare local number (e.g. 8012345678) with no country code
    if (!p.startsWith(defaultCountryCode) && p.length === 10) p = defaultCountryCode + p;
    if (!/^\d{10,15}$/.test(p)) return null;
    return p;
};

/**
 * Send a WhatsApp message through an approved KudiSMS WhatsApp template.
 *
 * @param {Object}   opts
 * @param {string}   opts.recipient          Recipient phone (any format; normalised here)
 * @param {string}   opts.templateCode       Approved template code from KudiSMS
 * @param {string[]} [opts.parameters]       Body placeholders {{1}},{{2}}… in order
 * @param {string[]} [opts.buttonParameters] Dynamic-URL button values, in order
 * @param {string[]} [opts.headerParameters] Header placeholders, in order
 */
const sendWhatsApp = async ({ recipient, templateCode, parameters = [], buttonParameters = [], headerParameters = [] }) => {
    const phone = normalizePhone(recipient);
    if (!phone) {
        console.warn('kudisms whatsapp: invalid recipient', recipient);
        return { success: false, error: 'invalid_recipient' };
    }
    if (!templateCode) {
        console.warn('kudisms whatsapp: missing template_code');
        return { success: false, error: 'missing_template_code' };
    }
    if (!process.env.KUDISMS_WHATSAPP_PHONE_NUMBER_ID) {
        console.warn('kudisms whatsapp: KUDISMS_WHATSAPP_PHONE_NUMBER_ID not set');
    }

    const body = {
        token: process.env.KUDISMS_API_KEY || '',
        recipient: phone,
        phone_number_id: process.env.KUDISMS_WHATSAPP_PHONE_NUMBER_ID || '',
        template_code: templateCode,
        parameters: parameters.map(v => (v == null ? '' : String(v))).join(',')
    };
    if (buttonParameters.length) body.button_parameters = buttonParameters.map(String).join(',');
    if (headerParameters.length) body.header_parameters = headerParameters.map(String).join(',');

    try {
        const response = await axios.post(KUDISMS_WHATSAPP_URL, querystring.stringify(body), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        // KudiSMS returns HTTP 200 even on failure — the real outcome is in the body status.
        if (response.data && response.data.status === 'error') {
            console.error(`KudiSMS WhatsApp rejected for ${phone}:`, response.data);
            return { success: false, error: response.data.msg || 'kudisms_error', data: response.data };
        }
        console.log(`WhatsApp sent to ${phone} via KudiSMS:`, response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('KudiSMS WhatsApp Error:', error.response ? error.response.data : error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendWhatsApp, normalizePhone };
