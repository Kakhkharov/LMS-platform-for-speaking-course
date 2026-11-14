const dns = require('dns');
if (dns.setDefaultResultOrder) {
  try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}
}
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  family: 4,
  auth: {
    user: process.env.EMAIL_USER || 'musurmonqahharov747@gmail.com',
    pass: process.env.EMAIL_PASS || 'qiircoevannrafbr'
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      await transporter.verify();
      return res.json({ ok: true, message: 'Vercel SMTP transporter verified successfully' });
    } catch (ve) {
      return res.status(500).json({ ok: false, error: ve.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { to, subject, html, bannerAttached } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing to, subject, or html' });
  }

  try {
    const info = await transporter.sendMail({
      from: '"Practise" <musurmonqahharov747@gmail.com>',
      to,
      subject,
      html
    });
    return res.json({ sent: true, messageId: info.messageId, bannerAttached: Boolean(bannerAttached) });
  } catch (err) {
    console.error('Vercel sendMail error:', err);
    return res.status(500).json({ sent: false, error: err.message });
  }
};
