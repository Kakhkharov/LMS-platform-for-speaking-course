const fs = require('fs');
const path = require('path');
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}
}
const nodemailer = require('nodemailer');

try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}
try { require('dotenv').config(); } catch (e) {}

const DEFAULT_EMAIL_USER = "musurmonqahharov747@gmail.com";
const DEFAULT_EMAIL_PASS = "qiircoevannrafbr";

if (!process.env.EMAIL_USER) {
  process.env.EMAIL_USER = DEFAULT_EMAIL_USER;
}
if (!process.env.EMAIL_PASS) {
  process.env.EMAIL_PASS = DEFAULT_EMAIL_PASS;
}

function resolveBannerPath() {
  const candidates = [
    path.resolve(__dirname, 'image', 'banner_02.png'),
    path.resolve(__dirname, '..', 'image', 'banner_02.png'),
    path.resolve(process.cwd(), 'image', 'banner_02.png'),
    path.resolve(process.cwd(), 'mathscore-backend', 'image', 'banner_02.png'),
    path.resolve(__dirname, 'banner_02.png')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const BANNER_02_PATH = resolveBannerPath() || path.resolve(__dirname, '..', 'image', 'banner_02.png');
const BANNER_CID = 'practise-banner-02@practise.uz';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  family: 4,
  auth: {
    user: process.env.EMAIL_USER || DEFAULT_EMAIL_USER,
    pass: process.env.EMAIL_PASS || DEFAULT_EMAIL_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
});

async function deliverMail(mailOptions) {
  // 1. If GMAIL_WEBAPP_URL is configured, send directly via Google Apps Script HTTPS Web App
  if (process.env.GMAIL_WEBAPP_URL) {
    try {
      const gRes = await fetch(process.env.GMAIL_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: mailOptions.to,
          subject: mailOptions.subject,
          html: mailOptions.html
        })
      });
      if (gRes.ok) {
        console.log(`[MAILER] Xat Google Apps Script Web App orqali yuborildi: ${mailOptions.to}`);
        return { sent: true };
      }
    } catch (gErr) {
      console.warn('[MAILER] Google Apps Script uzatish xatosi:', gErr.message);
    }
  }

  // 2. Try HTTPS proxy on Vercel (bypasses Railway SMTP firewall block)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    const httpsRes = await fetch('https://practise.uz/api/send-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (httpsRes.ok) {
      const data = await httpsRes.json();
      if (data.sent) {
        console.log(`[MAILER] Xat Vercel HTTPS orqali yuborildi: ${mailOptions.to}`);
        return { sent: true };
      }
    }
  } catch (httpsErr) {
    console.warn('[MAILER] Vercel HTTPS uzatish o\'tmadi, to\'g\'ridan-to\'g\'ri SMTP sinab ko\'rilmoqda:', httpsErr.message);
  }

  // 3. Direct SMTP fallback (works on localhost or open cloud SMTP)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    await transporter.sendMail(mailOptions);
    console.log(`[MAILER] Xat to'g'ridan-to'g'ri SMTP orqali yuborildi: ${mailOptions.to}`);
    return { sent: true };
  }

  throw new Error("EMAIL_USER / EMAIL_PASS sozlanmagan");
}

function buildBannerEmail(bodyHtml) {
  const activeBannerPath = resolveBannerPath();
  const hasBanner = Boolean(activeBannerPath && fs.existsSync(activeBannerPath));
  const attachments = hasBanner
    ? [
        {
          filename: 'banner_02.png',
          path: activeBannerPath,
          cid: BANNER_CID
        }
      ]
    : [];

  const html = `
    <div style="background-color: #f8fafc; padding: 20px 12px; font-family: 'Segoe UI', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06); color: #0f172a;">
        ${hasBanner ? `
        <div style="width: 100%; background: #0f172a; line-height: 0;">
          <img src="cid:${BANNER_CID}" alt="Practise Platform Banner" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0;" />
        </div>
        ` : ''}
        <div style="padding: 26px 24px 22px;">
          <div style="font-size: 18px; font-weight: 800; color: #4f46e5; letter-spacing: -0.02em; margin-bottom: 14px;">Practise</div>
          ${bodyHtml}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 14px;" />
          <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.5;">
            Qo'shimcha savollaringiz bo'lsa: <a href="https://t.me/azizbekbro" style="color: #4f46e5; font-weight: 600; text-decoration: underline;">https://t.me/azizbekbro</a>
          </p>
        </div>
      </div>
    </div>
  `;

  return { html, attachments };
}

