const axios = require('axios');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const validator = require('validator');
const FormData = require('form-data');

const sendMail = async (payload) => {
    
    const email = payload.email;
    console.log("Email: ", email)
    return
    const content = payload.content || payload.contents || payload.text || payload.body || '';
    const templateName = payload.template;
    const subject = payload.subject || 'Notification from Obana';

    const mailValidated = validator.isEmail(email);
    if (!mailValidated) {
        console.warn('kudisms mailer: invalid email', email);
        return { success: false, error: 'invalid_email' };
    }

    let html = '';

    // Handle Template compilation
    if (templateName) {
        try {
            let templatePath = path.join(__dirname, 'views', `${templateName}.hbs`);
            if (!fs.existsSync(templatePath)) {
                templatePath = path.join(__dirname, 'views', `${templateName}.handlebars`);
            }

            if (fs.existsSync(templatePath)) {
                const source = fs.readFileSync(templatePath, 'utf8');
                const template = handlebars.compile(source);
                const context = typeof content === 'object' ? content : { message: content };
                html = template(context);
            } else {
                console.warn(`Template ${templateName} not found in src/mailer/views`);
                html = typeof content === 'string' ? content : JSON.stringify(content);
            }
        } catch (err) {
            console.error('Error compiling template:', err);
            html = typeof content === 'string' ? content : JSON.stringify(content);
        }
    } else {
        html = typeof content === 'string' ? content : JSON.stringify(content);
        if (!html.trim().startsWith('<')) {
            html = `<div>${html}</div>`;
        }
    }

    // Set up form-data for KudiSMS transactional API
    const form = new FormData();
    form.append('token', process.env.KUDISMS_API_KEY || '');
    form.append('senderEmail', process.env.KUDISMS_SENDER_EMAIL || process.env.EMAIL_SENDER_USER || 'obana.africa@gmail.com');
    form.append('senderName', process.env.KUDISMS_SENDER_NAME || 'Obana Logistics');
    form.append('senderFrom', process.env.KUDISMS_SENDER_FROM || process.env.KUDISMS_SENDER_NAME || 'Obana Logistics');
    form.append('transactionName', payload.transactionName || templateName || 'Obana Transaction');
    form.append('recipient', email);
    form.append('subject', subject);
    form.append('message', html);

    try {
        const response = await axios.post('https://my.kudisms.net/api/transactional', form, {
            headers: form.getHeaders()
        });
        console.log(`Message sent to ${email} via KudiSMS:`, response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('KudiSMS Error:', error.response ? error.response.data : error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendMail };
