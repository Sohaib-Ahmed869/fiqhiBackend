// utils/sendEmail.js
const nodemailer = require("nodemailer");
require("dotenv").config(); // Ensure this is at the top if you're using .env

const sendEmail = async (options) => {
  // Convert SMTP_PORT to a number (if it's a string in your .env)
  const port = Number(process.env.SMTP_PORT) || 465;

  // Create a transporter using your Gmail SMTP settings
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // "smtp.gmail.com"
    port: port, // 465 for secure connection
    secure: port === 465, // true for port 465, false for others
    auth: {
      user: process.env.SMTP_USER, // your Gmail address
      pass: process.env.SMTP_PASS, // your app password
    },
    tls: {
      // This setting allows using self-signed certificates (optional)
      rejectUnauthorized: false,
    },
  });

  // Define the email message details
  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.to, // recipient email address
    subject: options.subject,
    text: options.text,
  };

  // Send the email
  const info = await transporter.sendMail(message);
  console.log("Message sent: %s", info.messageId);
};

module.exports = sendEmail;