function getDefaultStudentLoginUrl() {
  if (process.env.PUBLIC_URL) {
    return `${String(process.env.PUBLIC_URL).replace(/\/+$/, '')}/student`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/student`;
  }
  return 'http://localhost:5173/student';
}

const sendStudentCredentials = async (email, name, oneTimePassword, loginUrl = getDefaultStudentLoginUrl(), options = {}) => {
  const safeLoginUrl = String(loginUrl || getDefaultStudentLoginUrl()).trim();
  const cleanTariff = String(options?.tariff || 'VIP').trim().toUpperCase() === 'FREE' ? 'FREE' : 'VIP';
  const cleanCourse = options?.course ? String(options.course).trim() : '';
  const tariffBadgeBg = cleanTariff === 'FREE' ? '#f1f5f9' : '#fef3c7';
  const tariffBadgeColor = cleanTariff === 'FREE' ? '#334155' : '#92400e';
  const { html, attachments } = buildBannerEmail(`
    <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px;">Assalomu alaykum, ${name}!</h2>
    <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">
      Siz <strong>Practise</strong> platformasiga muvaffaqiyatli qo'shildingiz! Quyida student panelingizga kirish havolasi va <strong>kirish parolingiz (bir martalik parol)</strong> keltirilgan:
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Tarif:</strong>
        <span style="display: inline-block; background: ${tariffBadgeBg}; color: ${tariffBadgeColor}; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 800;">${cleanTariff}</span>
      </p>
      ${cleanCourse ? `
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Kurs:</strong> <span style="color: #0f172a; font-weight: 600;">${cleanCourse}</span>
      </p>` : ''}
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Login (Email):</strong> <span style="color: #0f172a;">${email}</span>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Kirish paroli (Bir martalik parol):</strong>
        <span style="display: inline-block; background: #eef2ff; color: #3730a3; padding: 3px 10px; border-radius: 6px; font-family: monospace; font-size: 15px; font-weight: 800; letter-spacing: 0.5px;">${oneTimePassword}</span>
      </p>
      <p style="margin: 0; font-size: 13px; color: #475569; word-break: break-all;">
        <strong>Student panelga kirish havolasi:</strong><br/>
        <a href="${safeLoginUrl}" style="color: #4f46e5; font-weight: 600;">${safeLoginUrl}</a>
      </p>
    </div>
    <p style="margin: 0 0 18px; font-size: 13px; color: #475569; line-height: 1.55;">
      Ushbu parol birinchi marta tizimga kirish uchun mo'ljallangan. Panelga kirganingizdan so'ng o'zingizga qulay doimiy parolni o'rnatishingiz mumkin.
    </p>
    <div style="margin: 20px 0 6px;">
      <a href="${safeLoginUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">Student Panelga Kirish</a>
    </div>
  `);

  const mailOptions = {
    from: `"Practise" <${process.env.EMAIL_USER || 'no-reply@practise.uz'}>`,
    to: email,
    subject: `Practise (${cleanTariff}) — Student panelga kirish paroli va havola`,
    html,
    attachments
  };

  try {
    console.log(`[MAILER] Yangi student qo'shildi (Practise - ${cleanTariff}):\n  Email: ${email}\n  Bir martalik parol: ${oneTimePassword}\n  Havola: ${safeLoginUrl}\n  Banner: ${attachments.length > 0 ? 'banner_02.png attached' : 'none'}`);
    const res = await deliverMail(mailOptions);
    return { sent: Boolean(res?.sent), tariff: cleanTariff, bannerAttached: attachments.length > 0 };
  } catch (error) {
    console.error('[MAILER] Email yuborishda xatolik:', error);
    return { sent: false, tariff: cleanTariff, error: error.message, bannerAttached: attachments.length > 0 };
  }
};

