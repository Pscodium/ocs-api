require('dotenv').config();
const nodemailer = require('nodemailer');

class Mailer {
    transporter;
    config;

    constructor() {
        this.config = {
            service: process.env.SMTP_SERVICE,
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASS
            }
        };
        this.transporter = this.createTransporter();
    }

    createTransporter() {
        if (!this.config.auth.user || !this.config.auth.pass) {
            throw new Error('SMTP user or password is not set in environment variables');
        }
        return nodemailer.createTransport(this.config);
    }

    async sendMail(request) {
        try {
            const info = await this.transporter.sendMail({
                from: `"${process.env.SMTP_NAME}" <${this.config.auth.user}>`,
                to: request.to,
                subject: request.subject,
                text: request.text,
                html: request.html
            });

            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            console.error('Error sending email:', error);
            throw new Error('Failed to send email');
        }

    }
}

exports.Mailer = Mailer;