const nodemailer = require('nodemailer');

/**
 * Send an email using Nodemailer
 * Falls back to console logging if email credentials are not configured
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body of the email
 * @returns {Promise<void>}
 */
const sendEmail = async ({ to, subject, html }) => {
    try {
        // Check if email credentials are configured
        const isEmailConfigured =
            process.env.EMAIL_USER &&
            process.env.EMAIL_PASS &&
            process.env.EMAIL_USER !== 'your_email@gmail.com';

        if (!isEmailConfigured) {
            // ============================================
            // DEVELOPMENT FALLBACK: Log to console
            // ============================================
            console.log('\n');
            console.log('╔══════════════════════════════════════════════════╗');
            console.log('║          📧 EMAIL (Console Fallback)             ║');
            console.log('╠══════════════════════════════════════════════════╣');
            console.log(`║  To:      ${to.padEnd(39)}║`);
            console.log(`║  Subject: ${subject.padEnd(39)}║`);
            console.log('╠══════════════════════════════════════════════════╣');
            console.log('║  Body:                                           ║');

            // Extract URL from HTML if present
            const urlMatch = html.match(/href="(.*?)"/);
            if (urlMatch) {
                console.log(`║  🔗 ${urlMatch[1].padEnd(45)}║`);
            }

            console.log('╚══════════════════════════════════════════════════╝');
            console.log('ℹ️  To enable real emails, configure EMAIL_USER and EMAIL_PASS in .env\n');
            return;
        }

        // ============================================
        // PRODUCTION: Send real email via Gmail SMTP
        // ============================================
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false, // true for 465, false for 587
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: `"CineStash" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}`);
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        throw new Error('Email could not be sent. Please try again later.');
    }
};

module.exports = sendEmail;