const sendPasswordReset = async (email, name, resetLink, newLoginPassword = '', loginUrl = getDefaultStudentLoginUrl()) => {
  const safeLoginUrl = String(loginUrl || getDefaultStudentLoginUrl()).trim();
  const hasNewPassword = Boolean(String(newLoginPassword || '').trim());
  const { html, attachments } = buildBannerEmail(`
    <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px;">Assalomu alaykum, ${name}!</h2>
    <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">
      Siz <strong>Practise</strong> platformasidagi student hisobingiz parolini tiklash (<em>Unutdingizmi?</em>) bo'yicha so'rov yubordingiz.
    </p>
    ${hasNewPassword ? `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Login (Email):</strong> <span style="color: #0f172a;">${email}</span>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Kirish uchun yangi parolingiz:</strong>
        <span style="display: inline-block; background: #eef2ff; color: #3730a3; padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 16px; font-weight: 800; letter-spacing: 0.5px;">${newLoginPassword}</span>
      </p>
      <p style="margin: 0; font-size: 13px; color: #475569; word-break: break-all;">
        <strong>Student panelga kirish havolasi:</strong><br/>
        <a href="${safeLoginUrl}" style="color: #4f46e5; font-weight: 600;">${safeLoginUrl}</a>
      </p>
    </div>
    <p style="margin: 0 0 16px; font-size: 13px; color: #334155; line-height: 1.55;">
      Yuqoridagi yangi parol bilan hoziroq Student paneliga kirishingiz mumkin.
    </p>
    <div style="margin: 18px 0;">
      <a href="${safeLoginUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">Student Panelga Kirish</a>
    </div>
    ${resetLink ? `
    <p style="font-size: 12px; color: #64748b; line-height: 1.55; margin: 14px 0 0;">
      Agar o'zingiz xohlagan boshqa parol o'rnatmoqchi bo'lsangiz, quyidagi havoladan foydalanishingiz mumkin (24 soat amal qiladi):<br/>
      <a href="${resetLink}" style="color: #4f46e5; word-break: break-all;">${resetLink}</a>
    </p>` : ''}
    ` : `
    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">
      O'zingiz xohlagan yangi parolni o'rnatish uchun quyidagi tugmani bosing:
    </p>
    <div style="margin: 20px 0;">
      <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">Parolni Tiklash</a>
    </div>
    <p style="font-size: 12px; color: #64748b; word-break: break-all; line-height: 1.5;">
      Agar tugma ishlamasa, quyidagi havolani brauzeringizga nusxalab oching:<br/>
      <a href="${resetLink}" style="color: #4f46e5;">${resetLink}</a>
    </p>
    `}
    <p style="font-size: 13px; color: #475569; margin: 12px 0 0;">Agar bu so'rovni siz yubormagan bo'lsangiz, darhol ma'muriyatga xabar bering.</p>
  `);

  const mailOptions = {
    from: `"Practise" <${process.env.EMAIL_USER || 'no-reply@practise.uz'}>`,
    to: email,
    subject: hasNewPassword ? 'Practise — Kirish uchun yangi parol' : 'Practise — Parolni tiklash',
    html,
    attachments
  };

  try {
    console.log(`[MAILER] Parol tiklash so'rovi (Practise):\n  Email: ${email}\n  Yangi parol: ${hasNewPassword ? '***' : 'link-only'}\n  Login: ${safeLoginUrl}`);
    const res = await deliverMail(mailOptions);
    return { sent: Boolean(res?.sent), bannerAttached: attachments.length > 0 };
  } catch (error) {
    console.error('[MAILER] Email yuborishda xatolik:', error);
    return { sent: false, error: error.message, bannerAttached: attachments.length > 0 };
  }
};

