const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const validator = require('validator');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendMail = async (payload) => {
    
    const email = payload.email;
    const content = payload.content || payload.contents || payload.text || payload.body || '';
    const templateName = payload.template;
    const subject = payload.subject || 'Notification from Obana';

    const mailValidated = validator.isEmail(email);
    if (!mailValidated) {
        console.warn('sendgrid: invalid email', email);
        return { success: false, error: 'invalid_email' };
    }

    let html = '';

    // Handle Template compilation
    if (templateName) {
        try {
            // Check for .hbs or .handlebars extensions
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

    const msg = {
        to: email,
        from:  process.env.EMAIL_SENDER_USER || 'obana.africa@gmail.com',
        subject: subject,
        html: html,
    };

    console.log(msg)
    try {
        await sgMail.send(msg);
        console.log(`Message sent to ${email}`);
        return { success: true };
    } catch (error) {
        console.error('SendGrid Error:', error);
        if (error.response) console.error(error.response.body);
        return { success: false, error: error.message };
    }
};

module.exports = { sendMail };