const sendPasswordChangeNotification = async (email, name, newPassword, loginUrl = getDefaultStudentLoginUrl()) => {
  const safeLoginUrl = String(loginUrl || getDefaultStudentLoginUrl()).trim();
  const { html, attachments } = buildBannerEmail(`
    <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px;">Assalomu alaykum, ${name}!</h2>
    <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: #334155;">
      Sizning <strong>Practise</strong> platformasidagi akkauntingiz paroli muvaffaqiyatli o'zgartirildi.
    </p>
    <p style="margin: 0 0 14px; font-size: 14px; color: #0f172a;">
      <strong>Yangi parolingiz:</strong>
      <span style="display: inline-block; background: #eef2ff; color: #3730a3; padding: 2px 10px; border-radius: 6px; font-family: monospace; font-weight: 700;">${newPassword}</span>
    </p>
    <p style="margin: 0 0 18px; font-size: 13px; color: #475569; line-height: 1.55;">
      Agar bu harakatni siz amalga oshirmagan bo'lsangiz, zudlik bilan platformaga kirib parolingizni tiklang yoki ma'muriyatga murojaat qiling.
    </p>
    <div style="margin: 18px 0 6px;">
      <a href="${safeLoginUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">Platformaga Kirish</a>
    </div>
  `);

  const mailOptions = {
    from: `"Practise" <${process.env.EMAIL_USER || 'no-reply@practise.uz'}>`,
    to: email,
    subject: 'Practise - Parolingiz o\'zgartirildi',
    html,
    attachments
  };

  try {
    console.log(`[MAILER] Parol o'zgarishi yuborildi: ${email}`);
    const res = await deliverMail(mailOptions);
    return { sent: Boolean(res?.sent), bannerAttached: attachments.length > 0 };
  } catch (error) {
    console.error('[MAILER] Email yuborishda xatolik:', error);
    return { sent: false, error: error.message, bannerAttached: attachments.length > 0 };
  }
};

const sendCourseAssignedNotification = async (email, name, courseTitle, loginUrl = getDefaultStudentLoginUrl(), options = {}) => {
  const safeLoginUrl = String(loginUrl || getDefaultStudentLoginUrl()).trim();
  const cleanTariff = String(options?.tariff || 'VIP').trim().toUpperCase() === 'FREE' ? 'FREE' : 'VIP';
  const tariffBadgeBg = cleanTariff === 'FREE' ? '#f1f5f9' : '#fef3c7';
  const tariffBadgeColor = cleanTariff === 'FREE' ? '#334155' : '#92400e';
  const { html, attachments } = buildBannerEmail(`
    <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px;">Assalomu alaykum, ${name}!</h2>
    <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #334155;">
      Sizga <strong>Practise</strong> platformasida yangi kurs biriktirildi!
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Yangi Kurs:</strong> <span style="color: #0f172a; font-weight: 700; font-size: 15px;">${courseTitle}</span>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Tarif:</strong>
        <span style="display: inline-block; background: ${tariffBadgeBg}; color: ${tariffBadgeColor}; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 800;">${cleanTariff}</span>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">
        <strong>Login (Email):</strong> <span style="color: #0f172a;">${email}</span>
      </p>
      <p style="margin: 0; font-size: 13px; color: #475569; word-break: break-all;">
        <strong>Student panelga kirish havolasi:</strong><br/>
        <a href="${safeLoginUrl}" style="color: #4f46e5; font-weight: 600;">${safeLoginUrl}</a>
      </p>
    </div>
    <p style="margin: 0 0 18px; font-size: 13px; color: #475569; line-height: 1.55;">
      Siz o'z shaxsiy hisobingizga mavjud parolingiz bilan kirib, yangi kurs darslarini boshlashingiz mumkin.
    </p>
    <div style="margin: 20px 0 6px;">
      <a href="${safeLoginUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">Student Panelga Kirish</a>
    </div>
  `);

  const mailOptions = {
    from: `"Practise" <${process.env.EMAIL_USER || DEFAULT_EMAIL_USER}>`,
    to: email,
    subject: `Practise — Sizga yangi kurs qo'shildi: ${courseTitle}`,
    html,
    attachments
  };

  try {
    console.log(`[MAILER] Talabaga yangi kurs biriktirildi: ${email} -> ${courseTitle}`);
    const res = await deliverMail(mailOptions);
    return { sent: Boolean(res?.sent), tariff: cleanTariff, bannerAttached: attachments.length > 0 };
  } catch (error) {
    console.error('[MAILER] Email yuborishda xatolik:', error);
    return { sent: false, error: error.message, bannerAttached: attachments.length > 0 };
  }
};

module.exports = { transporter, sendStudentCredentials, sendCourseAssignedNotification, sendPasswordReset, sendPasswordChangeNotification, buildBannerEmail, BANNER_02_PATH };
