const path = require('path');
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}
}
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}
try { require('dotenv').config(); } catch (e) {}

const DEFAULT_DATABASE_URL = "postgresql://postgres.oluicgncdqvuwboptnon:%2BM%40s%3FrjHHxStxv7@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=25";
const DEFAULT_DIRECT_URL = "postgresql://postgres.oluicgncdqvuwboptnon:%2BM%40s%3FrjHHxStxv7@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
const DEFAULT_JWT_SECRET = "mathscore-production-super-secret-99890";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = DEFAULT_DIRECT_URL;
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = DEFAULT_JWT_SECRET;
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes(':+M@s?rjHHxStxv7@')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(':+M@s?rjHHxStxv7@', ':%2BM%40s%3FrjHHxStxv7@');
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout=')) {
  process.env.DATABASE_URL += (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connect_timeout=25';
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { transporter, sendStudentCredentials, sendCourseAssignedNotification, sendPasswordReset, sendPasswordChangeNotification } = require('./mailer');

const db = require('./db');
const { gradeShortAnswerQuestion } = require('./geminiGrader');
const {
  JWT_SECRET,
  corsOptions,
  globalRateLimiter,
  authRateLimiter,
  sanitizeInput,
  authenticateToken,
  requireRole
} = require('./security');

const app = express();
app.set('trust proxy', 1);

// Normalize URL for Vercel Serverless Function rewrites
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

function getPublicOrigin(req) {
  const originHeader = req?.get?.('origin');
  if (originHeader) return originHeader.replace(/\/+$/, '');
  const forwardedHost = req?.headers?.['x-forwarded-host'] || req?.get?.('host');
  if (forwardedHost) {
    const protoHeader = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'https').split(',')[0].trim();
    return `${protoHeader}://${forwardedHost}`.replace(/\/+$/, '');
  }
  if (process.env.PUBLIC_URL) return String(process.env.PUBLIC_URL).replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://practise.uz';
}

// Automatically catch all async errors in route handlers to prevent process crashes
const originalMethods = ['get', 'post', 'put', 'patch', 'delete'];
originalMethods.forEach(method => {
  const original = app[method];
  app[method] = function (path, ...handlers) {
    const wrappedHandlers = handlers.map(handler => {
      if (typeof handler !== 'function' || handler.length > 3) return handler;
      return (req, res, next) => {
        try {
          const result = handler(req, res, next);
          if (result && typeof result.catch === 'function') {
            result.catch(next);
          }
        } catch (err) {
          next(err);
        }
      };
    });
    return original.call(this, path, ...wrappedHandlers);
  };
});
const PORT = process.env.PORT || 5000;

const startTime = Date.now();
let maintenanceMode = false;
let sseClients = [];

app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(sanitizeInput);
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists (use /tmp/uploads on read-only Vercel serverless filesystem)
const localUploadDir = path.join(__dirname, 'uploads');
const tmpUploadDir = path.join(os.tmpdir(), 'mathscore-uploads');
let uploadDir = localUploadDir;
try {
  if (!fs.existsSync(localUploadDir)) {
    fs.mkdirSync(localUploadDir, { recursive: true });
  }
  fs.accessSync(localUploadDir, fs.constants.W_OK);
} catch (e) {
  uploadDir = tmpUploadDir;
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

// Secure Video Streaming / Uploads Access
const serveStaticUpload = (req, res, next) => {
  express.static(uploadDir)(req, res, (err) => {
    if (err) return next(err);
    if (uploadDir !== localUploadDir) {
      return express.static(localUploadDir)(req, res, next);
    }
    next();
  });
};

app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const publicExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.zip',
    '.mp3', '.wav', '.ogg', '.m4a', '.webm', '.aac', '.flac', '.opus'
  ];
  
  // Allow public access to images, PDFs, audio recordings, and documents (used in landing page, task assignments, homeworks, etc.)
  if (publicExtensions.includes(ext)) {
    return next();
  }

  const token = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Ruxsat yo\'q. Token kerak.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Ruxsat etilmagan token.' });
    next();
  });
}, serveStaticUpload);

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname || '');
    if (!ext && file.mimetype) {
      if (file.mimetype.includes('webm')) ext = '.webm';
      else if (file.mimetype.includes('ogg')) ext = '.ogg';
      else if (file.mimetype.includes('mp4') || file.mimetype.includes('m4a')) ext = '.m4a';
      else if (file.mimetype.includes('mpeg') || file.mimetype.includes('mp3')) ext = '.mp3';
      else if (file.mimetype.includes('wav')) ext = '.wav';
    }
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for videos
});

app.get('/api', (req, res) => res.json({ status: 'ok', service: 'Practise LMS API' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.get('/api/system/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.push(res);
  req.on('close', () => { sseClients = sseClients.filter(client => client !== res); });
});

function broadcastToDashboard(type, data) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  sseClients.forEach(client => { client.write(`data: ${payload}\n\n`); });
}

async function sendNotificationToUser(userId, title, message) {
  try {
    const notif = await db.prisma.notification.create({
      data: { userId, title, message }
    });
    broadcastToDashboard('notification', { userId, notif });
    return notif;
  } catch (e) {
    console.error('Failed to send notification to user:', e);
    return null;
  }
}

async function sendNotificationToAdmins(title, message) {
  try {
    const admins = await db.prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true }
    });
    const results = [];
    for (const admin of admins) {
      const n = await sendNotificationToUser(admin.id, title, message);
      if (n) results.push(n);
    }
    return results;
  } catch (e) {
    console.error('Failed to notify admins:', e);
    return [];
  }
}

async function sendNotificationToCourseStudents(courseTitleOrId, title, message) {
  try {
    if (!courseTitleOrId || courseTitleOrId === 'All' || courseTitleOrId === 'Barchasi' || courseTitleOrId === 'All Courses' || courseTitleOrId === 'Barcha kurslar') {
      const allStudents = await db.prisma.user.findMany({ where: { role: 'student' }, select: { id: true } });
      for (const s of allStudents) {
        await sendNotificationToUser(s.id, title, message);
      }
      return;
    }

    const course = await db.prisma.course.findFirst({
      where: {
        OR: [
          { id: courseTitleOrId },
          { title: courseTitleOrId },
          { title: { contains: courseTitleOrId } }
        ]
      }
    });

    const userQuery = course ? {
      role: 'student',
      OR: [
        { userCourses: { some: { courseId: course.id } } },
        { course: { contains: course.title } },
        { course: courseTitleOrId }
      ]
    } : {
      role: 'student',
      course: { contains: courseTitleOrId }
    };

    const students = await db.prisma.user.findMany({
      where: userQuery,
      select: { id: true, name: true, email: true }
    });

    for (const student of students) {
      await sendNotificationToUser(student.id, title, message);
    }
  } catch (e) {
    console.error('Failed to notify course students:', e);
  }
}

// ==========================================
// GAMIFICATION (STREAK, COINS, XP & LEADERBOARD) HELPERS
// ==========================================
function getTashkentDateStr(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (e) {
    return new Date(date.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  }
}

function shiftDateStr(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function getIsoWeekKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function parseActivityDates(raw) {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

function normalizePeriodBuckets(user, todayStr = getTashkentDateStr()) {
  const lastReset = user.lastXpResetDate || user.lastActivityDate || '';
  const sameDay = lastReset === todayStr;
  const sameWeek = lastReset ? getIsoWeekKey(lastReset) === getIsoWeekKey(todayStr) : false;
  const sameMonth = lastReset ? lastReset.slice(0, 7) === todayStr.slice(0, 7) : false;

  // Check if streak is still active (today or yesterday)
  const yesterdayStr = shiftDateStr(todayStr, -1);
  const activeStreak = (user.lastActivityDate === todayStr || user.lastActivityDate === yesterdayStr)
    ? (user.streak || 0)
    : 0;

  return {
    xp: user.xp || 0,
    coins: user.coins || 0,
    streak: activeStreak,
    dailyXp: sameDay ? (user.dailyXp || 0) : 0,
    weeklyXp: sameWeek ? (user.weeklyXp || 0) : 0,
    monthlyXp: sameMonth ? (user.monthlyXp || 0) : 0,
    lastActivityDate: user.lastActivityDate || null,
    activityDates: parseActivityDates(user.activityDates)
  };
}

// Haftalik kunlik kirish (Mon-Sun) coin jadvali:
// Dushanba: 7, Seshanba: 14, Chorshanba: 21, Payshanba: 28, Juma: 35, Shanba: 42, Yakshanba: 49
const DAILY_LOGIN_COINS_BY_WEEKDAY = [7, 14, 21, 28, 35, 42, 49];
const DAILY_LOGIN_WEEKDAYS = [
  { index: 0, key: 'mon', label: 'MON', uzLabel: 'Dushanba', coins: 7 },
  { index: 1, key: 'tue', label: 'TUE', uzLabel: 'Seshanba', coins: 14 },
  { index: 2, key: 'wed', label: 'WED', uzLabel: 'Chorshanba', coins: 21 },
  { index: 3, key: 'thu', label: 'THU', uzLabel: 'Payshanba', coins: 28 },
  { index: 4, key: 'fri', label: 'FRI', uzLabel: 'Juma', coins: 35 },
  { index: 5, key: 'sat', label: 'SAT', uzLabel: 'Shanba', coins: 42 },
  { index: 6, key: 'sun', label: 'SUN', uzLabel: 'Yakshanba', coins: 49 }
];

function getWeekdayIndexFromDateStr(dateStr) {
  const [y, m, d] = String(dateStr || getTashkentDateStr()).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const utcDay = dt.getUTCDay(); // 0=Sun, 1=Mon..6=Sat
  return utcDay === 0 ? 6 : utcDay - 1; // 0=Mon..6=Sun
}

function getDailyLoginCoinsForDate(dateStr = getTashkentDateStr()) {
  const idx = getWeekdayIndexFromDateStr(dateStr);
  return DAILY_LOGIN_COINS_BY_WEEKDAY[idx] || 7;
}

function getMondayOfWeekStr(dateStr = getTashkentDateStr()) {
  const idx = getWeekdayIndexFromDateStr(dateStr);
  return shiftDateStr(dateStr, -idx);
}

const dailyCheckinLocks = new Map();

async function withUserCheckinLock(userId, fn) {
  const key = String(userId);
  const prev = dailyCheckinLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  dailyCheckinLocks.set(key, prev.then(() => current, () => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (dailyCheckinLocks.get(key) === current) {
      dailyCheckinLocks.delete(key);
    }
  }
}

async function ensureDailyLoginCheckin(userId, dateStr = getTashkentDateStr(), options = {}) {
  if (!userId) return null;
  const manualClaim = Boolean(options?.manualClaim);
  return withUserCheckinLock(userId, async () => {
    const user = await db.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const buckets = normalizePeriodBuckets(user, dateStr);
    if (user.role !== 'student') {
      return {
        alreadyAwarded: true,
        awardedXp: 0,
        awardedCoins: 0,
        todayRewardCoins: getDailyLoginCoinsForDate(dateStr),
        userStats: buckets
      };
    }

    const expectedCoins = getDailyLoginCoinsForDate(dateStr);
    const dbData = readLandingDB();
    if (!manualClaim && dbData.gamificationResetDate === dateStr) {
      return {
        alreadyAwarded: false,
        resetSuppressed: true,
        awardedXp: 0,
        awardedCoins: 0,
        todayRewardCoins: expectedCoins,
        userStats: buckets
      };
    }

    const eventKey = `daily_checkin_${dateStr}`;
    const existingEvent = await db.prisma.gamificationEvent.findUnique({
      where: { userId_eventKey: { userId, eventKey } }
    });

    if (!existingEvent) {
      try {
        const resAward = await awardStudentProgress({
          userId,
          eventKey,
          type: 'daily_login',
          xp: 10,
          coins: expectedCoins,
          meta: { date: dateStr, weekdayCoins: expectedCoins, schedule: 'mon_sun_7x' },
          countStreak: true
        });
        return {
          alreadyAwarded: Boolean(resAward?.alreadyAwarded),
          awardedXp: resAward?.awardedXp || 0,
          awardedCoins: resAward?.awardedCoins || 0,
          todayRewardCoins: expectedCoins,
          userStats: resAward?.userStats || buckets
        };
      } catch (err) {
        if (err?.code === 'P2002') {
          const freshUser = await db.prisma.user.findUnique({ where: { id: userId } });
          return {
            alreadyAwarded: true,
            awardedXp: 0,
            awardedCoins: 0,
            todayRewardCoins: expectedCoins,
            userStats: normalizePeriodBuckets(freshUser || user, dateStr)
          };
        }
        throw err;
      }
    }

    // Legacy today check-in top-up (e.g. flat 5 coin -> Monday 7 coin diff once)
    if ((existingEvent.coins || 0) < expectedCoins) {
      const diffCoins = expectedCoins - (existingEvent.coins || 0);
      await db.prisma.gamificationEvent.update({
        where: { id: existingEvent.id },
        data: {
          coins: expectedCoins,
          meta: JSON.stringify({ date: dateStr, weekdayCoins: expectedCoins, schedule: 'mon_sun_7x', toppedUp: diffCoins })
        }
      });
      const updatedUser = await db.prisma.user.update({
        where: { id: userId },
        data: { coins: (user.coins || 0) + diffCoins }
      });
      const updatedStats = normalizePeriodBuckets(updatedUser, dateStr);
      broadcastToDashboard('gamification_update', { userId, ...updatedStats });
      return {
        alreadyAwarded: false,
        upgradedFromLegacy: true,
        awardedXp: 0,
        awardedCoins: diffCoins,
        todayRewardCoins: expectedCoins,
        userStats: updatedStats
      };
    }

    return {
      alreadyAwarded: true,
      awardedXp: 0,
      awardedCoins: 0,
      todayRewardCoins: expectedCoins,
      userStats: buckets
    };
  });
}

async function getWeeklyCheckinSummary(userId, dateStr = getTashkentDateStr()) {
  const mondayStr = getMondayOfWeekStr(dateStr);
  const todayIdx = getWeekdayIndexFromDateStr(dateStr);
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDateStr(mondayStr, i));
  const eventKeys = weekDates.map(d => `daily_checkin_${d}`);

  const events = userId
    ? await db.prisma.gamificationEvent.findMany({
        where: {
          userId: String(userId),
          eventKey: { in: eventKeys }
        }
      })
    : [];

  const eventByKey = new Map(events.map(ev => [ev.eventKey, ev]));
  let totalEarnedWeekCoins = 0;
  let checkedDaysCount = 0;

  const days = weekDates.map((d, i) => {
    const meta = DAILY_LOGIN_WEEKDAYS[i];
    const ev = eventByKey.get(`daily_checkin_${d}`);
    const checked = Boolean(ev);
    const coinsEarned = checked ? (ev.coins || meta.coins) : 0;
    if (checked) {
      checkedDaysCount += 1;
      totalEarnedWeekCoins += coinsEarned;
    }
    return {
      index: i,
      key: meta.key,
      label: meta.label,
      uzLabel: meta.uzLabel,
      date: d,
      rewardCoins: meta.coins,
      coinsEarned,
      checked,
      isToday: d === dateStr,
      isPast: d < dateStr,
      isFuture: d > dateStr,
      missed: d < dateStr && !checked
    };
  });

  return {
    weekKey: getIsoWeekKey(dateStr),
    mondayDate: mondayStr,
    sundayDate: weekDates[6],
    todayDate: dateStr,
    todayIndex: todayIdx,
    todayRewardCoins: DAILY_LOGIN_COINS_BY_WEEKDAY[todayIdx] || 7,
    checkedDaysCount,
    totalEarnedWeekCoins,
    totalPossibleWeekCoins: DAILY_LOGIN_COINS_BY_WEEKDAY.reduce((acc, n) => acc + n, 0),
    days
  };
}

function getStudentDailyGoalXp(userId) {
  try {
    const dbData = readLandingDB();
    const val = Number(dbData?.studentDailyGoals?.[String(userId)]);
    return Number.isFinite(val) && val >= 10 ? Math.round(val) : 100;
  } catch (e) {
    return 100;
  }
}

function isUserOneTimePasswordActive(userId) {
  try {
    const dbData = readLandingDB();
    return Boolean(dbData?.oneTimePasswordUsers?.[String(userId)]?.active);
  } catch (e) {
    return false;
  }
}

function clearUserOneTimePassword(userId) {
  try {
    const dbData = readLandingDB();
    if (dbData?.oneTimePasswordUsers?.[String(userId)]?.active) {
      dbData.oneTimePasswordUsers[String(userId)] = {
        ...dbData.oneTimePasswordUsers[String(userId)],
        active: false,
        clearedAt: new Date().toISOString()
      };
      writeLandingDB(dbData);
    }
  } catch (e) {
    console.error('Failed to clear OTP flag:', e);
  }
}

const PRIMARY_ADMIN_EMAILS = new Set([
  'turgunboevsss@gmail.com',
  'musurmonqahharov747@gmail.com'
]);

function isPrimaryAdminEmail(email) {
  return PRIMARY_ADMIN_EMAILS.has(String(email || '').trim().toLowerCase());
}

function getAdminType(email) {
  return isPrimaryAdminEmail(email) ? 'primary' : 'support';
}

function getStudentTariff(userId) {
  try {
    const dbData = readLandingDB();
    const raw = String(dbData?.studentTariffs?.[String(userId)] || 'VIP').trim().toUpperCase();
    return raw === 'FREE' ? 'FREE' : 'VIP';
  } catch (e) {
    return 'VIP';
  }
}

function setStudentTariff(userId, tariff) {
  const clean = String(tariff || '').trim().toUpperCase() === 'FREE' ? 'FREE' : 'VIP';
  const dbData = readLandingDB();
  if (!dbData.studentTariffs || typeof dbData.studentTariffs !== 'object') {
    dbData.studentTariffs = {};
  }
  dbData.studentTariffs[String(userId)] = clean;
  writeLandingDB(dbData);
  return clean;
}

function recordAdminActivity({ action, user, ip }) {
  try {
    if (!user || user.role !== 'admin') return null;
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.adminActivityLogs)) dbData.adminActivityLogs = [];
    const adminType = getAdminType(user.email);
    const cleanIp = String(ip || '').replace(/^::ffff:/, '') || '127.0.0.1';
    const entry = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: action === 'logout' ? 'logout' : 'login',
      label: action === 'logout' ? 'Chiqish' : 'Kirish',
      userId: user.id,
      name: user.name || 'Admin',
      email: user.email || '',
      adminType,
      roleLabel: adminType === 'primary' ? 'Asosiy Admin' : 'Yordamchi Admin',
      ip: cleanIp,
      timestamp: new Date().toISOString()
    };
    dbData.adminActivityLogs.unshift(entry);
    dbData.adminActivityLogs = dbData.adminActivityLogs.slice(0, 500);
    writeLandingDB(dbData);
    broadcastToDashboard('admin_activity_log', entry);
    return entry;
  } catch (err) {
    console.error('recordAdminActivity error:', err);
    return null;
  }
}

async function getPrimaryAzizbekProfile() {
  try {
    const azizbek = await db.prisma.user.findFirst({
      where: { email: 'turgunboevsss@gmail.com' },
      select: { id: true, name: true, email: true, avatar: true }
    });
    return azizbek || { id: null, name: 'Azizbek', email: 'turgunboevsss@gmail.com', avatar: '' };
  } catch (e) {
    return { id: null, name: 'Azizbek', email: 'turgunboevsss@gmail.com', avatar: '' };
  }
}

function getOptionalAuthUser(req) {
  try {
    const token = req.headers?.authorization?.split(' ')[1] || req.query?.token;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

async function findStudentIdFromPayload({ studentId, studentEmail, studentPhone, studentName }) {
  if (studentId) {
    const u = await db.prisma.user.findUnique({ where: { id: String(studentId) }, select: { id: true } });
    if (u) return u.id;
  }
  if (studentEmail) {
    const u = await db.prisma.user.findFirst({ where: { email: String(studentEmail).trim() }, select: { id: true } });
    if (u) return u.id;
  }
  if (studentPhone) {
    const u = await db.prisma.user.findFirst({ where: { phone: String(studentPhone).trim() }, select: { id: true } });
    if (u) return u.id;
  }
  if (studentName) {
    const u = await db.prisma.user.findFirst({
      where: { role: 'student', name: { contains: String(studentName).trim() } },
      select: { id: true }
    });
    if (u) return u.id;
  }
  return null;
}

const userAwardLocks = new Map();

async function awardStudentProgress(params) {
  const uid = String(params?.userId || '');
  if (!uid) return null;
  const prev = userAwardLocks.get(uid) || Promise.resolve();
  let nextPromise;
  nextPromise = prev
    .catch(() => {})
    .then(() => _awardStudentProgressUnlocked(params))
    .finally(() => {
      if (userAwardLocks.get(uid) === nextPromise) {
        userAwardLocks.delete(uid);
      }
    });
  userAwardLocks.set(uid, nextPromise);
  return nextPromise;
}

async function _awardStudentProgressUnlocked({
  userId,
  eventKey,
  type = 'activity',
  xp = 0,
  coins = 0,
  streakBonus = 0,
  meta = null,
  countStreak = true,
  allowDuplicate = false
}) {
  if (!userId) return null;
  const user = await db.prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const todayStr = getTashkentDateStr();
  const yesterdayStr = shiftDateStr(todayStr, -1);
  const buckets = normalizePeriodBuckets(user, todayStr);

  if (!allowDuplicate && eventKey) {
    const existingEvent = await db.prisma.gamificationEvent.findUnique({
      where: { userId_eventKey: { userId, eventKey: String(eventKey) } }
    });
    if (existingEvent) {
      return {
        alreadyAwarded: true,
        awardedXp: 0,
        awardedCoins: 0,
        awardedStreak: 0,
        userStats: buckets
      };
    }
  }

  const addXp = Math.max(0, Math.round(Number(xp) || 0));
  const addCoins = Math.max(0, Math.round(Number(coins) || 0));
  const addStreakBonus = Math.max(0, Math.round(Number(streakBonus) || 0));

  let nextStreak = user.streak || 0;
  let awardedStreak = 0;
  const activitySet = new Set(buckets.activityDates);

  if (addStreakBonus > 0) {
    const prevActiveStreak = (user.lastActivityDate === todayStr || user.lastActivityDate === yesterdayStr)
      ? (user.streak || 0)
      : 0;
    nextStreak = prevActiveStreak + addStreakBonus;
    awardedStreak = addStreakBonus;
    activitySet.add(todayStr);
  } else if (countStreak) {
    if (user.lastActivityDate === todayStr) {
      nextStreak = Math.max(1, nextStreak);
    } else if (user.lastActivityDate === yesterdayStr) {
      nextStreak = nextStreak + 1;
      awardedStreak = 1;
    } else {
      nextStreak = 1;
      awardedStreak = 1;
    }
    activitySet.add(todayStr);
  }

  const sortedDates = Array.from(activitySet).sort().slice(-60);
  const uniqueEventKey = allowDuplicate
    ? `${eventKey || type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    : String(eventKey || `${type}_${Date.now()}`);

  await db.prisma.gamificationEvent.create({
    data: {
      userId,
      eventKey: uniqueEventKey,
      type,
      xp: addXp,
      coins: addCoins,
      meta: meta ? JSON.stringify({ ...meta, streakBonus: awardedStreak }) : (awardedStreak > 0 ? JSON.stringify({ streakBonus: awardedStreak }) : null)
    }
  });

  const updated = await db.prisma.user.update({
    where: { id: userId },
    data: {
      xp: (user.xp || 0) + addXp,
      coins: (user.coins || 0) + addCoins,
      streak: nextStreak,
      dailyXp: buckets.dailyXp + addXp,
      weeklyXp: buckets.weeklyXp + addXp,
      monthlyXp: buckets.monthlyXp + addXp,
      lastActivityDate: (countStreak || addStreakBonus > 0) ? todayStr : user.lastActivityDate,
      lastXpResetDate: todayStr,
      activityDates: JSON.stringify(sortedDates)
    }
  });

  const userStats = {
    xp: updated.xp,
    coins: updated.coins,
    streak: updated.streak,
    dailyXp: updated.dailyXp,
    weeklyXp: updated.weeklyXp,
    monthlyXp: updated.monthlyXp,
    lastActivityDate: updated.lastActivityDate,
    activityDates: sortedDates
  };

  broadcastToDashboard('gamification_update', { userId, ...userStats });

  return {
    alreadyAwarded: false,
    awardedXp: addXp,
    awardedCoins: addCoins,
    awardedStreak,
    userStats
  };
}

app.use((req, res, next) => {
  if (maintenanceMode && !req.path.startsWith('/api/system') && !req.path.startsWith('/api/auth')) {
    return res.status(503).json({ error: 'Tizimda texnik ishlar olib borilmoqda (Maintenance Mode).' });
  }
  const logEntry = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent']
  };
  res.on('finish', () => {
    logEntry.statusCode = res.statusCode;
    db.logApiRequest(logEntry);
    broadcastToDashboard('api_log', logEntry);
  });
  next();
});

// File Upload (Rasmlar va diagrammalar uchun xavfsiz va moslashuvchan upload)
app.post('/api/upload', (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        jwt.verify(token, JWT_SECRET, (err, user) => {
          if (!err) req.user = user;
          next();
        });
        return;
      } catch (e) {}
    }
  }
  next();
}, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  
  db.logSecurityIncident({ type: 'FILE_UPLOADED', severity: 'LOW', message: `Foydalanuvchi yukladi: ${req.file.originalname}`, ip: req.ip });
  broadcastToDashboard('sec_log', { type: 'FILE_UPLOADED', severity: 'LOW', message: `Fayl yuklandi: ${req.file.originalname}`, ip: req.ip });
  
  res.status(201).json({ url: fileUrl, filename: req.file.originalname, size: req.file.size });
});

// Profile Update
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { avatar, phone, newPassword, name } = req.body;
  if (!avatar && !phone && !newPassword && !name) return res.status(400).json({ error: 'Yangilash uchun ma\'lumot kiritilmadi.' });
  
  const updateData = {};
  if (avatar !== undefined && avatar !== null && String(avatar).trim()) updateData.avatar = String(avatar).trim();
  if (phone !== undefined && phone !== null && String(phone).trim()) updateData.phone = String(phone).trim();
  if (name !== undefined && name !== null && String(name).trim()) updateData.name = String(name).trim();
  if (newPassword && String(newPassword).trim().length > 0) {
    const cleanPass = String(newPassword).trim();
    if (cleanPass.length < 4) return res.status(400).json({ error: 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak.' });
    updateData.password = await bcrypt.hash(cleanPass, 10);
  }
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'Yangilash uchun ma\'lumot kiritilmadi.' });
  }
  
  const updatedUser = await db.prisma.user.update({
    where: { id: req.user.id },
    data: updateData
  });
  
  if (newPassword && String(newPassword).trim().length > 0) {
    const cleanPass = String(newPassword).trim();
    clearUserOneTimePassword(req.user.id);
    try {
      const dbData = readLandingDB();
      if (dbData?.supportAdmins?.[String(req.user.id)]) {
        dbData.supportAdmins[String(req.user.id)].plainPassword = cleanPass;
        writeLandingDB(dbData);
      }
    } catch (e) {}
    const loginUrl = `${getPublicOrigin(req)}/student`;
    sendPasswordChangeNotification(updatedUser.email, updatedUser.name, cleanPass, loginUrl).catch(() => {});
  }
  
  res.json({
    message: 'Profil muvaffaqiyatli yangilandi',
    name: updatedUser.name,
    avatar: updatedUser.avatar,
    phone: updatedUser.phone,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      phone: updatedUser.phone,
      adminType: updatedUser.role === 'admin' ? getAdminType(updatedUser.email) : undefined
    }
  });
});

// Set personal password after logging in with one-time password
app.post('/api/auth/set-initial-password', authenticateToken, async (req, res) => {
  try {
    const rawPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : String(req.body?.newPassword || '');
    if (rawPassword.length < 4) {
      return res.status(400).json({ error: 'Yangi parol kamida 4 ta belgidan iborat bo\'lishi kerak.' });
    }
    const existingUser = await db.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!existingUser) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    await db.prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });
    clearUserOneTimePassword(req.user.id);

    const loginUrl = req.body?.loginUrl || `${getPublicOrigin(req)}/student`;
    sendPasswordChangeNotification(existingUser.email, existingUser.name, rawPassword, loginUrl).catch(() => {});

    try {
      db.logSecurityIncident({ type: 'OTP_REPLACED_WITH_PERMANENT_PASSWORD', severity: 'LOW', message: `Bir martalik parol doimiy parolga almashtirildi: ${existingUser.email}`, ip: req.ip });
    } catch (logErr) {}

    res.json({
      success: true,
      mustChangePassword: false,
      message: 'Doimiy parolingiz saqlandi! Bir martalik parol bekor qilindi.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Auth
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Barcha maydonlarni to\'ldirish shart.' });
  
  const users = await db.get('users');
  if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Ushbu elektron pochta allaqachon ro\'yxatdan o\'tgan.' });

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const newUser = {
    name, email, password: hashedPassword,
    role: role === 'admin' ? 'admin' : 'student',
    avatar: role === 'admin' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop' : 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=256&auto=format&fit=crop'
  };

  await db.insert('users', newUser);
  db.logSecurityIncident({ type: 'USER_REGISTERED', severity: 'LOW', message: `Yangi foydalanuvchi: ${email}`, ip: req.ip });
  broadcastToDashboard('sec_log', { type: 'USER_REGISTERED', severity: 'LOW', message: `Ro'yxatdan o'tish: ${email}`, ip: req.ip });

  res.status(201).json({ message: 'Ro\'yxatdan muvaffaqiyatli o\'tildi!' });
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Elektron pochta va parolni kiriting.' });

  const cleanEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');
  const cleanPassword = rawPassword.trim();

  let user = await db.prisma.user.findFirst({
    where: {
      email: { equals: cleanEmail, mode: 'insensitive' }
    }
  });
  if (!user) {
    const allUsers = await db.prisma.user.findMany();
    user = allUsers.find(u => String(u.email || '').trim().toLowerCase() === cleanEmail) || null;
  }

  let isPasswordValid = false;
  if (user && user.password) {
    if (bcrypt.compareSync(rawPassword, user.password)) {
      isPasswordValid = true;
    } else if (cleanPassword !== rawPassword && bcrypt.compareSync(cleanPassword, user.password)) {
      isPasswordValid = true;
    } else if (/^pr-\d+$/i.test(cleanPassword)) {
      isPasswordValid = bcrypt.compareSync(cleanPassword.toUpperCase(), user.password);
    }
  }

  if (!user || !isPasswordValid) {
    db.logSecurityIncident({ type: 'FAILED_LOGIN', severity: 'HIGH', message: `Failed login attempt for user: ${email}`, ip: req.ip });
    broadcastToDashboard('sec_log', { type: 'FAILED_LOGIN', severity: 'HIGH', message: `Noto'g'ri parol: ${email}`, ip: req.ip });
    return res.status(401).json({ error: 'Elektron pochta yoki parol noto\'g\'ri.' });
  }

  if (user.status === 'Chetlashtirilgan') {
    db.logSecurityIncident({ type: 'EXPELLED_LOGIN_ATTEMPT', severity: 'HIGH', message: `Chetlashtirilgan talaba kirishga urindi: ${email}`, ip: req.ip });
    return res.status(403).json({ error: 'Siz tizimdan chetlashtirilgansiz. Kirish taqiqlangan.' });
  }

  if (user.role === 'student' && user.deadline && new Date(user.deadline) < new Date()) {
    db.logSecurityIncident({ type: 'EXPIRED_LOGIN_ATTEMPT', severity: 'LOW', message: `Muddati o'tgan foydalanuvchi kirishga urindi: ${email}`, ip: req.ip });
    return res.status(403).json({ error: 'Kurs muddati tugagan. Tizimga kirish taqiqlangan.' });
  }

  let gamification = normalizePeriodBuckets(user);
  let dailyCheckinAwarded = null;
  let weeklyCheckins = null;
  if (user.role === 'student') {
    const checkinRes = await ensureDailyLoginCheckin(user.id);
    if (checkinRes?.userStats) {
      gamification = checkinRes.userStats;
    }
    if (checkinRes && checkinRes.awardedCoins > 0) {
      dailyCheckinAwarded = {
        coins: checkinRes.awardedCoins,
        xp: checkinRes.awardedXp,
        upgraded: Boolean(checkinRes.upgradedFromLegacy)
      };
    }
    weeklyCheckins = await getWeeklyCheckinSummary(user.id);
  }

  const mustChangePassword = isUserOneTimePasswordActive(user.id);
  const dailyGoalXp = getStudentDailyGoalXp(user.id);
  const adminType = user.role === 'admin' ? getAdminType(user.email) : undefined;
  const studentTariff = user.role === 'student' ? getStudentTariff(user.id) : undefined;

  if (user.role === 'admin') {
    recordAdminActivity({ action: 'login', user, ip: req.ip });
  }

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminType,
      tariff: studentTariff,
      avatar: user.avatar,
      phone: user.phone,
      course: user.course,
      dailyGoalXp,
      mustChangePassword,
      weeklyCheckins,
      dailyCheckinAwarded,
      ...gamification
    }
  });
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role === 'admin') {
      recordAdminActivity({ action: 'logout', user: req.user, ip: req.ip });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const user = await db.prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      completedLessons: true,
      userCourses: {
        include: { course: { include: { lessons: true } } }
      }
    }
  });
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });

  if (user.status === 'Chetlashtirilgan') {
    return res.status(403).json({ error: 'Siz tizimdan chetlashtirilgansiz. Tizimdan avtomatik chiqarildingiz.' });
  }

  if (user.deadline && new Date(user.deadline) < new Date()) {
    return res.status(403).json({ error: 'Kurs muddati tugagan. Tizimdan avtomatik chiqarildingiz.' });
  }

  let gamification = normalizePeriodBuckets(user);
  let dailyCheckinAwarded = null;
  let weeklyCheckins = null;
  if (user.role === 'student') {
    const checkinRes = await ensureDailyLoginCheckin(user.id);
    if (checkinRes?.userStats) {
      gamification = checkinRes.userStats;
    }
    if (checkinRes && checkinRes.awardedCoins > 0) {
      dailyCheckinAwarded = {
        coins: checkinRes.awardedCoins,
        xp: checkinRes.awardedXp,
        upgraded: Boolean(checkinRes.upgradedFromLegacy)
      };
    }
    weeklyCheckins = await getWeeklyCheckinSummary(user.id);
  }
  
  const enrolledCourses = user.userCourses.map(uc => ({
    id: uc.course.id,
    title: uc.course.title,
    category: uc.course.category,
    instructor: uc.course.instructor,
    price: uc.course.price,
    image: uc.course.image,
    description: uc.course.description,
    lessons: uc.course.lessons,
    grantedAt: uc.grantedAt
  }));

  res.json({
    id: user.id, name: user.name, email: user.email, role: user.role,
    adminType: user.role === 'admin' ? getAdminType(user.email) : undefined,
    tariff: user.role === 'student' ? getStudentTariff(user.id) : 'VIP',
    avatar: user.avatar, course: user.course, status: user.status, phone: user.phone,
    dailyGoalXp: getStudentDailyGoalXp(user.id),
    mustChangePassword: isUserOneTimePasswordActive(user.id),
    weeklyCheckins,
    dailyCheckinAwarded,
    ...gamification,
    enrolledCourses,
    completedLessons: user.completedLessons.map(cl => cl.lessonId)
  });
});

// Interactive Daily Goal & Mon-Sun Coin Check-in API
app.get('/api/daily-goal', authenticateToken, async (req, res) => {
  try {
    let checkinRes = null;
    if (req.user.role === 'student') {
      checkinRes = await ensureDailyLoginCheckin(req.user.id);
    }
    const weeklyCheckins = await getWeeklyCheckinSummary(req.user.id);
    const user = await db.prisma.user.findUnique({ where: { id: req.user.id } });
    const stats = checkinRes?.userStats || (user ? normalizePeriodBuckets(user) : null);
    res.json({
      success: true,
      dailyGoalXp: getStudentDailyGoalXp(req.user.id),
      weeklyCheckins,
      dailyCheckinAwarded: checkinRes && checkinRes.awardedCoins > 0
        ? { coins: checkinRes.awardedCoins, xp: checkinRes.awardedXp }
        : null,
      userStats: stats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/daily-goal', authenticateToken, async (req, res) => {
  try {
    const rawGoal = Number(req.body?.dailyGoalXp);
    if (!Number.isFinite(rawGoal) || rawGoal < 10 || rawGoal > 5000) {
      return res.status(400).json({ error: 'Kunlik XP maqsadi 10 dan 5000 gacha bo\'lishi kerak.' });
    }
    const cleanGoal = Math.round(rawGoal);
    const dbData = readLandingDB();
    if (!dbData.studentDailyGoals || typeof dbData.studentDailyGoals !== 'object') {
      dbData.studentDailyGoals = {};
    }
    dbData.studentDailyGoals[String(req.user.id)] = cleanGoal;
    writeLandingDB(dbData);
    res.json({ success: true, dailyGoalXp: cleanGoal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/daily-goal/checkin', authenticateToken, async (req, res) => {
  try {
    const checkinRes = await ensureDailyLoginCheckin(req.user.id, getTashkentDateStr(), { manualClaim: true });
    const weeklyCheckins = await getWeeklyCheckinSummary(req.user.id);
    res.json({
      success: true,
      alreadyAwarded: Boolean(checkinRes?.alreadyAwarded),
      awardedCoins: checkinRes?.awardedCoins || 0,
      awardedXp: checkinRes?.awardedXp || 0,
      weeklyCheckins,
      userStats: checkinRes?.userStats || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Students
app.get('/api/students', authenticateToken, requireRole('admin'), async (req, res) => {
  const users = await db.prisma.user.findMany({
    where: { role: 'student' },
    include: {
      userCourses: {
        include: { course: true }
      }
    }
  });
  res.json(users.map(u => {
    let currentStatus = u.status || 'Online';
    if (currentStatus !== 'Chetlashtirilgan' && u.deadline && new Date(u.deadline) < new Date()) {
      currentStatus = 'Muddati tugagan';
    }
    return {
      id: u.id, name: u.name, email: u.email,
      course: u.userCourses.map(uc => uc.course.title).join(', ') || u.course || 'Kurs tayinlanmagan',
      courses: u.userCourses.map(uc => ({ id: uc.course.id, title: uc.course.title })),
      tariff: getStudentTariff(u.id),
      status: currentStatus, avatar: u.avatar, phone: u.phone, deadline: u.deadline,
      createdAt: u.createdAt
    };
  }));
});

app.post('/api/students', authenticateToken, requireRole('admin'), async (req, res) => {
  const { name, email, course, deadline, loginUrl, tariff } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  if (!cleanName || !cleanEmail) return res.status(400).json({ error: 'Foydalanuvchi ismi va e-maili talab qilinadi.' });

  const originHeader = req.get('origin') || '';
  let studentLoginUrl = (loginUrl && String(loginUrl).trim()) ? String(loginUrl).trim() : '';
  if (!studentLoginUrl) {
    if (originHeader && originHeader.includes(':5175')) {
      studentLoginUrl = originHeader.replace(':5175', ':5174');
    } else {
      studentLoginUrl = `${getPublicOrigin(req)}/student`;
    }
  }
  
  let existing = await db.prisma.user.findUnique({
    where: { email: cleanEmail },
    include: { userCourses: { include: { course: true } } }
  });
  if (!existing) {
    const allUsers = await db.prisma.user.findMany({
      include: { userCourses: { include: { course: true } } }
    });
    existing = allUsers.find(
      u => String(u.email || '').trim().toLowerCase() === cleanEmail && !String(u.email || '').includes('.archived.')
    ) || null;
  }

  if (existing && existing.status === 'Chetlashtirilgan') {
    // Admin wants to add this student again separately. Archive old email.
    await db.prisma.user.update({
      where: { id: existing.id },
      data: { email: `${existing.email}.archived.${Date.now()}` }
    });
    existing = null;
  }

  // If student already exists — add a new course access
  if (existing) {
    if (existing.role !== 'student') {
      return res.status(400).json({ error: 'Bu email admin akkauntiga tegishli.' });
    }

    // Find the course by title (case-insensitive) or auto-create to avoid blocking
    let targetCourse = await db.prisma.course.findFirst({
      where: {
        title: { equals: course, mode: 'insensitive' }
      }
    });
    if (!targetCourse && course) {
      targetCourse = await db.prisma.course.create({
        data: {
          title: course,
          category: 'Speaking Course',
          instructor: 'Musurmon Qahharov',
          price: '1200000',
          image: 'https://cdn.jsdelivr.net/gh/Kakhkharov/LMS-platform-for-speaking-course@main/image/course_default_cover.jpg',
          description: `${course} bo'yicha to'liq ta'lim dasturi.`
        }
      });
    }

    const courseTitle = targetCourse ? targetCourse.title : (course || 'Yangi kurs');

    // Check if already enrolled in this course
    const alreadyEnrolled = targetCourse && existing.userCourses.some(uc => uc.course.id === targetCourse.id);
    
    if (alreadyEnrolled) {
      if (deadline || existing.status === 'Chetlashtirilgan' || tariff) {
        await db.prisma.user.update({
          where: { id: existing.id },
          data: { 
            status: 'Online', 
            deadline: deadline ? new Date(deadline) : existing.deadline 
          }
        });
        let updatedTariff = getStudentTariff(existing.id);
        if (tariff) {
          updatedTariff = setStudentTariff(existing.id, tariff);
          broadcastToDashboard('student_tariff_update', { userId: existing.id, tariff: updatedTariff });
        }
        return res.status(200).json({ newCourseAdded: true, tariff: updatedTariff, message: `${existing.name} ning "${courseTitle}" kursi uchun muddati, tarifi va holati yangilandi (Aktivlashtirildi).` });
      } else {
        return res.status(400).json({ error: `${existing.name} allaqachon "${courseTitle}" kursiga yozilgan.` });
      }
    }

    // Grant new course access
    if (targetCourse) {
      await db.prisma.userCourse.create({
        data: { userId: existing.id, courseId: targetCourse.id }
      });
    }

    await db.prisma.user.update({
      where: { id: existing.id },
      data: { 
        status: 'Online', 
        course: courseTitle,
        ...(deadline && { deadline: new Date(deadline) }) 
      }
    });

    // Add notification
    const addedDateStr = new Date().toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await db.prisma.notification.create({
      data: {
        userId: existing.id,
        title: "Yangi kursga qo'shildingiz",
        message: `Siz ${addedDateStr} sanasida "${courseTitle}" kursiga muvaffaqiyatli qo'shildingiz.`
      }
    });

    db.logSecurityIncident({ type: 'COURSE_ACCESS_GRANTED', severity: 'LOW', message: `${email} ga "${courseTitle}" kursi tayinlandi`, ip: req.ip });
    broadcastToDashboard('sec_log', { type: 'COURSE_ACCESS_GRANTED', severity: 'LOW', message: `${existing.name} → ${courseTitle}`, ip: req.ip });

    let updatedTariff = getStudentTariff(existing.id);
    if (tariff) {
      updatedTariff = setStudentTariff(existing.id, tariff);
      broadcastToDashboard('student_tariff_update', { userId: existing.id, tariff: updatedTariff });
    }
    broadcastToDashboard('progress_update', { source: 'student_course_granted', userId: existing.id, course: courseTitle });

    // Send course assigned email notification to student
    let courseMailRes = null;
    try {
      courseMailRes = await sendCourseAssignedNotification(cleanEmail, existing.name, courseTitle, studentLoginUrl, {
        tariff: updatedTariff
      });
    } catch (mailErr) {
      console.error('[STUDENT] Kurs biriktirilganligi haqida xat yuborishda xatolik:', mailErr);
    }

    // Fetch updated user with courses
    const updatedUser = await db.prisma.user.findUnique({
      where: { id: existing.id },
      include: { userCourses: { include: { course: true } } }
    });

    return res.status(200).json({
      student: {
        id: updatedUser.id, name: updatedUser.name, email: updatedUser.email,
        course: updatedUser.userCourses.map(uc => uc.course.title).join(', '),
        courses: updatedUser.userCourses.map(uc => ({ id: uc.course.id, title: uc.course.title })),
        tariff: updatedTariff,
        status: updatedUser.status, avatar: updatedUser.avatar, deadline: updatedUser.deadline
      },
      newCourseAdded: true,
      addedCourse: courseTitle,
      emailSent: Boolean(courseMailRes?.sent),
      message: `${existing.name} ga "${courseTitle}" kursi muvaffaqiyatli tayinlandi va pochtasiga xabar yuborildi!`
    });
  }

  // New student creation with one-time password ("bir martalik parol")
  const oneTimePassword = `PR-${crypto.randomInt(100000, 999999)}`;
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(oneTimePassword, salt);

  // Auto-find or create target course in DB
  let targetCourse = null;
  if (course) {
    targetCourse = await db.prisma.course.findFirst({
      where: {
        title: { equals: course, mode: 'insensitive' }
      }
    });
    if (!targetCourse) {
      targetCourse = await db.prisma.course.create({
        data: {
          title: course,
          category: 'Speaking Course',
          instructor: 'Musurmon Qahharov',
          price: '1200000',
          image: 'https://cdn.jsdelivr.net/gh/Kakhkharov/LMS-platform-for-speaking-course@main/image/course_default_cover.jpg',
          description: `${course} bo'yicha to'liq ta'lim dasturi.`
        }
      });
    }
  }

  const assignedCourseTitle = targetCourse ? targetCourse.title : (course || 'Kurs tayinlanmagan');

  const saved = await db.prisma.user.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      role: 'student',
      course: assignedCourseTitle,
      status: 'Online',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=256&auto=format&fit=crop',
      deadline: deadline ? new Date(deadline) : null
    }
  });

  const resolvedTariff = setStudentTariff(saved.id, tariff || 'VIP');

  // Auto-assign course via UserCourse table
  if (targetCourse) {
    await db.prisma.userCourse.create({
      data: { userId: saved.id, courseId: targetCourse.id }
    });

    const addedDateStr = new Date().toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await db.prisma.notification.create({
      data: {
        userId: saved.id,
        title: "Platformaga xush kelibsiz",
        message: `Siz ${addedDateStr} sanasida "${targetCourse.title}" kursiga muvaffaqiyatli qo'shildingiz.`
      }
    });
  }

  // Record one-time password status so first login guides student to set personal password
  try {
    const dbDataOtp = readLandingDB();
    if (!dbDataOtp.oneTimePasswordUsers || typeof dbDataOtp.oneTimePasswordUsers !== 'object') {
      dbDataOtp.oneTimePasswordUsers = {};
    }
    dbDataOtp.oneTimePasswordUsers[saved.id] = {
      active: true,
      issuedAt: new Date().toISOString(),
      loginUrl: studentLoginUrl
    };
    writeLandingDB(dbDataOtp);
  } catch (otpStoreErr) {
    console.error('OTP flag save error:', otpStoreErr);
  }

  // Send Gmail email with banner_02.png at top + login link + tariff + one-time password
  let mailRes = null;
  try {
    mailRes = await sendStudentCredentials(cleanEmail, cleanName, oneTimePassword, studentLoginUrl, {
      tariff: resolvedTariff,
      course: assignedCourseTitle
    });
  } catch (mErr) {
    console.error('[STUDENT] Email yuborishda xatolik:', mErr);
  }

  db.logSecurityIncident({ type: 'STUDENT_CREATED_BY_ADMIN', severity: 'LOW', message: `Admin qo'shdi (${resolvedTariff}): ${cleanEmail}`, ip: req.ip });
  broadcastToDashboard('sec_log', { type: 'STUDENT_CREATED', severity: 'LOW', message: `Yangi o'quvchi (${resolvedTariff}): ${cleanEmail}`, ip: req.ip });
  broadcastToDashboard('progress_update', { source: 'student_created', userId: saved.id });

  res.status(201).json({
    student: {
      id: saved.id, name: saved.name, email: saved.email,
      course: saved.course,
      courses: targetCourse ? [{ id: targetCourse.id, title: targetCourse.title }] : [],
      tariff: resolvedTariff,
      status: saved.status, avatar: saved.avatar
    },
    tariff: resolvedTariff,
    password: oneTimePassword,
    oneTimePassword,
    isOneTimePassword: true,
    loginUrl: studentLoginUrl,
    emailSent: Boolean(mailRes?.sent),
    bannerAttached: Boolean(mailRes?.bannerAttached),
    mailError: mailRes?.error || null
  });
});

app.post('/api/students/resend-mail', authenticateToken, requireRole('admin'), async (req, res) => {
  const { email, name, tariff, password, loginUrl } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return res.status(400).json({ error: 'Email manzil talab qilinadi.' });

  const effectivePassword = password ? String(password).trim() : `PR-${crypto.randomInt(100000, 999999)}`;
  const studentLoginUrl = (loginUrl && String(loginUrl).trim()) ? String(loginUrl).trim() : `${getPublicOrigin(req)}/student`;

  // Always find student in DB and synchronize password in DB
  const user = await db.prisma.user.findFirst({
    where: {
      email: { equals: cleanEmail, mode: 'insensitive' }
    },
    include: {
      userCourses: { include: { course: true } }
    }
  });

  if (user) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(effectivePassword, salt);
    await db.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        status: 'Online'
      }
    });

    try {
      const dbDataOtp = readLandingDB();
      if (!dbDataOtp.oneTimePasswordUsers) dbDataOtp.oneTimePasswordUsers = {};
      dbDataOtp.oneTimePasswordUsers[user.id] = {
        active: true,
        issuedAt: new Date().toISOString(),
        loginUrl: studentLoginUrl
      };
      writeLandingDB(dbDataOtp);
    } catch (_) {}
  }

  const assignedCourse = user?.userCourses?.[0]?.course?.title || user?.course || 'IELTS Speaking Masterclass';
  const resolvedTariff = tariff || (user ? getStudentTariff(user.id) : 'VIP');

  const mailRes = await sendStudentCredentials(cleanEmail, (user ? user.name : name) || 'Talaba', effectivePassword, studentLoginUrl, {
    tariff: resolvedTariff,
    course: assignedCourse
  });

  res.json({
    sent: Boolean(mailRes?.sent),
    password: effectivePassword,
    userUpdated: Boolean(user),
    error: mailRes?.error || null
  });
});

app.post('/api/students/bulk-resend-passwords', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { emails = [], filterCourse = 'IELTS Speaking Masterclass', tariff = 'VIP' } = req.body;

    let students = await db.prisma.user.findMany({
      where: { role: 'student' },
      include: { userCourses: { include: { course: true } } }
    });

    if (Array.isArray(emails) && emails.length > 0) {
      const cleanList = emails.map(e => String(e).trim().toLowerCase());
      students = students.filter(s => {
        const cleanE = String(s.email || '').replace(/\.archived\.\d+/, '').trim().toLowerCase();
        return cleanList.includes(cleanE);
      });
    } else {
      students = students.filter(s => !String(s.email || '').includes('.archived'));
    }

    const results = [];
    const studentLoginUrl = `${getPublicOrigin(req)}/student`;

    const dbDataOtp = readLandingDB();
    if (!dbDataOtp.oneTimePasswordUsers) dbDataOtp.oneTimePasswordUsers = {};

    for (const std of students) {
      const cleanEmail = String(std.email || '').replace(/\.archived\.\d+/, '').trim();
      const oneTimePassword = `PR-${crypto.randomInt(100000, 999999)}`;
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(oneTimePassword, salt);

      await db.prisma.user.update({
        where: { id: std.id },
        data: {
          password: hashedPassword,
          status: 'Online'
        }
      });

      dbDataOtp.oneTimePasswordUsers[std.id] = {
        active: true,
        issuedAt: new Date().toISOString(),
        loginUrl: studentLoginUrl
      };

      const courseTitle = std.userCourses?.[0]?.course?.title || std.course || filterCourse;
      const studentTariff = tariff || getStudentTariff(std.id) || 'VIP';

      let mailRes = { sent: false };
      try {
        mailRes = await sendStudentCredentials(cleanEmail, std.name, oneTimePassword, studentLoginUrl, {
          tariff: studentTariff,
          course: courseTitle
        });
      } catch (err) {
        mailRes = { sent: false, error: err.message };
      }

      results.push({
        id: std.id,
        name: std.name,
        email: cleanEmail,
        password: oneTimePassword,
        emailSent: Boolean(mailRes?.sent),
        error: mailRes?.error || null
      });

      await new Promise(r => setTimeout(r, 600));
    }

    writeLandingDB(dbDataOtp);

    res.json({
      success: true,
      total: results.length,
      sentCount: results.filter(r => r.emailSent).length,
      results
    });
  } catch (err) {
    console.error('bulk-resend-passwords error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/smtp-check', async (req, res) => {
  const net = require('net');
  const results = { timestamp: new Date().toISOString() };
  
  const testTcp = (host, port, family = 4) => new Promise(resolve => {
    const s = net.createConnection({ host, port, family, timeout: 3500 });
    s.on('connect', () => { s.destroy(); resolve({ open: true }); });
    s.on('timeout', () => { s.destroy(); resolve({ open: false, error: 'TIMEOUT' }); });
    s.on('error', (e) => { resolve({ open: false, error: e.message }); });
  });

  results['smtp_gmail_465_ipv4'] = await testTcp('smtp.gmail.com', 465, 4);
  results['smtp_gmail_587_ipv4'] = await testTcp('smtp.gmail.com', 587, 4);

  try {
    await transporter.verify();
    results['transporter_verify'] = { ok: true };
  } catch (ve) {
    results['transporter_verify'] = { ok: false, error: ve.message };
  }

  res.json(results);
});

app.post('/api/auth/forgot-password', authRateLimiter, async (req, res) => {
  const { email, resetUrl, loginUrl } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return res.status(400).json({ error: 'Email manzilini kiriting.' });

  const allUsers = await db.prisma.user.findMany();
  const user = allUsers.find(
    (u) =>
      String(u.email || '').trim().toLowerCase() === cleanEmail &&
      !String(u.email || '').includes('.archived.') &&
      u.role !== 'revoked'
  ) || null;

  if (!user) {
    return res.status(404).json({ error: "Ushbu Gmail manzili tizimda ro'yxatdan o'tmagan." });
  }
  if (user.status === 'Chetlashtirilgan') {
    return res.status(403).json({ error: "Siz tizimdan chetlashtirilgansiz. Parolni tiklash mumkin emas." });
  }
  if (user.role !== 'student') {
    return res.status(403).json({ error: "Ushbu bo'lim faqat talabalar uchun. Admin parolini tizim sozlamalaridan yangilang." });
  }

  // Synchronously generate a new login password for Gmail delivery & update DB (with atomic rollback on SMTP failure)
  const newLoginPassword = `PR-${crypto.randomInt(100000, 999999)}`;
  const prevPasswordHash = user.password;
  let prevOtpEntry = null;
  try {
    const snapDb = readLandingDB();
    if (snapDb?.oneTimePasswordUsers?.[String(user.id)]) {
      prevOtpEntry = { ...snapDb.oneTimePasswordUsers[String(user.id)] };
    }
  } catch (e) {}

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(newLoginPassword, salt);
  await db.prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });
  clearUserOneTimePassword(user.id);

  const resetId = uuidv4();
  const expiresInMs = 24 * 60 * 60 * 1000; // 24 soat
  const resetToken = jwt.sign(
    { id: user.id, resetId, purpose: 'password_reset' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Also store optional self-service reset token so the secondary link inside the email remains functional
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.passwordResetTokens)) dbData.passwordResetTokens = [];
    const nowMs = Date.now();
    dbData.passwordResetTokens = dbData.passwordResetTokens
      .filter(t => t && new Date(t.expiresAt).getTime() > nowMs && t.userId !== user.id)
      .slice(-100);
    dbData.passwordResetTokens.push({
      resetId,
      token: resetToken,
      userId: user.id,
      email: user.email,
      used: false,
      expiresAt: new Date(nowMs + expiresInMs).toISOString(),
      createdAt: new Date(nowMs).toISOString()
    });
    writeLandingDB(dbData);
  } catch (storeErr) {
    console.error('Reset token store error:', storeErr);
  }

  const originHeader = req.get('origin') || '';
  let studentLoginUrl = (loginUrl && String(loginUrl).trim()) ? String(loginUrl).trim() : '';
  if (!studentLoginUrl) {
    if (resetUrl && String(resetUrl).trim()) {
      studentLoginUrl = String(resetUrl).trim().replace(/\/reset-password.*$/i, '') || `${getPublicOrigin(req)}/student`;
    } else if (originHeader && originHeader.includes(':5174')) {
      studentLoginUrl = originHeader;
    } else {
      studentLoginUrl = `${getPublicOrigin(req)}/student`;
    }
  }

  const rawBaseUrl = (resetUrl && String(resetUrl).trim())
    ? String(resetUrl).trim()
    : `${studentLoginUrl.replace(/\/+$/, '')}/reset-password`;
  let resetLink = '';
  try {
    const u = new URL(rawBaseUrl);
    u.searchParams.set('token', resetToken);
    resetLink = u.toString();
  } catch (e) {
    resetLink = `${rawBaseUrl}${rawBaseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(resetToken)}`;
  }

  const mailRes = await sendPasswordReset(user.email, user.name, resetLink, newLoginPassword, studentLoginUrl);

  if (!mailRes?.sent) {
    // Atomic rollback so student's previous working password stays valid if email wasn't delivered
    try {
      await db.prisma.user.update({
        where: { id: user.id },
        data: { password: prevPasswordHash }
      });
      const rollbackDb = readLandingDB();
      if (!rollbackDb.oneTimePasswordUsers || typeof rollbackDb.oneTimePasswordUsers !== 'object') {
        rollbackDb.oneTimePasswordUsers = {};
      }
      if (prevOtpEntry) {
        rollbackDb.oneTimePasswordUsers[String(user.id)] = prevOtpEntry;
      } else {
        delete rollbackDb.oneTimePasswordUsers[String(user.id)];
      }
      if (Array.isArray(rollbackDb.passwordResetTokens)) {
        rollbackDb.passwordResetTokens = rollbackDb.passwordResetTokens.filter(t => t && t.resetId !== resetId);
      }
      writeLandingDB(rollbackDb);
    } catch (rollbackErr) {
      console.error('Forgot password rollback error:', rollbackErr);
    }
    return res.status(500).json({
      error: mailRes?.error
        ? `Gmail pochtasiga xat yuborib bo'lmadi: ${mailRes.error}`
        : "Gmail pochtasiga xat yuborib bo'lmadi. Keyinroq qayta urinib ko'ring."
    });
  }

  try {
    db.logSecurityIncident({ type: 'PASSWORD_RESET_EMAIL_SENT', severity: 'LOW', message: `Yangi kirish paroli Gmailga yuborildi (Practise): ${user.email}`, ip: req.ip });
  } catch (logErr) {}
  res.json({
    success: true,
    emailSent: true,
    email: user.email,
    bannerAttached: Boolean(mailRes?.bannerAttached),
    message: "Kirish uchun yangi parolingiz ro'yxatdan o'tgan Gmail pochtangizga yuborildi! Emaildagi yangi parol bilan tizimga kirishingiz mumkin."
  });
});

app.post('/api/auth/reset-password', authRateLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  const rawPassword = typeof newPassword === 'string' ? newPassword : String(newPassword || '');
  if (!token || !rawPassword) {
    return res.status(400).json({ error: 'Token va yangi parol talab qilinadi.' });
  }
  if (rawPassword.length < 4) {
    return res.status(400).json({ error: 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak.' });
  }

  let cleanToken = String(token).trim();
  if (cleanToken.includes('%')) {
    try {
      const dec = decodeURIComponent(cleanToken);
      if (dec) cleanToken = dec;
    } catch (e) {}
  }

  let targetUserId = null;
  let matchedResetId = null;
  let jwtExpired = false;

  try {
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    if (decoded?.id) {
      targetUserId = decoded.id;
      matchedResetId = decoded.resetId || null;
    }
  } catch (jwtErr) {
    if (jwtErr && jwtErr.name === 'TokenExpiredError') {
      jwtExpired = true;
    }
  }

  const dbData = readLandingDB();
  if (!Array.isArray(dbData.passwordResetTokens)) dbData.passwordResetTokens = [];
  const storedRecord = dbData.passwordResetTokens.find(
    (item) => (item.token === cleanToken || (matchedResetId && item.resetId === matchedResetId))
  );

  if (storedRecord) {
    if (storedRecord.used) {
      return res.status(400).json({ error: 'Ushbu parolni tiklash havolasi allaqachon ishlatilgan. Qaytadan so\'rov yuboring.' });
    }
    if (new Date(storedRecord.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Havola muddati tugagan. Iltimos, qaytadan tiklash so\'rovi yuboring.' });
    }
    if (!targetUserId) {
      targetUserId = storedRecord.userId;
    }
  } else if (!targetUserId) {
    return res.status(400).json({
      error: jwtExpired
        ? 'Havola muddati tugagan. Iltimos, qaytadan tiklash so\'rovi yuboring.'
        : 'Havola muddati o\'tgan yoki noto\'g\'ri.'
    });
  }

  try {
    const existingUser = await db.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existingUser) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(rawPassword, salt);

    await db.prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashedPassword }
    });
    clearUserOneTimePassword(targetUserId);

    if (storedRecord) {
      storedRecord.used = true;
      storedRecord.usedAt = new Date().toISOString();
      writeLandingDB(dbData);
    }

    try {
      db.logSecurityIncident({ type: 'PASSWORD_RESET_SUCCESS', severity: 'MEDIUM', message: `Parol tiklandi: ID=${targetUserId}`, ip: req.ip });
    } catch (logErr) {}

    res.json({
      success: true,
      message: 'Parolingiz muvaffaqiyatli o\'zgartirildi! Endi yangi parolingiz bilan tizimga kirishingiz mumkin.'
    });
  } catch (err) {
    console.error('Reset password update error:', err);
    res.status(500).json({ error: 'Parolni yangilashda server xatoligi yuz berdi. Qayta urinib ko\'ring.' });
  }
});

app.delete('/api/students/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'Chetlashtirilgan' }
    });
    broadcastToDashboard('progress_update', { source: 'student_deleted', userId: req.params.id });
    res.json({ message: 'Talaba tizimdan chetlashtirildi.' });
  } catch (error) {
    res.status(404).json({ error: 'Talaba topilmadi.' });
  }
});

app.put('/api/students/:id/tariff', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const user = await db.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== 'student') {
      return res.status(404).json({ error: 'Talaba topilmadi.' });
    }
    const savedTariff = setStudentTariff(user.id, req.body?.tariff);
    broadcastToDashboard('student_tariff_update', { userId: user.id, tariff: savedTariff });
    broadcastToDashboard('progress_update', { source: 'student_tariff_updated', userId: user.id, tariff: savedTariff });
    res.json({ success: true, userId: user.id, tariff: savedTariff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ADMIN ACTIVITY LOGS (KIRISH / CHIQISH) ====================
app.get('/api/admin/activity-logs', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const dbData = readLandingDB();
    const logs = Array.isArray(dbData.adminActivityLogs) ? dbData.adminActivityLogs : [];
    res.json(logs.slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ADMIN PANEL SETTINGS ====================
const DEFAULT_ADMIN_PANEL_SETTINGS = {
  brandName: 'Practise Academy',
  primaryColor: "Ko'k (Royal Indigo)",
  supabaseKey: 'sb_proj_key_mathscore_18972412',
  vimeoToken: ''
};

app.get('/api/admin/settings', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const dbData = readLandingDB();
    const saved = (dbData.adminPanelSettings && typeof dbData.adminPanelSettings === 'object')
      ? dbData.adminPanelSettings
      : {};
    const merged = { ...DEFAULT_ADMIN_PANEL_SETTINGS, ...saved };
    if (merged.primaryColor === 'Kök (Royal Indigo)') {
      merged.primaryColor = "Ko'k (Royal Indigo)";
    }
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const dbData = readLandingDB();
    const existing = (dbData.adminPanelSettings && typeof dbData.adminPanelSettings === 'object')
      ? dbData.adminPanelSettings
      : {};
    const { brandName, primaryColor, supabaseKey, vimeoToken } = req.body || {};
    const next = {
      ...DEFAULT_ADMIN_PANEL_SETTINGS,
      ...existing
    };
    if (brandName !== undefined && String(brandName).trim()) {
      next.brandName = String(brandName).trim().slice(0, 80);
    }
    if (primaryColor !== undefined && String(primaryColor).trim()) {
      next.primaryColor = String(primaryColor).trim() === 'Kök (Royal Indigo)'
        ? "Ko'k (Royal Indigo)"
        : String(primaryColor).trim();
    }
    if (supabaseKey !== undefined) {
      next.supabaseKey = String(supabaseKey).trim();
    }
    if (vimeoToken !== undefined) {
      next.vimeoToken = String(vimeoToken).trim();
    }
    dbData.adminPanelSettings = next;
    writeLandingDB(dbData);
    broadcastToDashboard('admin_settings_update', next);
    res.json({ success: true, settings: next });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SUPPORT ADMINS MANAGEMENT ====================
app.get('/api/support-admins', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const dbData = readLandingDB();
    const metaMap = (dbData.supportAdmins && typeof dbData.supportAdmins === 'object') ? dbData.supportAdmins : {};
    const admins = await db.prisma.user.findMany({
      where: { role: 'admin' },
      orderBy: { createdAt: 'desc' }
    });
    const supportItems = admins
      .filter(u => !isPrimaryAdminEmail(u.email) && u.status !== 'Chetlashtirilgan')
      .map(u => {
        const meta = metaMap[String(u.id)] || {};
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || meta.phone || '',
          avatar: u.avatar,
          plainPassword: meta.plainPassword || '',
          addedBy: meta.addedBy || '',
          createdAt: meta.createdAt || u.createdAt
        };
      });
    res.json({
      canManage: isPrimaryAdminEmail(req.user.email),
      currentAdminType: getAdminType(req.user.email),
      items: supportItems
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/support-admins', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    if (!isPrimaryAdminEmail(req.user.email)) {
      return res.status(403).json({ error: "Faqat asosiy admin yordamchi admin qo'sha oladi." });
    }
    const { name, email, phone, password } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanPassword = typeof password === 'string' ? password : String(password || '');

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return res.status(400).json({ error: "Ism familiya, Gmail pochta va kirish paroli kiritilishi shart." });
    }
    if (cleanPassword.length < 4) {
      return res.status(400).json({ error: "Kirish paroli kamida 4 ta belgidan iborat bo'lishi kerak." });
    }
    if (isPrimaryAdminEmail(cleanEmail)) {
      return res.status(400).json({ error: "Bu pochta asosiy adminga tegishli." });
    }

    const allUsers = await db.prisma.user.findMany({ select: { id: true, email: true } });
    if (allUsers.some(u => String(u.email || '').trim().toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: "Ushbu pochta allaqachon tizimda ro'yxatdan o'tgan." });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    const created = await db.prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || null,
        password: hashedPassword,
        role: 'admin',
        status: 'Online',
        avatar: ''
      }
    });

    const createdAtIso = new Date().toISOString();
    const dbData = readLandingDB();
    if (!dbData.supportAdmins || typeof dbData.supportAdmins !== 'object') {
      dbData.supportAdmins = {};
    }
    dbData.supportAdmins[String(created.id)] = {
      plainPassword: cleanPassword,
      phone: cleanPhone || '',
      addedBy: req.user.email,
      createdAt: createdAtIso
    };
    writeLandingDB(dbData);

    res.status(201).json({
      success: true,
      item: {
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone || '',
        avatar: created.avatar,
        plainPassword: cleanPassword,
        addedBy: req.user.email,
        createdAt: createdAtIso
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/support-admins/:id/password', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    if (!isPrimaryAdminEmail(req.user.email)) {
      return res.status(403).json({ error: "Faqat asosiy admin yordamchi admin parolini o'zgartira oladi." });
    }
    const target = await db.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target || target.role !== 'admin' || isPrimaryAdminEmail(target.email)) {
      return res.status(404).json({ error: "Yordamchi admin topilmadi." });
    }

    const rawPassword = typeof req.body?.newPassword === 'string'
      ? req.body.newPassword
      : String(req.body?.password || req.body?.newPassword || '');
    if (rawPassword.length < 4) {
      return res.status(400).json({ error: "Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak." });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    await db.prisma.user.update({
      where: { id: target.id },
      data: { password: hashedPassword }
    });

    const dbData = readLandingDB();
    if (!dbData.supportAdmins || typeof dbData.supportAdmins !== 'object') {
      dbData.supportAdmins = {};
    }
    dbData.supportAdmins[String(target.id)] = {
      ...(dbData.supportAdmins[String(target.id)] || {}),
      plainPassword: rawPassword,
      passwordUpdatedAt: new Date().toISOString()
    };
    writeLandingDB(dbData);

    res.json({ success: true, id: target.id, plainPassword: rawPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/support-admins/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    if (!isPrimaryAdminEmail(req.user.email)) {
      return res.status(403).json({ error: "Faqat asosiy admin yordamchi adminni chetlatishi mumkin." });
    }
    const target = await db.prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      return res.status(404).json({ error: "Yordamchi admin topilmadi." });
    }
    if (isPrimaryAdminEmail(target.email)) {
      return res.status(403).json({ error: "Asosiy adminni adminlikdan chetlatib bo'lmaydi!" });
    }

    await db.prisma.user.update({
      where: { id: target.id },
      data: {
        role: 'revoked',
        status: 'Chetlashtirilgan',
        email: `${target.email}.revoked.${Date.now()}`
      }
    });

    const dbData = readLandingDB();
    if (dbData.supportAdmins && dbData.supportAdmins[String(target.id)]) {
      delete dbData.supportAdmins[String(target.id)];
      writeLandingDB(dbData);
    }

    res.json({ success: true, message: "Yordamchi admin adminlikdan chetlatildi." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SUPPORT CHATS (ADMIN <-> INDIVIDUAL STUDENT) ====================
const decodeChatEntities = (str) => {
  if (!str || typeof str !== 'string') return '';
  let out = str;
  for (let i = 0; i < 2; i++) {
    const prev = out;
    out = out
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    if (prev === out) break;
  }
  return out;
};

app.get('/api/support-chats/my', authenticateToken, async (req, res) => {
  try {
    const sid = String(req.user.id);
    const dbData = readLandingDB();
    if (!dbData.supportChats || typeof dbData.supportChats !== 'object') {
      dbData.supportChats = {};
    }

    const azizbek = await getPrimaryAzizbekProfile();
    let changed = false;

    if (!dbData.supportChats[sid]) {
      dbData.supportChats[sid] = {
        studentId: sid,
        unreadByAdmin: 0,
        unreadByStudent: 1,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: `greet_${sid}`,
            senderRole: 'admin',
            senderId: azizbek.id || 'primary_admin',
            senderName: 'Azizbek',
            senderAvatar: azizbek.avatar || '',
            type: 'text',
            text: 'Assalomu alaykum! Men Azizbekman. Sizga qanday yordam bera olaman?',
            audioUrl: null,
            duration: null,
            createdAt: new Date().toISOString()
          }
        ]
      };
      changed = true;
    }

    const thread = dbData.supportChats[sid];
    if (req.query.markRead === '1' && thread.unreadByStudent > 0) {
      thread.unreadByStudent = 0;
      changed = true;
    }
    if (changed) {
      writeLandingDB(dbData);
    }

    const hydratedMessages = (thread.messages || []).map(m => {
      const decodedText = decodeChatEntities(m.text);
      if (m.senderRole === 'admin') {
        return {
          ...m,
          text: decodedText,
          senderAvatar: m.senderId === azizbek.id || !m.senderAvatar ? (azizbek.avatar || m.senderAvatar || '') : m.senderAvatar
        };
      }
      return {
        ...m,
        text: decodedText
      };
    });

    res.json({
      studentId: sid,
      unreadByStudent: thread.unreadByStudent || 0,
      unreadByAdmin: thread.unreadByAdmin || 0,
      updatedAt: thread.updatedAt,
      adminName: azizbek.name || 'Azizbek',
      adminAvatar: azizbek.avatar || '',
      messages: hydratedMessages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/support-chats/my/messages', authenticateToken, async (req, res) => {
  try {
    const cleanText = decodeChatEntities(String(req.body?.text || '')).trim();
    if (!cleanText) {
      return res.status(400).json({ error: "Xabar matnini kiriting." });
    }
    const sid = String(req.user.id);
    const dbData = readLandingDB();
    if (!dbData.supportChats || typeof dbData.supportChats !== 'object') {
      dbData.supportChats = {};
    }

    const azizbek = await getPrimaryAzizbekProfile();
    if (!dbData.supportChats[sid]) {
      dbData.supportChats[sid] = {
        studentId: sid,
        unreadByAdmin: 0,
        unreadByStudent: 0,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: `greet_${sid}`,
            senderRole: 'admin',
            senderId: azizbek.id || 'primary_admin',
            senderName: 'Azizbek',
            senderAvatar: azizbek.avatar || '',
            type: 'text',
            text: 'Assalomu alaykum! Men Azizbekman. Sizga qanday yordam bera olaman?',
            audioUrl: null,
            duration: null,
            createdAt: new Date().toISOString()
          }
        ]
      };
    }

    const thread = dbData.supportChats[sid];
    const nowIso = new Date().toISOString();
    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderRole: 'student',
      senderId: sid,
      senderName: req.user.name || 'Talaba',
      senderAvatar: req.user.avatar || '',
      type: 'text',
      text: cleanText.slice(0, 2000),
      audioUrl: null,
      duration: null,
      createdAt: nowIso
    };

    if (!Array.isArray(thread.messages)) thread.messages = [];
    thread.messages.push(newMsg);
    thread.unreadByAdmin = (thread.unreadByAdmin || 0) + 1;
    thread.unreadByStudent = 0;
    thread.updatedAt = nowIso;
    writeLandingDB(dbData);

    broadcastToDashboard('support_chat_update', {
      studentId: sid,
      studentName: req.user.name,
      from: 'student',
      message: newMsg
    });

    res.status(201).json({ success: true, message: newMsg, thread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/support-chats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const dbData = readLandingDB();
    const chatsObj = (dbData.supportChats && typeof dbData.supportChats === 'object') ? dbData.supportChats : {};
    const students = await db.prisma.user.findMany({
      where: { role: 'student' },
      include: { userCourses: { include: { course: true } } }
    });
    const studentMap = new Map(students.map(s => [String(s.id), s]));
    const azizbek = await getPrimaryAzizbekProfile();

    const list = Object.values(chatsObj)
      .filter(th => th && Array.isArray(th.messages) && th.messages.some(m => m.senderRole === 'student'))
      .map(th => {
        const stu = studentMap.get(String(th.studentId));
        const messages = (th.messages || []).map(m => {
          const decoded = decodeChatEntities(m.text);
          return m.senderRole === 'admin'
            ? { ...m, text: decoded, senderAvatar: m.senderAvatar || azizbek.avatar || '' }
            : { ...m, text: decoded };
        });
        const lastMsg = messages[messages.length - 1] || null;
        return {
          studentId: th.studentId,
          studentName: stu?.name || (messages.find(m => m.senderRole === 'student')?.senderName) || 'Talaba',
          studentEmail: stu?.email || '',
          studentPhone: stu?.phone || '',
          studentAvatar: stu?.avatar || '',
          studentCourse: stu?.userCourses?.map(uc => uc.course.title).join(', ') || stu?.course || '',
          studentTariff: stu ? getStudentTariff(stu.id) : 'VIP',
          unreadByAdmin: th.unreadByAdmin || 0,
          unreadByStudent: th.unreadByStudent || 0,
          updatedAt: th.updatedAt || lastMsg?.createdAt || '',
          lastMessage: lastMsg,
          messages
        };
      })
      .sort((a, b) => {
        const unreadDiff = (b.unreadByAdmin > 0 ? 1 : 0) - (a.unreadByAdmin > 0 ? 1 : 0);
        if (unreadDiff !== 0) return unreadDiff;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/support-chats/:studentId/messages', authenticateToken, requireRole('admin'), upload.single('audio'), async (req, res) => {
  try {
    const sid = String(req.params.studentId);
    const dbData = readLandingDB();
    if (!dbData.supportChats || typeof dbData.supportChats !== 'object') {
      dbData.supportChats = {};
    }

    const azizbek = await getPrimaryAzizbekProfile();
    const rawText = decodeChatEntities(String(req.body?.text || '').replace(/[<>]/g, '')).trim();
    let audioUrl = '';
    if (req.file) {
      audioUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    if (!rawText && !audioUrl) {
      return res.status(400).json({ error: "Xabar matni yoki audio yozuv yuborilishi kerak." });
    }

    if (!dbData.supportChats[sid]) {
      dbData.supportChats[sid] = {
        studentId: sid,
        unreadByAdmin: 0,
        unreadByStudent: 0,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: `greet_${sid}`,
            senderRole: 'admin',
            senderId: azizbek.id || 'primary_admin',
            senderName: 'Azizbek',
            senderAvatar: azizbek.avatar || '',
            type: 'text',
            text: 'Assalomu alaykum! Men Azizbekman. Sizga qanday yordam bera olaman?',
            audioUrl: null,
            duration: null,
            createdAt: new Date().toISOString()
          }
        ]
      };
    }

    const thread = dbData.supportChats[sid];
    const nowIso = new Date().toISOString();
    const isAudio = Boolean(audioUrl);
    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderRole: 'admin',
      senderId: req.user.id,
      senderName: req.user.name || azizbek.name || 'Azizbek',
      senderAvatar: req.user.avatar || azizbek.avatar || '',
      type: isAudio ? 'audio' : 'text',
      text: isAudio ? '' : rawText.slice(0, 2000),
      audioUrl: isAudio ? audioUrl : null,
      duration: isAudio ? String(req.body?.duration || '0:05').slice(0, 16) : null,
      createdAt: nowIso
    };

    if (!Array.isArray(thread.messages)) thread.messages = [];
    thread.messages.push(newMsg);
    thread.unreadByAdmin = 0;
    thread.unreadByStudent = (thread.unreadByStudent || 0) + 1;
    thread.updatedAt = nowIso;
    writeLandingDB(dbData);

    broadcastToDashboard('support_chat_update', {
      studentId: sid,
      from: 'admin',
      message: newMsg
    });

    res.status(201).json({ success: true, message: newMsg, thread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/support-chats/:studentId/read', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const sid = String(req.params.studentId);
    const dbData = readLandingDB();
    if (dbData.supportChats?.[sid]) {
      dbData.supportChats[sid].unreadByAdmin = 0;
      writeLandingDB(dbData);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Courses
app.get('/api/courses', async (req, res) => { res.json(await db.get('courses')); });
app.post('/api/courses', authenticateToken, requireRole('admin'), async (req, res) => {
  const saved = await db.insert('courses', req.body);
  res.status(201).json(saved);
});
app.put('/api/courses/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const updated = await db.update('courses', req.params.id, req.body);
  res.json(updated);
});
app.delete('/api/courses/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const success = await db.delete('courses', req.params.id);
  if (!success) return res.status(404).json({ error: 'Kurs topilmadi yoki xatolik yuz berdi.' });
  broadcastToDashboard('course_deleted', { id: req.params.id });
  res.json({ message: 'Kurs o\'chirildi.' });
});

// Tests
app.get('/api/tests', authenticateToken, async (req, res) => {
  const tests = await db.get('tests');
  if (req.user.role === 'student') {
    const published = tests.filter(t => !t.status || t.status.toLowerCase() === 'published');
    return res.json(published.map(t => {
      const sanitizedQuestions = (t.questions || []).map(q => {
        const { correctAnswer, explanation, ...safeQ } = q;
        return safeQ;
      });
      return { ...t, questions: sanitizedQuestions };
    }));
  }
  res.json(tests);
});

app.get('/api/tests/:id', authenticateToken, async (req, res) => {
  const test = await db.getById('tests', req.params.id);
  if (!test) return res.status(404).json({ error: 'Test topilmadi.' });
  if (req.user.role === 'student') {
    const sanitizedQuestions = (test.questions || []).map(q => {
      const { correctAnswer, explanation, ...safeQ } = q;
      return safeQ;
    });
    return res.json({ ...test, questions: sanitizedQuestions });
  }
  res.json(test);
});

app.post('/api/tests', authenticateToken, requireRole('admin'), async (req, res) => {
  const saved = await db.insert('tests', req.body);
  if (saved && saved.status === 'Published') {
    sendNotificationToCourseStudents(
      saved.course || saved.category,
      "Yangi imtihon testi chop etildi! 🎯",
      `"${saved.title}" imtihon testi chop etildi. Testlar markaziga o'tib topshirishingiz mumkin.`
    );
  }
  res.status(201).json(saved);
});
app.put('/api/tests/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const updated = await db.update('tests', req.params.id, req.body);
  if (updated && updated.status === 'Published') {
    sendNotificationToCourseStudents(
      updated.course || updated.category,
      "Imtihon testi chop etildi! 🎯",
      `"${updated.title}" testi yangilandi va chop etildi. Testlar markaziga o'tib topshirishingiz mumkin.`
    );
  }
  res.json(updated);
});
app.delete('/api/tests/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  await db.delete('tests', req.params.id);
  res.json({ message: 'Test o\'chirildi.' });
});

// Helper to normalize MCQ option index (supports 0, 1, 2, 3 OR "A", "B", "C", "D" OR exact text)
function normalizeOptionIndex(val, options = []) {
  if (val === undefined || val === null || val === '') return -1;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const num = Number(str);
  if (!isNaN(num) && Number.isInteger(num)) return num;
  if (/^[A-Za-z]$/.test(str)) {
    return str.toUpperCase().charCodeAt(0) - 65;
  }
  if (Array.isArray(options) && options.length > 0) {
    const idx = options.findIndex(opt => String(opt).trim().toLowerCase() === str.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

// Submissions
app.post('/api/submissions', authenticateToken, async (req, res) => {
  const { testId, answers, tabSwitches, timeSpent } = req.body;
  const test = await db.getById('tests', testId);
  if (!test) return res.status(404).json({ error: 'Test topilmadi.' });

  let correctCount = 0;
  let totalPossibleScore = 0;
  let earnedScore = 0;
  const questionResults = [];

  const questions = test.questions || [];

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const qScore = Math.max(1, Math.round(Number(q.score) || 1));
    totalPossibleScore += qScore;

    // Student answer can be mapped by question id or by array index
    let studentAns = undefined;
    if (answers) {
      if (answers[idx] !== undefined) {
        studentAns = answers[idx];
      } else if (answers[String(idx)] !== undefined) {
        studentAns = answers[String(idx)];
      } else if (q.id && answers[q.id] !== undefined) {
        studentAns = answers[q.id];
      }
    }

    let isCorrect = false;
    let awardedMarks = 0;
    let feedback = '';
    let aiGrading = null;

    const qType = (q.type || 'single').toLowerCase();
    const options = Array.isArray(q.options) ? q.options : [];

    if (qType === 'single' || qType === 'mcq') {
      const correctIdx = normalizeOptionIndex(q.correctAnswer, options);
      const studentIdx = normalizeOptionIndex(studentAns, options);

      if (studentIdx !== -1 && correctIdx !== -1 && studentIdx === correctIdx) {
        isCorrect = true;
        awardedMarks = qScore;
        feedback = "To'g'ri javob!";
      } else {
        feedback = studentIdx === -1 ? "Javob belgilanmadi." : "Noto'g'ri variant tanlandi.";
      }
    } else if (qType === 'multiple') {
      let correctIndices = [];
      try {
        const rawArr = Array.isArray(q.correctAnswer)
          ? q.correctAnswer
          : JSON.parse(q.correctAnswer || '[]');
        correctIndices = rawArr.map(v => normalizeOptionIndex(v, options)).filter(v => v !== -1);
      } catch (e) {
        correctIndices = [];
      }
      const studentArr = Array.isArray(studentAns)
        ? studentAns.map(v => normalizeOptionIndex(v, options)).filter(v => v !== -1)
        : [];

      const sortedCorrect = [...new Set(correctIndices)].sort((a, b) => a - b);
      const sortedStudent = [...new Set(studentArr)].sort((a, b) => a - b);

      if (
        sortedCorrect.length > 0 &&
        sortedCorrect.length === sortedStudent.length &&
        sortedCorrect.every((val, i) => val === sortedStudent[i])
      ) {
        isCorrect = true;
        awardedMarks = qScore;
        feedback = "Barcha to'g'ri variantlar to'g'ri tanlandi!";
      } else {
        feedback = "To'g'ri variantlar to'liq yoki to'g'ri tanlanmadi.";
      }
    } else if (qType === 'truefalse') {
      let correctBool;
      if (q.hint && q.hint.includes('__TF__:')) {
        correctBool = q.hint.includes('__TF__:true');
      } else {
        correctBool = q.correctAnswer === 0 || q.correctAnswer === true || String(q.correctAnswer).toLowerCase() === 'true' || String(q.correctAnswer).toLowerCase() === 'rost';
      }

      let studentBool;
      if (typeof studentAns === 'boolean') {
        studentBool = studentAns;
      } else if (typeof studentAns === 'string') {
        const s = studentAns.toLowerCase().trim();
        studentBool = s === 'true' || s === 'rost' || s === '0';
      } else if (typeof studentAns === 'number') {
        studentBool = studentAns === 0;
      }
      if (studentBool !== undefined && studentBool === correctBool) {
        isCorrect = true;
        awardedMarks = qScore;
        feedback = "To'g'ri!";
      } else {
        feedback = "Noto'g'ri.";
      }
    } else if (qType === 'short') {
      // Short Answer Question with Gemini AI Semantic Evaluation
      const rawText = String(studentAns !== undefined && studentAns !== null ? studentAns : '').trim();

      if (!rawText) {
        awardedMarks = 0;
        isCorrect = false;
        feedback = "Javob kiritilmadi.";
        aiGrading = {
          grading_status: 'graded',
          awarded_marks: 0,
          maximum_marks: qScore,
          student_feedback: "Javob kiritilmadi.",
          criterion_results: []
        };
      } else {
        // Evaluate with Gemini AI
        try {
          aiGrading = await gradeShortAnswerQuestion({
            questionId: q.id || `q_${idx + 1}`,
            questionText: q.text,
            maximumMarks: qScore,
            studentAnswer: rawText,
            markingScheme: q.markingScheme
          });

          awardedMarks = Number(aiGrading.awarded_marks) || 0;
          if (awardedMarks > qScore) awardedMarks = qScore;
          if (awardedMarks < 0) awardedMarks = 0;

          isCorrect = awardedMarks === qScore;
          feedback = aiGrading.student_feedback || (isCorrect ? "To'liq to'g'ri javob!" : `${awardedMarks}/${qScore} ball`);
        } catch (aiErr) {
          console.error(`[Grading] Gemini grading error on question ${idx + 1}:`, aiErr);
          // Fallback: Check simple model answer match from hint or markingScheme
          let modelAns = '';
          if (q.hint && q.hint.includes('__SHORT__:')) {
            modelAns = q.hint.split('__SHORT__:')[1].split(' | ')[0];
          } else if (q.hint && q.hint.includes('__MATH__:')) {
            modelAns = q.hint.split('__MATH__:')[1].split(' | ')[0];
          } else if (q.markingScheme?.modelAnswer) {
            modelAns = q.markingScheme.modelAnswer;
          } else if (typeof q.correctAnswer === 'string') {
            modelAns = q.correctAnswer;
          }

          const cleanStudent = rawText.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
          const cleanModel = modelAns.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();

          let match = false;
          if (cleanStudent && cleanModel && (cleanStudent === cleanModel || cleanStudent.includes(cleanModel) || cleanModel.includes(cleanStudent))) {
            match = true;
          }
          if (!match && cleanModel) {
            const acronym = cleanModel.split(' ').map(w => w[0]).join('');
            if (acronym.length >= 2 && (cleanStudent === acronym || cleanStudent.includes(acronym))) match = true;
          }

          if (match) {
            awardedMarks = qScore;
            isCorrect = true;
            feedback = "To'g'ri javob!";
          } else {
            awardedMarks = 0;
            isCorrect = false;
            feedback = "O'qituvchi tekshiruviga yuborildi.";
          }
          aiGrading = {
            grading_status: 'pending_review',
            awarded_marks: awardedMarks,
            maximum_marks: qScore,
            student_feedback: feedback
          };
        }
      }
    } else if (qType === 'math') {
      // Math equation solver
      if (studentAns !== undefined && studentAns !== null && String(studentAns).trim().length > 0) {
        const cleanStudent = String(studentAns).trim().toLowerCase().replace(/\s+/g, '');
        let acceptedAnswers = [];
        try {
          if (Array.isArray(q.correctAnswer)) {
            acceptedAnswers = q.correctAnswer.map(a => String(a).trim().toLowerCase().replace(/\s+/g, ''));
          } else {
            acceptedAnswers = String(q.correctAnswer || '').split(/[,|]/).map(a => a.trim().toLowerCase().replace(/\s+/g, '')).filter(Boolean);
            if (acceptedAnswers.length === 0 && q.correctAnswer) {
              acceptedAnswers = [String(q.correctAnswer).trim().toLowerCase().replace(/\s+/g, '')];
            }
          }
        } catch (e) {
          acceptedAnswers = [String(q.correctAnswer || '').trim().toLowerCase().replace(/\s+/g, '')];
        }

        if (acceptedAnswers.includes(cleanStudent)) {
          isCorrect = true;
          awardedMarks = qScore;
          feedback = "To'g'ri yechim!";
        } else {
          feedback = "Noto'g'ri hisoblash.";
        }
      } else {
        feedback = "Javob kiritilmadi.";
      }
    }

    if (isCorrect) {
      correctCount++;
    }
    earnedScore += awardedMarks;

    questionResults.push({
      questionId: q.id || idx + 1,
      index: idx,
      type: qType,
      text: q.text,
      options: options,
      imageUrl: q.imageUrl || null,
      topic: q.topic || test.category || 'Umumiy',
      studentAnswer: studentAns,
      correctAnswer: ((qType === 'single' || qType === 'mcq') && normalizeOptionIndex(q.correctAnswer, options) !== -1)
        ? normalizeOptionIndex(q.correctAnswer, options)
        : q.correctAnswer, // Send official correct answer AFTER submission
      isCorrect,
      awardedMarks,
      maxScore: qScore,
      explanation: q.explanation || '',
      feedback,
      aiGrading,
      markingScheme: q.markingScheme || null
    });
  }

  const totalQuestions = questions.length > 0 ? questions.length : 1;
  const score = totalPossibleScore > 0 ? Math.round((earnedScore / totalPossibleScore) * 100) : 0;
  const passed = score >= (test.passingPercentage || 70);

  const insertedSub = await db.insert('submissions', {
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    userAvatar: req.user.avatar || null,
    testId,
    testTitle: test.title,
    courseTitle: test.course || test.courseTitle || test.category || 'Barcha kurslar',
    score,
    earnedScore,
    totalPossibleScore: totalPossibleScore || totalQuestions,
    correctCount,
    incorrectCount: totalQuestions - correctCount,
    tabSwitches: tabSwitches || 0,
    timeSpent: timeSpent || '00:00',
    passed,
    details: questionResults,
    createdAt: new Date().toISOString()
  });

  if (tabSwitches >= 3) {
    db.logSecurityIncident({ type: 'EXAM_CHEATING_ALERT', severity: 'HIGH', message: `Talaba imtihonda cheat qildi: ${req.user.email}. Tab: ${tabSwitches}`, ip: req.ip });
    broadcastToDashboard('sec_log', { type: 'EXAM_CHEATING_ALERT', severity: 'HIGH', message: `Imtihonda ko'chirish urinishi: ${req.user.name}`, ip: req.ip });
  }

  // Notify admins in real-time
  await sendNotificationToAdmins(
    "Yangi test topshirildi 📝",
    `${req.user.name} "${test.title}" imtihon testini ${score}% (${earnedScore}/${totalPossibleScore} ball) bilan topshirdi (${passed ? "O'tdi ✅" : "O'tmadi ❌"}).`
  );

  // Gamification: award XP & Coins for test completion
  let gamificationResult = null;
  try {
    const priorTestCount = await db.prisma.submission.count({
      where: { userId: req.user.id, testId }
    });
    const isFirstAttempt = priorTestCount <= 1;
    const xpAward = isFirstAttempt
      ? Math.max(20, (earnedScore * 15) + (passed ? 50 : 10))
      : Math.max(5, correctCount * 5);
    const coinsAward = isFirstAttempt
      ? (passed ? (25 + Math.floor(score / 10) * 2) : 5)
      : (passed ? 5 : 2);

    gamificationResult = await awardStudentProgress({
      userId: req.user.id,
      eventKey: `test_${testId}_${insertedSub?.id || Date.now()}`,
      type: 'test',
      xp: xpAward,
      coins: coinsAward,
      meta: { testId, testTitle: test.title, score, passed },
      allowDuplicate: true
    });
  } catch (gErr) {
    console.error('Test gamification award failed:', gErr);
  }

  res.status(201).json({
    message: 'Natijangiz saqlandi!',
    awarded: gamificationResult ? { xp: gamificationResult.awardedXp, coins: gamificationResult.awardedCoins } : { xp: 0, coins: 0 },
    userStats: gamificationResult?.userStats || null,
    result: {
      id: insertedSub?.id || Date.now(),
      score,
      earnedScore,
      totalPossibleScore,
      correctCount,
      totalQuestions,
      passed,
      tabSwitches,
      reviews: questionResults
    }
  });
});

app.get('/api/submissions/:id', authenticateToken, async (req, res) => {
  const sub = await db.getById('submissions', req.params.id);
  if (!sub) return res.status(404).json({ error: 'Natija topilmadi.' });
  if (req.user.role === 'student' && sub.userId !== req.user.id) {
    return res.status(403).json({ error: 'Ruxsat berilmagan.' });
  }
  res.json(sub);
});

// Teacher / Admin manual grade adjustment for Short Answer Questions
app.put('/api/submissions/:id/grade', authenticateToken, requireRole('admin'), async (req, res) => {
  const { questionId, newMarks, teacherFeedback } = req.body;
  const sub = await db.getById('submissions', req.params.id);
  if (!sub) return res.status(404).json({ error: 'Natija topilmadi.' });

  const details = Array.isArray(sub.details) ? [...sub.details] : [];
  const targetQ = details.find(q => String(q.questionId) === String(questionId));
  if (!targetQ) return res.status(404).json({ error: 'Savol topilmadi.' });

  const maxScore = targetQ.maxScore || 1;
  const validMarks = Math.max(0, Math.min(maxScore, Number(newMarks) || 0));

  targetQ.awardedMarks = validMarks;
  targetQ.isCorrect = validMarks === maxScore;
  if (teacherFeedback) targetQ.feedback = teacherFeedback;
  if (targetQ.aiGrading) {
    targetQ.aiGrading.grading_status = 'teacher_reviewed';
    targetQ.aiGrading.awarded_marks = validMarks;
  }

  // Recalculate submission score
  let earned = 0;
  let totalPos = 0;
  let correctC = 0;
  details.forEach(d => {
    earned += Number(d.awardedMarks) || 0;
    totalPos += Number(d.maxScore) || 1;
    if (d.isCorrect) correctC++;
  });

  const newScore = totalPos > 0 ? Math.round((earned / totalPos) * 100) : 0;
  const updatedSub = await db.update('submissions', req.params.id, {
    earnedScore: earned,
    score: newScore,
    correctCount: correctC,
    incorrectCount: details.length - correctC,
    passed: newScore >= 70,
    details: JSON.stringify(details)
  });

  if (sub.userId) {
    try {
      await sendNotificationToUser(
        sub.userId,
        "Test natijangiz yangilandi 🎯",
        `"${sub.testTitle || 'Test'}" bo'yicha yozma javobingiz o'qituvchi tomonidan baholandi. Yangi natijangiz: ${newScore}% (${earned}/${totalPos} ball).`
      );
    } catch (e) {}
  }

  res.json({ message: 'Baho muvaffaqiyatli yangilandi!', submission: updatedSub });
});

app.get('/api/submissions', authenticateToken, async (req, res) => {
  const submissions = await db.get('submissions');
  if (req.user.role === 'student') return res.json(submissions.filter(s => s.userId === req.user.id));
  res.json(submissions);
});

app.post('/api/system/cheat-report', authenticateToken, async (req, res) => {
  const { testTitle, tabSwitches } = req.body;
  db.logSecurityIncident({ type: 'TAB_SWITCH_WARNING', severity: 'MEDIUM', message: `Talaba imtihon oynasidan chiqdi: ${req.user.name}. Test: "${testTitle}". Ogohlantirishlar: ${tabSwitches}`, ip: req.ip });
  broadcastToDashboard('sec_log', { type: 'TAB_SWITCH_WARNING', severity: 'MEDIUM', message: `Oynadan chiqish: ${req.user.name} (${tabSwitches}-marta)`, ip: req.ip });
  res.json({ success: true });
});

// System Stats
app.get('/api/admin/dashboard-stats', authenticateToken, requireRole('admin'), async (req, res) => {
  const students = await db.prisma.user.count({ where: { role: 'student' } });
  const activeStudents = await db.prisma.user.count({ where: { role: 'student', status: { not: 'Chetlashtirilgan' } } });
  const tests = await db.prisma.test.count();
  const passCount = await db.prisma.submission.count({ where: { passed: true } });
  const passRate = tests > 0 ? Math.round((passCount / (await db.prisma.submission.count() || 1)) * 100) : 0;
  
  res.json({ totalStudents: students, activeStudents, activeTests: tests, avgPassRate: passRate });
});

// Lesson Completion
app.post('/api/lessons/:id/complete', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prisma.completedLesson.findUnique({
      where: {
        userId_lessonId: {
          userId: req.user.id,
          lessonId: req.params.id
        }
      }
    });

    let awardResult = null;
    if (!existing) {
      await db.prisma.completedLesson.create({
        data: {
          userId: req.user.id,
          lessonId: req.params.id
        }
      });
      awardResult = await awardStudentProgress({
        userId: req.user.id,
        eventKey: `lesson_${req.params.id}`,
        type: 'lesson',
        xp: 50,
        coins: 15,
        meta: { lessonId: req.params.id }
      });
    } else {
      const u = await db.prisma.user.findUnique({ where: { id: req.user.id } });
      awardResult = {
        alreadyAwarded: true,
        awardedXp: 0,
        awardedCoins: 0,
        userStats: u ? normalizePeriodBuckets(u) : null
      };
    }

    res.json({
      success: true,
      message: "Dars yakunlandi",
      awarded: { xp: awardResult?.awardedXp || 0, coins: awardResult?.awardedCoins || 0 },
      userStats: awardResult?.userStats || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/stats', async (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const totalCourses = await db.prisma.course.count();
  const totalTests = await db.prisma.test.count();
  const totalSubmissions = await db.prisma.submission.count();
  const totalUsers = await db.prisma.user.count();
  const securityLogs = await db.get('securityLogs');
  const apiLogs = await db.get('apiLogs');

  res.json({
    system: { platform: os.platform(), arch: os.arch(), cpuModel: os.cpus()[0]?.model, uptime, maintenanceMode },
    counts: { courses: totalCourses, tests: totalTests, submissions: totalSubmissions, users: totalUsers, securityEvents: securityLogs.length, apiHits: apiLogs.length },
    recentSecurityLogs: securityLogs.slice(0, 10),
    recentApiLogs: apiLogs.slice(0, 10)
  });
});

app.post('/api/system/control', async (req, res) => {
  const { action, value } = req.body;
  if (action === 'toggle_maintenance') {
    maintenanceMode = value;
    db.logSecurityIncident({ type: 'SYSTEM_MAINTENANCE_TOGGLE', severity: 'HIGH', message: `Maintenance Mode is now ${maintenanceMode ? 'ENABLED' : 'DISABLED'}`, ip: req.ip });
    broadcastToDashboard('sec_log', { type: 'MAINTENANCE_TOGGLE', severity: 'HIGH', message: `Maintenance Mode: ${maintenanceMode ? 'YOQILDI' : 'OCHIRILDI'}` });
    return res.json({ success: true, maintenanceMode });
  }
  if (action === 'clear_logs') {
    await db.clearLogs();
    db.logSecurityIncident({ type: 'LOGS_CLEARED', severity: 'MEDIUM', message: 'System audit logs cleared.', ip: req.ip });
    broadcastToDashboard('sec_log', { type: 'LOGS_CLEARED', severity: 'MEDIUM', message: 'Loglar tozalandi.' });
    return res.json({ success: true });
  }
  res.status(400).json({ error: 'Noto\'g\'ri buyruq.' });
});

// Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  await processDueScheduledPushes();
  // First, dynamically generate deadline notifications before fetching
  if (req.user.role === 'student') {
    const user = await db.prisma.user.findUnique({ where: { id: req.user.id }, select: { deadline: true } });
    if (user && user.deadline) {
      const now = new Date();
      const diffTime = new Date(user.deadline) - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const checkAndCreate = async (title, message) => {
        const existing = await db.prisma.notification.findFirst({
          where: { userId: req.user.id, title }
        });
        if (!existing) {
          await db.prisma.notification.create({
            data: { userId: req.user.id, title, message }
          });
        }
      };

      if (diffDays <= 10 && diffDays > 1) {
        await checkAndCreate("Muddat tugamoqda", "Kurs muddati tugashiga 10 kundan kam vaqt qoldi. Iltimos, kursni yakunlang.");
      } else if (diffDays === 1) {
        await checkAndCreate("So'nggi kun", "Bugun kursning oxirgi kuni! Tezroq ulgurib qoling.");
      }
    }
  }

  const notifications = await db.prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notifications);
});

app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  await db.prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true }
  });
  res.json({ success: true });
});

app.post('/api/notifications/read-all', authenticateToken, async (req, res) => {
  await db.prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true }
  });
  res.json({ success: true, message: "Barcha bildirishnomalar o'qilgan deb belgilandi." });
});

app.post('/api/notifications', authenticateToken, requireRole('admin'), async (req, res) => {
  const { userId, course, title, message } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Sarlavha va matn kiritilishi shart.' });
  if (userId) {
    const notif = await sendNotificationToUser(userId, title, message);
    return res.status(201).json(notif);
  }
  if (course) {
    await sendNotificationToCourseStudents(course, title, message);
    return res.status(201).json({ message: "Kurs talabalariga yuborildi." });
  }
  const allStudents = await db.prisma.user.findMany({ where: { role: 'student' }, select: { id: true } });
  for (const s of allStudents) {
    await sendNotificationToUser(s.id, title, message);
  }
  res.status(201).json({ message: "Barcha talabalarga yuborildi." });
});

// ==========================================
// LANDING PAGE API
// ==========================================
const LANDING_DB_FILE = path.join(__dirname, 'db.json');
const TMP_LANDING_DB_FILE = path.join(os.tmpdir(), 'mathscore-db.json');
const defaultLandingData = {
  settings: {
    heroTitle: "SAT Matematikani zamonaviy metodlar yordamida, ingliz tilida tez va samarali o'rganing",
    heroSubtitle: "Jahon standartlariga mos ta'lim. Yuqori ball oling va nufuzli xorijiy universitetlarga grant yutish imkoniyatini qo'lga kiriting.",
    contactPhone: "+998 99 824 46 18",
    contactAddress: "Toshkent shahri, Sergeli tumani",
    telegramLink: "https://t.me/math_teacher_m"
  },
  results: [
    { id: 1, score: 'SAT 1520', name: 'Azizbek K.', color: 'text-primary' },
    { id: 2, score: 'SAT 1480', name: 'Malika O.', color: 'text-tertiary' },
    { id: 3, score: 'A-Level A*', name: 'Sardor T.', color: 'text-secondary' },
    { id: 4, score: 'SAT 1550', name: 'Durdona S.', color: 'text-primary' }
  ],
  pricing: [
    { id: 1, title: 'SAT Matematika', description: 'Noldan boshlab yuqori darajagacha intensiv tayyorgarlik. Ingliz tilida masalalar yechish.', price: '600,000', type: 'primary' },
    { id: 2, title: 'A-Level Math', description: 'Kembrij dasturi asosida chuqurlashtirilgan matematika. Pure Math va Mechanics.', price: '700,000', type: 'tertiary' },
    { id: 3, title: 'Matematika Foundation', description: 'Asosiy matematik bilimlarni mustahkamlash va ingliz tilidagi terminlarga moslashish.', price: '500,000', type: 'secondary' }
  ]
};

function readLandingDB() {
  if (fs.existsSync(LANDING_DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LANDING_DB_FILE, 'utf8'));
    } catch (e) {}
  }
  if (fs.existsSync(TMP_LANDING_DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TMP_LANDING_DB_FILE, 'utf8'));
    } catch (e) {}
  }
  try {
    fs.writeFileSync(LANDING_DB_FILE, JSON.stringify(defaultLandingData, null, 2));
  } catch (e) {
    try { fs.writeFileSync(TMP_LANDING_DB_FILE, JSON.stringify(defaultLandingData, null, 2)); } catch (_) {}
  }
  return defaultLandingData;
}

function writeLandingDB(data) {
  const json = JSON.stringify(data, null, 2);
  try {
    fs.writeFileSync(LANDING_DB_FILE, json);
  } catch (err) {}
  try {
    fs.writeFileSync(TMP_LANDING_DB_FILE, json);
  } catch (err) {}
}


// ==================== TASKS & ASSIGNMENTS API ====================
app.get('/api/tasks', (req, res) => {
  const dbData = readLandingDB();
  let tasks = dbData.tasks || [];
  
  // Student course filtering: Task qaysi kurs uchun tanlangan bo'lsa mazkur kursdagi talabalarning student panelida aks etsin
  const studentCourse = req.query.course;
  if (studentCourse && studentCourse !== 'all' && studentCourse !== 'undefined') {
    tasks = tasks.filter(t => {
      if (!t.courses && !t.courseTitle) return true; // Umumiy topshiriq
      const taskCourses = Array.isArray(t.courses) && t.courses.length > 0 
        ? t.courses 
        : (t.courseTitle ? t.courseTitle.split(',').map(c => c.trim()) : []);
      if (taskCourses.length === 0 || taskCourses.includes('All Courses') || taskCourses.includes('Barcha kurslar')) return true;
      return taskCourses.some(c => c.toLowerCase() === studentCourse.toLowerCase());
    });
  }
  
  res.json(tasks);
});

app.post('/api/tasks', upload.single('file'), async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.tasks) dbData.tasks = [];

    let fileUrl = '';
    let fileName = '';
    let fileSize = 0;
    if (req.file) {
      if (req.file.size > 70 * 1024 * 1024) {
        return res.status(400).json({ error: "Xatolik: Fayl hajmi 70 MB dan oshmasligi kerak!" });
      }
      fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = req.file.size;
    }

    const { courseTitle, title, description, deadline, linkUrl, courses, coins, xp } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Topshiriq sarlavhasi kiritilishi shart." });
    }

    let parsedCourses = [];
    if (Array.isArray(courses)) {
      parsedCourses = courses;
    } else if (typeof courses === 'string') {
      try {
        const p = JSON.parse(courses);
        parsedCourses = Array.isArray(p) ? p : [courses];
      } catch (e) {
        parsedCourses = courses.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (parsedCourses.length === 0 && courseTitle) {
      parsedCourses = [courseTitle];
    }
    const finalCourseTitle = parsedCourses.length > 0 ? parsedCourses.join(', ') : (courseTitle || 'All Courses');

    const newTask = {
      id: Date.now(),
      courseTitle: finalCourseTitle,
      courses: parsedCourses,
      title: title.trim(),
      description: (description || '').slice(0, 256),
      deadline: deadline || new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      linkUrl: linkUrl || '',
      fileUrl: fileUrl,
      fileName: fileName,
      fileSize: fileSize,
      coins: Number(coins) || 50,
      xp: Number(xp) || 100,
      tasksCount: 1,
      uploadedStudentsCount: 0,
      linksCount: linkUrl ? 1 : 0,
      submissions: [],
      createdAt: new Date().toISOString()
    };

    dbData.tasks.unshift(newTask);
    if (dbData.settings && dbData.settings.tasksPayload !== undefined) {
      delete dbData.settings.tasksPayload;
    }
    writeLandingDB(dbData);
    broadcastToDashboard('tasks_update', { action: 'created', taskId: newTask.id });
    broadcastToDashboard('progress_update', { source: 'task_created', taskId: newTask.id });

    // Tanlangan barcha kurslar talabalariga bildirishnoma yuborish
    parsedCourses.forEach(cName => {
      sendNotificationToCourseStudents(
        cName,
        "Yangi topshiriq yuklandi! 📚",
        `"${cName}" kursingizga yangi topshiriq: "${newTask.title}" qo'shildi. Topshirish muddati: ${new Date(newTask.deadline).toLocaleDateString('uz-UZ')}. Mukofot: +${newTask.xp} XP, +${newTask.coins} Coin.`
      );
    });

    res.status(201).json(newTask);
  } catch (err) {
    console.error("Task create error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.tasks) dbData.tasks = [];
    const taskIdStr = String(req.params.id);
    dbData.tasks = dbData.tasks.filter(t => String(t.id) !== taskIdStr);
    if (dbData.settings && dbData.settings.tasksPayload !== undefined) {
      delete dbData.settings.tasksPayload;
    }
    writeLandingDB(dbData);
    broadcastToDashboard('tasks_update', { action: 'deleted', taskId: taskIdStr });
    broadcastToDashboard('progress_update', { source: 'task_deleted', taskId: taskIdStr });
    res.json({ success: true, message: "Topshiriq muvaffaqiyatli o'chirildi." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.tasks) dbData.tasks = [];
    const taskIdStr = String(req.params.id);
    const task = dbData.tasks.find(t => String(t.id) === taskIdStr);
    if (!task) return res.status(404).json({ error: "Topshiriq topilmadi." });

    const { title, description, deadline } = req.body;
    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description.trim().slice(0, 256);
    if (deadline) task.deadline = deadline;
    task.updatedAt = new Date().toISOString();

    if (dbData.settings && dbData.settings.tasksPayload !== undefined) {
      delete dbData.settings.tasksPayload;
    }
    writeLandingDB(dbData);
    broadcastToDashboard('tasks_update', { action: 'updated', taskId: task.id });
    broadcastToDashboard('progress_update', { source: 'task_updated', taskId: task.id });
    res.json({ success: true, message: "Topshiriq muvaffaqiyatli yangilandi!", task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/grade', async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.tasks) dbData.tasks = [];
    const taskIdStr = String(req.params.id);
    const task = dbData.tasks.find(t => String(t.id) === taskIdStr);
    if (!task) return res.status(404).json({ error: "Topshiriq topilmadi." });

    const { submissionId, grade, feedback, gradedBy, attemptsAllowed, resubmitAllowed } = req.body;
    if (!task.submissions) task.submissions = [];
    const submission = task.submissions.find(s => String(s.id) === String(submissionId));
    if (!submission) {
      return res.status(404).json({ error: "Talaba yechimi topilmadi." });
    }

    if (grade !== undefined) {
      submission.grade = grade;
      submission.gradedAt = new Date().toISOString();
      submission.gradedBy = gradedBy || 'Admin';
    }
    if (feedback !== undefined) {
      submission.feedback = feedback;
    }

    // 2-3-imkoniyat berish mantig'i
    if (attemptsAllowed !== undefined) {
      submission.attemptsAllowed = parseInt(attemptsAllowed) || 1;
    }
    if (resubmitAllowed !== undefined) {
      submission.resubmitAllowed = Boolean(resubmitAllowed);
      if (submission.resubmitAllowed) {
        submission.resubmitGrantedAt = new Date().toISOString();
        if (!submission.attemptsAllowed || submission.attemptsAllowed < 2) {
          submission.attemptsAllowed = 2;
        }
      }
    }

    if (dbData.settings && dbData.settings.tasksPayload !== undefined) {
      delete dbData.settings.tasksPayload;
    }
    writeLandingDB(dbData);
    broadcastToDashboard('tasks_update', { action: 'graded', taskId: task.id, submissionId });

    // Notify the student about the grade and feedback
    (async () => {
      try {
        let studentUserId = submission.studentId;
        if (!studentUserId && submission.studentEmail) {
          const u = await db.prisma.user.findFirst({ where: { email: submission.studentEmail } });
          if (u) studentUserId = u.id;
        }
        if (!studentUserId && submission.studentPhone) {
          const u = await db.prisma.user.findFirst({ where: { phone: submission.studentPhone } });
          if (u) studentUserId = u.id;
        }
        if (!studentUserId && submission.studentName) {
          const u = await db.prisma.user.findFirst({
            where: { role: 'student', name: { contains: submission.studentName.trim() } }
          });
          if (u) studentUserId = u.id;
        }
        if (studentUserId && grade !== undefined) {
          // Award bonus XP & Coins for high grade (>= 80 or A/B)
          try {
            const gStr = String(grade || '').trim().toUpperCase();
            const gNum = Number(gStr);
            const isHighGrade = (!isNaN(gNum) && gNum >= 80) || gStr === 'A' || gStr === 'A+' || gStr === 'B';
            if (isHighGrade) {
              await awardStudentProgress({
                userId: studentUserId,
                eventKey: `task_grade_bonus_${task.id}`,
                type: 'task_grade',
                xp: 25,
                coins: 10,
                meta: { taskId: task.id, grade }
              });
            }
          } catch (gErr) {}

          await sendNotificationToUser(
            studentUserId,
            "Topshirig'ingiz baholandi! ⭐",
            `"${task.title}" topshirig'ingiz baholandi: ${grade} ball. O'qituvchi izohi: "${feedback || "Baholandi."}"`
          );
        }
      } catch (err) {
        console.error("Grade notif error:", err);
      }
    })();

    res.json({ success: true, message: "Baho va fikr muvaffaqiyatli saqlandi!", task, submission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin tomonidan talabaga topshiriqni qayta yuklash (2-3-imkoniyat) berish API
app.post('/api/tasks/:id/allow-resubmit', async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.tasks) dbData.tasks = [];
    const taskIdStr = String(req.params.id);
    const task = dbData.tasks.find(t => String(t.id) === taskIdStr);
    if (!task) return res.status(404).json({ error: "Topshiriq topilmadi." });

    const { submissionId, attemptsAllowed, feedback } = req.body;
    if (!task.submissions) task.submissions = [];
    const submission = task.submissions.find(s => String(s.id) === String(submissionId));
    if (!submission) {
      return res.status(404).json({ error: "Talaba yechimi topilmadi." });
    }

    submission.resubmitAllowed = true;
    submission.attemptsAllowed = parseInt(attemptsAllowed) || 2;
    submission.resubmitGrantedAt = new Date().toISOString();
    if (feedback) submission.feedback = feedback;

    if (dbData.settings && dbData.settings.tasksPayload !== undefined) {
      delete dbData.settings.tasksPayload;
    }
    writeLandingDB(dbData);
    broadcastToDashboard('tasks_update', { action: 'resubmit_granted', taskId: task.id, submissionId });

    // Notify the student about resubmission opportunity
    (async () => {
      try {
        let studentUserId = submission.studentId;
        if (!studentUserId && submission.studentEmail) {
          const u = await db.prisma.user.findFirst({ where: { email: submission.studentEmail } });
          if (u) studentUserId = u.id;
        }
        if (!studentUserId && submission.studentPhone) {
          const u = await db.prisma.user.findFirst({ where: { phone: submission.studentPhone } });
          if (u) studentUserId = u.id;
        }
        if (!studentUserId && submission.studentName) {
          const u = await db.prisma.user.findFirst({
            where: { role: 'student', name: { contains: submission.studentName.trim() } }
          });
          if (u) studentUserId = u.id;
        }
        if (studentUserId && grade !== undefined) {
          await sendNotificationToUser(
            studentUserId,
            "Qayta topshirish imkoniyati berildi! 🔄",
            `"${task.title}" topshirig'i uchun sizga ${submission.attemptsAllowed}-imkoniyat berildi. Yangilangan yechimni yuklashingiz mumkin.`
          );
        }
      } catch (err) {
        console.error("Resubmit notif error:", err);
      }
    })();

    res.json({ success: true, message: `${submission.attemptsAllowed}-imkoniyat muvaffaqiyatli berildi!`, task, submission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/submit', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Fayl yuklanmadi." });
    }

    const allowedExts = ['.pdf', '.doc', '.docx', '.mp3', '.wav', '.webm', '.ogg', '.m4a', '.aac', '.mp4', '.opus', '.flac', '.zip'];
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isAudio = ['.mp3', '.wav', '.webm', '.ogg', '.m4a', '.aac', '.opus', '.flac'].includes(ext) || (req.file.mimetype && req.file.mimetype.startsWith('audio/'));
    const isRecordedMic = req.file.originalname.includes('ovozli_yechim') || req.file.originalname.includes('recording');
    const maxLimitBytes = (isAudio && !isRecordedMic) ? 70 * 1024 * 1024 : 50 * 1024 * 1024;
    const maxLimitLabel = (isAudio && !isRecordedMic) ? '70 MB' : '50 MB';

    if (req.file.size > maxLimitBytes) {
      return res.status(400).json({ error: `Xatolik: Fayl hajmi ${maxLimitLabel} dan oshmasligi kerak!` });
    }

    if (!allowedExts.includes(ext) && !isAudio) {
      return res.status(400).json({ error: "Xatolik: Faqat .pdf, .doc, .docx yoki audio fayllar qabul qilinadi!" });
    }

    const dbData = readLandingDB();
    if (!dbData.tasks) dbData.tasks = [];
    const taskIdStr = String(req.params.id);
    const task = dbData.tasks.find(t => String(t.id) === taskIdStr);

    if (!task) {
      return res.status(404).json({ error: "Topshiriq topilmadi." });
    }

    const authUser = getOptionalAuthUser(req);
    const actingStudentId = authUser?.id || await findStudentIdFromPayload({
      studentId: req.body.studentId,
      studentEmail: req.body.studentEmail,
      studentPhone: req.body.studentPhone,
      studentName: req.body.studentName
    });
    if (actingStudentId) {
      const actingUser = await db.prisma.user.findUnique({ where: { id: actingStudentId }, select: { id: true, role: true } });
      if (actingUser?.role === 'student' && getStudentTariff(actingUser.id) === 'FREE') {
        try { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) {}
        return res.status(403).json({
          error: "Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak.",
          code: 'PREMIUM_REQUIRED'
        });
      }
    }

    if (!task.submissions) task.submissions = [];
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const existingIndex = task.submissions.findIndex(s =>
      (req.body.studentId && s.studentId && String(s.studentId) === String(req.body.studentId)) ||
      (req.body.studentEmail && s.studentEmail && s.studentEmail.toLowerCase().trim() === req.body.studentEmail.toLowerCase().trim()) ||
      (req.body.studentPhone && s.studentPhone && s.studentPhone === req.body.studentPhone) ||
      (req.body.studentName && s.studentName && s.studentName.toLowerCase().trim() === req.body.studentName.toLowerCase().trim())
    );

    let submission;
    if (existingIndex !== -1) {
      const prevSub = task.submissions[existingIndex];
      const nextAttempt = (prevSub.attemptNumber || 1) + 1;
      submission = {
        ...prevSub,
        studentId: req.body.studentId || prevSub.studentId || actingStudentId || null,
        studentAvatar: req.body.studentAvatar || prevSub.studentAvatar || null,
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: req.file.size,
        submittedAt: new Date().toISOString(),
        attemptNumber: nextAttempt,
        resubmitAllowed: false, // Ishlatildi, yangi imkoniyat admin ruxsatidan keyin ochiladi
        resubmittedAt: new Date().toISOString(),
        previousSubmissions: [
          ...(prevSub.previousSubmissions || []),
          {
            fileName: prevSub.fileName,
            fileUrl: prevSub.fileUrl,
            fileSize: prevSub.fileSize || 0,
            submittedAt: prevSub.submittedAt,
            grade: prevSub.grade,
            feedback: prevSub.feedback,
            attemptNumber: prevSub.attemptNumber || 1
          }
        ],
        grade: null, // Qayta baholash uchun bo'shatiladi
        feedback: `${nextAttempt}-urinish yuborildi. O'qituvchi tekshirmoqda.`
      };
      task.submissions[existingIndex] = submission;
    } else {
      submission = {
        id: Date.now(),
        studentName: req.body.studentName || authUser?.name || 'Talaba',
        studentId: req.body.studentId || actingStudentId || null,
        studentEmail: req.body.studentEmail || authUser?.email || null,
        studentPhone: req.body.studentPhone || '',
        studentAvatar: req.body.studentAvatar || '',
        fileName: req.file.originalname,
        fileUrl: fileUrl,
        fileSize: req.file.size,
        submittedAt: new Date().toISOString(),
        attemptNumber: 1,
        attemptsAllowed: 1,
        resubmitAllowed: false,
        grade: null,
        feedback: ''
      };
      task.submissions.push(submission);
    }

    if (req.body.studentEmail) {
      submission.studentEmail = req.body.studentEmail;
    }

    task.uploadedStudentsCount = task.submissions.length;
    if (dbData.settings && dbData.settings.tasksPayload !== undefined) {
      delete dbData.settings.tasksPayload;
    }
    writeLandingDB(dbData);
    broadcastToDashboard('tasks_update', { action: 'submitted', taskId: task.id, submissionId: submission.id });
    broadcastToDashboard('progress_update', { source: 'task_submitted', taskId: task.id, studentId: submission.studentId });

    // Notify admins about the submitted homework
    await sendNotificationToAdmins(
      "Yangi topshiriq yechimi topshirildi 📥",
      `${submission.studentName} "${task.title}" topshirig'iga ${submission.attemptNumber}-urinish faylini muvaffaqiyatli yukladi.`
    );

    // Gamification: award task XP & Coins (idempotent per student per task)
    let taskAward = null;
    try {
      const targetUserId = actingStudentId;
      if (targetUserId) {
        taskAward = await awardStudentProgress({
          userId: targetUserId,
          eventKey: `task_submit_${task.id}`,
          type: 'task',
          xp: Number(task.xp) || 100,
          coins: Number(task.coins) || 50,
          meta: { taskId: task.id, taskTitle: task.title }
        });
      }
    } catch (gErr) {
      console.error('Task gamification error:', gErr);
    }

    res.status(201).json({
      success: true,
      message: "Topshiriq muvaffaqiyatli topshirildi!",
      task,
      submission,
      awarded: taskAward ? { xp: taskAward.awardedXp, coins: taskAward.awardedCoins } : { xp: 0, coins: 0 },
      userStats: taskAward?.userStats || null
    });
  } catch (err) {
    console.error("Submission error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', (req, res) => {
  const db = readLandingDB();
  res.json(db.settings);
});

app.put('/api/settings', (req, res) => {
  const db = readLandingDB();
  db.settings = { ...db.settings, ...req.body };
  writeLandingDB(db);
  res.json(db.settings);
});

app.get('/api/results', (req, res) => {
  const db = readLandingDB();
  res.json(db.results);
});

app.post('/api/results', (req, res) => {
  const db = readLandingDB();
  const newResult = { id: Date.now(), ...req.body };
  db.results.push(newResult);
  writeLandingDB(db);
  res.json(newResult);
});

app.delete('/api/results/:id', (req, res) => {
  const db = readLandingDB();
  db.results = db.results.filter(r => r.id !== parseInt(req.params.id));
  writeLandingDB(db);
  res.json({ success: true });
});

app.put('/api/results/bulk', (req, res) => {
  const db = readLandingDB();
  db.results = req.body;
  writeLandingDB(db);
  res.json({ success: true });
});

app.get('/api/pricing', (req, res) => {
  const db = readLandingDB();
  res.json(db.pricing);
});

app.post('/api/pricing', (req, res) => {
  const db = readLandingDB();
  const newPricing = { id: Date.now(), ...req.body };
  db.pricing.push(newPricing);
  writeLandingDB(db);
  res.json(newPricing);
});

app.delete('/api/pricing/:id', (req, res) => {
  const db = readLandingDB();
  db.pricing = db.pricing.filter(p => p.id !== parseInt(req.params.id));
  writeLandingDB(db);
  res.json({ success: true });
});

app.put('/api/pricing/bulk', (req, res) => {
  const db = readLandingDB();
  db.pricing = req.body;
  writeLandingDB(db);
  res.json({ success: true });
});

// ==========================================
// 1. STUDENTS SEARCH API (Speaking Partner & Chat)
// ==========================================
app.get('/api/students/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const students = await db.prisma.user.findMany({
      where: {
        role: 'student',
        OR: q ? [
          { name: { contains: q } },
          { email: { contains: q } }
        ] : undefined
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        course: true,
        status: true
      },
      take: 20
    });
    res.json(students);
  } catch (err) {
    console.error("Students search error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. LIVE CLASSES API (Google Meet & YouTube)
// ==========================================
const DEFAULT_LIVE_CLASSES = [
  {
    id: 1794200001,
    title: "IELTS Speaking: Band 8.0 Live Mock Interview & Part 2 Strategy",
    platform: "google-meet",
    url: "https://meet.google.com/abc-defg-hij",
    date: "09-11-2026",
    time: "19:00",
    description: "Part 2 Cue kartalari, intonatsiya va ravon gapirish bo'yicha jonli interaktiv master-klass.",
    createdAt: new Date().toISOString()
  },
  {
    id: 1794200002,
    title: "Everyday English Fluency: Idioms & American Accent Live Practice",
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    date: "10-11-2026",
    time: "20:00",
    description: "Jonli efirda amerika talaffuzi, birikmalar va tezkor javob berish mashqlari.",
    createdAt: new Date().toISOString()
  }
];

app.get('/api/live-classes', (req, res) => {
  const authUser = getOptionalAuthUser(req);
  if (authUser && authUser.role === 'student' && getStudentTariff(authUser.id) === 'FREE') {
    return res.status(403).json({
      error: "Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak.",
      code: 'PREMIUM_REQUIRED'
    });
  }
  const dbData = readLandingDB();
  if (!Array.isArray(dbData.liveClasses) && !dbData.liveClassesInitialized) {
    dbData.liveClasses = DEFAULT_LIVE_CLASSES;
    dbData.liveClassesInitialized = true;
    writeLandingDB(dbData);
  } else if (!Array.isArray(dbData.liveClasses)) {
    dbData.liveClasses = [];
  }
  res.json(dbData.liveClasses);
});

app.post('/api/live-classes', async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.liveClasses)) dbData.liveClasses = [];

    const { title, platform, url, date, time, description } = req.body;
    if (!title || !url || !date || !time) {
      return res.status(400).json({ error: "Sarlavha, havola, sana va vaqt kiritilishi shart." });
    }

    const newClass = {
      id: Date.now(),
      title: title.trim(),
      platform: platform === 'youtube' ? 'youtube' : 'google-meet',
      url: url.trim(),
      date: date.trim(), // dd-mm-yyyy
      time: time.trim(), // HH:mm
      description: (description || '').trim(),
      createdAt: new Date().toISOString()
    };

    dbData.liveClassesInitialized = true;
    dbData.liveClasses.unshift(newClass);
    writeLandingDB(dbData);
    broadcastToDashboard('live_class_created', newClass);
    broadcastToDashboard('live_classes_update', dbData.liveClasses);

    // Barcha talabalarga jonli dars haqida bildirishnoma
    try {
      const allStudents = await db.prisma.user.findMany({ where: { role: 'student' }, select: { id: true } });
      for (const s of allStudents) {
        await sendNotificationToUser(
          s.id,
          "Yangi Jonli Dars (Live Class)! 🔴",
          `"${newClass.title}" jonli darsi rejalashtirildi. Boshlanish sanasi: ${newClass.date}, vaqti: ${newClass.time}. Havola: ${newClass.platform === 'google-meet' ? 'Google Meet' : 'YouTube'}.`
        );
      }
    } catch (e) {}

    res.status(201).json(newClass);
  } catch (err) {
    console.error("Live class create error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/live-classes/:id', (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.liveClasses)) dbData.liveClasses = [];
    const idStr = String(req.params.id);
    dbData.liveClasses = dbData.liveClasses.filter(c => String(c.id) !== idStr);
    dbData.liveClassesInitialized = true;
    writeLandingDB(dbData);
    broadcastToDashboard('live_class_deleted', { id: idStr });
    broadcastToDashboard('live_classes_update', dbData.liveClasses);
    res.json({ success: true, count: dbData.liveClasses.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. BOOK LIBRARY API (2-rasm - 3D Kitob javoni)
// ==========================================
const DEFAULT_BOOKS = [
  { id: 1, title: "I WANT MY HAT", author: "Jon Klassen", date: "2024", cover: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 2, title: "THE HOBBIT", author: "J.R.R. Tolkien", date: "2023", cover: "https://images.unsplash.com/photo-1629992101753-56d196c8aabb?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 3, title: "Harry Potter", author: "J.K. Rowling", date: "2024", cover: "https://images.unsplash.com/photo-1618666012174-83b441c0bc76?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 4, title: "What Do You Want To Do Before You Die?", author: "The Buried Life", date: "2022", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 5, title: "THINKING, FAST AND SLOW", author: "Daniel Kahneman", date: "2023", cover: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 6, title: "Fifty Shades Darker", author: "E L James", date: "2021", cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 7, title: "TOWNIE", author: "Andre Dubus III", date: "2022", cover: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 8, title: "Steve Jobs", author: "Walter Isaacson", date: "2023", cover: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 9, title: "SUTTON", author: "J.R. Moehringer", date: "2022", cover: "https://images.unsplash.com/photo-1495640388908-05fa85288e61?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
  { id: 10, title: "JOSEPH ANTON", author: "Salman Rushdie", date: "2021", cover: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=300&auto=format&fit=crop", pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" }
];

app.get('/api/library', (req, res) => {
  const authUser = getOptionalAuthUser(req);
  if (authUser && authUser.role === 'student' && getStudentTariff(authUser.id) === 'FREE') {
    return res.status(403).json({
      error: "Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak.",
      code: 'PREMIUM_REQUIRED'
    });
  }
  const dbData = readLandingDB();
  if (!Array.isArray(dbData.library) && !dbData.libraryInitialized) {
    dbData.library = DEFAULT_BOOKS;
    dbData.libraryInitialized = true;
    writeLandingDB(dbData);
  } else if (!Array.isArray(dbData.library)) {
    dbData.library = [];
  }
  res.json(dbData.library);
});

app.post('/api/library', upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.library)) dbData.library = [];

    const { title, author, publishedDate } = req.body;
    if (!title || !author) {
      return res.status(400).json({ error: "Kitob nomi va muallifi kiritilishi shart." });
    }

    let coverUrl = '';
    let pdfUrl = '';

    if (req.files && req.files['cover'] && req.files['cover'][0]) {
      const coverFile = req.files['cover'][0];
      if (coverFile.size > 3 * 1024 * 1024) {
        return res.status(400).json({ error: "Xatolik: Muqova (obloshka) rasmi 3 MB dan oshmasligi kerak!" });
      }
      coverUrl = `${req.protocol}://${req.get('host')}/uploads/${coverFile.filename}`;
    }

    if (req.files && req.files['pdf'] && req.files['pdf'][0]) {
      const pdfFile = req.files['pdf'][0];
      pdfUrl = `${req.protocol}://${req.get('host')}/uploads/${pdfFile.filename}`;
    }

    const newBook = {
      id: Date.now(),
      title: title.trim(),
      author: author.trim(),
      date: publishedDate ? publishedDate.trim() : new Date().getFullYear().toString(),
      cover: coverUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=300&auto=format&fit=crop",
      pdfUrl: pdfUrl || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      createdAt: new Date().toISOString()
    };

    dbData.libraryInitialized = true;
    dbData.library.push(newBook);
    writeLandingDB(dbData);
    broadcastToDashboard('library_created', newBook);

    // Bildirishnoma yuborish
    try {
      const allStudents = await db.prisma.user.findMany({ where: { role: 'student' }, select: { id: true } });
      for (const s of allStudents) {
        await sendNotificationToUser(s.id, "Kutubxonaga yangi kitob qo'shildi! 📖", `"${newBook.title}" (${newBook.author}) kitobi kutubxonaga yuklandi.`);
      }
    } catch(e) {}

    res.status(201).json(newBook);
  } catch (err) {
    console.error("Library add error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/library/:id', (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.library)) dbData.library = [];
    const idStr = String(req.params.id);
    dbData.library = dbData.library.filter(b => String(b.id) !== idStr);
    dbData.libraryInitialized = true;
    writeLandingDB(dbData);
    broadcastToDashboard('library_deleted', { id: idStr });
    res.json({ success: true, count: dbData.library.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. SPEAKING PARTNER API (Ovozli xabarlar va chat)
// ==========================================
app.get('/api/speaking-partner/chats', (req, res) => {
  const dbData = readLandingDB();
  res.json(dbData.speakingChats || []);
});

app.post('/api/speaking-partner/chats', async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.speakingChats) dbData.speakingChats = [];

    const { topic, color, creatorId, creatorName, creatorEmail, creatorAvatar, partnerId, partnerName, partnerEmail, partnerAvatar } = req.body;
    if (!topic || !partnerEmail) {
      return res.status(400).json({ error: "Mavzu va partner ma'lumotlari kiritilishi shart." });
    }

    const newChat = {
      id: Date.now(),
      topic: topic.trim(),
      color: color || 'indigo',
      creatorId: creatorId || 'current-user',
      creatorName: creatorName || 'Alex Johnson',
      creatorEmail: creatorEmail || 'alex.j@example.com',
      creatorAvatar: creatorAvatar || '',
      partnerId: partnerId || '',
      partnerName: partnerName || '',
      partnerEmail: partnerEmail.trim(),
      partnerAvatar: partnerAvatar || '',
      status: 'pending', // 'pending' -> 'active' / 'declined'
      messages: [],
      createdAt: new Date().toISOString()
    };

    dbData.speakingChats.unshift(newChat);
    writeLandingDB(dbData);

    // Partnerga push bildirishnoma yuborish
    if (partnerId) {
      await sendNotificationToUser(
        partnerId,
        "Speaking Partner taklifi! 🎙️",
        `${newChat.creatorName} sizni "${newChat.topic}" mavzusida audio suhbatga taklif qildi.`
      ).catch(() => {});
    }

    res.status(201).json(newChat);
  } catch (err) {
    console.error("Create speaking chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/speaking-partner/chats/:id/respond', (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.speakingChats) dbData.speakingChats = [];
    const chatId = String(req.params.id);
    const { action } = req.body; // 'accept' or 'decline'

    const chat = dbData.speakingChats.find(c => String(c.id) === chatId);
    if (!chat) return res.status(404).json({ error: "Chat topilmadi." });

    if (action === 'accept') {
      chat.status = 'active';
    } else {
      chat.status = 'declined';
    }
    chat.updatedAt = new Date().toISOString();

    writeLandingDB(dbData);
    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/speaking-partner/chats/:id/messages', upload.single('audio'), async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.speakingChats) dbData.speakingChats = [];
    const chatId = String(req.params.id);

    const chat = dbData.speakingChats.find(c => String(c.id) === chatId);
    if (!chat) return res.status(404).json({ error: "Chat topilmadi." });

    let audioUrl = '';
    if (req.file) {
      audioUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    } else if (req.body.audioData) {
      audioUrl = req.body.audioData;
    }

    if (!audioUrl) {
      return res.status(400).json({ error: "Ovozli fayl topilmadi." });
    }

    const { senderId, senderName, senderEmail, duration } = req.body;
    const newMsg = {
      id: Date.now(),
      chatId: chat.id,
      senderId: senderId || 'current-user',
      senderName: senderName || 'User',
      senderEmail: senderEmail || '',
      audioUrl: audioUrl,
      duration: duration || '0:15',
      createdAt: new Date().toISOString()
    };

    if (!chat.messages) chat.messages = [];
    chat.messages.push(newMsg);
    chat.lastMessageAt = newMsg.createdAt;

    writeLandingDB(dbData);

    // Award XP & Coins for speaking practice (once per day per chat)
    let speakingAward = null;
    try {
      const authUser = getOptionalAuthUser(req);
      const targetUserId = authUser?.id || await findStudentIdFromPayload({
        studentId: senderId !== 'current-user' ? senderId : null,
        studentEmail: senderEmail,
        studentName: senderName
      });
      if (targetUserId) {
        const todayStr = getTashkentDateStr();
        speakingAward = await awardStudentProgress({
          userId: targetUserId,
          eventKey: `speaking_${chat.id}_${todayStr}`,
          type: 'speaking',
          xp: 20,
          coins: 8,
          meta: { chatId: chat.id, topic: chat.topic }
        });
      }
    } catch (gErr) {}

    res.status(201).json({
      ...newMsg,
      awarded: speakingAward ? { xp: speakingAward.awardedXp, coins: speakingAward.awardedCoins } : null,
      userStats: speakingAward?.userStats || null
    });
  } catch (err) {
    console.error("Speaking message error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/speaking-partner/chats/:id/messages/:msgId', (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.speakingChats) dbData.speakingChats = [];
    const chatId = String(req.params.id);
    const msgId = String(req.params.msgId);

    const chat = dbData.speakingChats.find(c => String(c.id) === chatId);
    if (!chat || !chat.messages) return res.status(404).json({ error: "Topilmadi." });

    chat.messages = chat.messages.filter(m => String(m.id) !== msgId);
    writeLandingDB(dbData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/speaking-partner/chats/:id', (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!dbData.speakingChats) dbData.speakingChats = [];
    const chatId = String(req.params.id);
    const userEmail = (req.body && req.body.userEmail) || req.query.userEmail;

    const chat = dbData.speakingChats.find(c => String(c.id) === chatId);
    if (!chat) return res.status(404).json({ error: "Chat topilmadi." });

    // Muhim UX qoidasi: faqat yaratgan talaba o'chira oladi!
    if (userEmail && chat.creatorEmail && chat.creatorEmail.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: "Xatolik: Chatni faqat uni yaratgan talaba o'chira oladi!" });
    }

    dbData.speakingChats = dbData.speakingChats.filter(c => String(c.id) !== chatId);
    writeLandingDB(dbData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. 30 DAY CHALLENGE & SCHEDULED PUSH API
// ==========================================
const MAX_CHALLENGE_DAYS = 30;
const DAILY_PUSH_LIMIT = 10;

function evaluateChallengeDeadlineBonus(ch, nowMs = Date.now()) {
  if (!ch || !ch.deadline) {
    return { status: 'on_time', bonusPercent: 100, remainingMs: null, effectiveUrgentMs: null };
  }
  const deadlineMs = new Date(ch.deadline).getTime();
  if (isNaN(deadlineMs)) {
    return { status: 'on_time', bonusPercent: 100, remainingMs: null, effectiveUrgentMs: null };
  }
  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) {
    return { status: 'expired', bonusPercent: 0, remainingMs: 0, effectiveUrgentMs: 0 };
  }
  const requestedUrgentMs = Math.max(1, Number(ch.urgentWindowMinutes || 120)) * 60 * 1000;
  const createdMs = ch.createdAt ? new Date(ch.createdAt).getTime() : NaN;
  const totalWindowMs = (!isNaN(createdMs) && deadlineMs > createdMs) ? (deadlineMs - createdMs) : (requestedUrgentMs * 4);
  const effectiveUrgentMs = Math.min(requestedUrgentMs, Math.max(60 * 1000, Math.floor(totalWindowMs * 0.25)));

  if (remainingMs <= effectiveUrgentMs) {
    return { status: 'urgent', bonusPercent: 50, remainingMs, effectiveUrgentMs };
  }
  return { status: 'on_time', bonusPercent: 100, remainingMs, effectiveUrgentMs };
}

function normalizeChallengeDayPayload(input = {}, dayNum, existing = null) {
  const cleanTasks = Array.isArray(input.tasks)
    ? input.tasks.map(t => String(t || '').trim()).filter(Boolean)
    : (typeof input.tasks === 'string'
        ? input.tasks.split('\n').map(t => t.trim()).filter(Boolean)
        : (existing?.tasks || []));

  const cleanImages = Array.isArray(input.images)
    ? input.images.map(u => String(u || '').trim()).filter(Boolean)
    : (existing?.images || []);

  const coverImage = String(input.image !== undefined ? input.image : (existing?.image || '')).trim() || cleanImages[0] || '';
  const allImages = coverImage && !cleanImages.includes(coverImage)
    ? [coverImage, ...cleanImages]
    : cleanImages;

  return {
    id: existing?.id || `ch_day_${dayNum}_${Date.now()}`,
    day: Number(dayNum),
    title: String(input.title ?? existing?.title ?? `Day ${dayNum} Challenge`).trim(),
    description: String(input.description ?? existing?.description ?? '').trim(),
    image: coverImage,
    images: allImages,
    tasks: cleanTasks,
    xp: Math.max(0, Math.round(Number(input.xp ?? existing?.xp ?? 100) || 0)),
    coins: Math.max(0, Math.round(Number(input.coins ?? existing?.coins ?? 30) || 0)),
    streakBonus: Math.max(0, Math.round(Number(input.streakBonus ?? existing?.streakBonus ?? 2) || 0)),
    deadline: input.deadline !== undefined ? (input.deadline || null) : (existing?.deadline || null),
    urgentWindowMinutes: Math.max(1, Math.round(Number(input.urgentWindowMinutes ?? existing?.urgentWindowMinutes ?? 120) || 120)),
    completedBy: Array.isArray(existing?.completedBy) ? existing.completedBy : [],
    submissions: (existing?.submissions && typeof existing.submissions === 'object') ? existing.submissions : {},
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function formatChallengeForClient(ch, authUser = null) {
  const evalBonus = evaluateChallengeDeadlineBonus(ch);
  const completedBy = Array.isArray(ch.completedBy) ? ch.completedBy : [];
  const submissionsObj = (ch.submissions && typeof ch.submissions === 'object') ? ch.submissions : {};
  const mySubmission = authUser?.id ? (submissionsObj[authUser.id] || null) : null;
  return {
    ...ch,
    streakBonus: ch.streakBonus ?? 2,
    images: Array.isArray(ch.images) ? ch.images : (ch.image ? [ch.image] : []),
    tasks: Array.isArray(ch.tasks) ? ch.tasks : [],
    completed: authUser?.id ? completedBy.includes(authUser.id) : false,
    mySubmission,
    submissionsCount: completedBy.length,
    bonusStatus: evalBonus.status,
    currentBonusPercent: evalBonus.bonusPercent,
    remainingMs: evalBonus.remainingMs,
    effectiveUrgentMs: evalBonus.effectiveUrgentMs
  };
}

let isProcessingScheduledPushes = false;
async function processDueScheduledPushes() {
  if (isProcessingScheduledPushes) return;
  isProcessingScheduledPushes = true;
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.scheduledPushes) || dbData.scheduledPushes.length === 0) return;

    const nowMs = Date.now();
    const dueItems = dbData.scheduledPushes.filter(p => p.status === 'pending' && new Date(p.scheduledAt).getTime() <= nowMs);
    if (dueItems.length === 0) return;

    const sentAt = new Date().toISOString();
    dueItems.forEach(item => {
      item.status = 'sent';
      item.sentAt = sentAt;
    });
    writeLandingDB(dbData);

    const allStudents = await db.prisma.user.findMany({
      where: { role: 'student', status: { not: 'Chetlashtirilgan' } },
      select: { id: true }
    });

    const latestDb = readLandingDB();
    for (const item of dueItems) {
      let recipientCount = 0;
      for (const s of allStudents) {
        const created = await sendNotificationToUser(s.id, item.title, item.message);
        if (created) recipientCount++;
      }
      const record = (latestDb.scheduledPushes || []).find(p => p.id === item.id);
      if (record) {
        record.recipientCount = recipientCount;
      }
      broadcastToDashboard('push_notification', {
        id: item.id,
        title: item.title,
        message: item.message,
        sentAt,
        recipientCount
      });
    }
    writeLandingDB(latestDb);
  } catch (err) {
    console.error('processDueScheduledPushes error:', err);
  } finally {
    isProcessingScheduledPushes = false;
  }
}

app.get('/api/challenges', (req, res) => {
  const dbData = readLandingDB();
  if (!Array.isArray(dbData.challenges)) {
    dbData.challenges = [];
    writeLandingDB(dbData);
  }
  const authUser = getOptionalAuthUser(req);
  const sorted = [...dbData.challenges].sort((a, b) => Number(a.day) - Number(b.day));
  res.json(sorted.map(ch => formatChallengeForClient(ch, authUser)));
});

app.post('/api/challenges/day', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.challenges)) dbData.challenges = [];

    if (dbData.challenges.length >= MAX_CHALLENGE_DAYS) {
      return res.status(400).json({ error: "Maksimal 30 ta kun qo'shish mumkin (Day 1 - Day 30 to'ldi)." });
    }

    const sortedExisting = [...dbData.challenges].sort((a, b) => Number(a.day) - Number(b.day));
    let nextDay = Number(req.body?.day);
    if (!nextDay || nextDay < 1 || nextDay > MAX_CHALLENGE_DAYS || sortedExisting.some(c => Number(c.day) === nextDay)) {
      nextDay = 1;
      const usedDays = new Set(sortedExisting.map(c => Number(c.day)));
      while (usedDays.has(nextDay) && nextDay <= MAX_CHALLENGE_DAYS) nextDay++;
    }

    if (nextDay > MAX_CHALLENGE_DAYS) {
      return res.status(400).json({ error: "30 kunlik barcha kartalar allaqachon qo'shilgan." });
    }

    if (!req.body?.title || !String(req.body.title).trim()) {
      return res.status(400).json({ error: "Mavzu nomi kiritilishi shart." });
    }

    const newDay = normalizeChallengeDayPayload(req.body, nextDay, null);
    dbData.challenges.push(newDay);
    dbData.challenges.sort((a, b) => Number(a.day) - Number(b.day));
    dbData.challengesInitialized = true;
    writeLandingDB(dbData);

    if (req.body?.notifyStudents !== false) {
      try {
        const allStudents = await db.prisma.user.findMany({
          where: { role: 'student', status: { not: 'Chetlashtirilgan' } },
          select: { id: true }
        });
        const notifTitle = `30 day Challenge: Day ${nextDay} ochildi! 🏆`;
        const notifMsg = `"${newDay.title}" mavzusidagi yangi kunlik challenge qo'shildi! Mukofot: +${newDay.xp} XP, +${newDay.coins} Coin, +${newDay.streakBonus} Streak.`;
        for (const s of allStudents) {
          await sendNotificationToUser(s.id, notifTitle, notifMsg);
        }
      } catch (notifErr) {
        console.error('Challenge day notify error:', notifErr);
      }
    }

    broadcastToDashboard('challenge_update', { action: 'day_added', day: nextDay });
    broadcastToDashboard('progress_update', { source: 'challenge_day_added', day: nextDay });

    res.status(201).json({
      success: true,
      day: formatChallengeForClient(newDay),
      challenges: dbData.challenges.map(c => formatChallengeForClient(c))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/challenges/day/:day', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.challenges)) dbData.challenges = [];
    const dayNum = parseInt(req.params.day, 10);
    const idx = dbData.challenges.findIndex(c => Number(c.day) === dayNum);
    if (idx === -1) {
      return res.status(404).json({ error: `Day ${dayNum} topilmadi.` });
    }

    const existing = dbData.challenges[idx];
    const updated = normalizeChallengeDayPayload(req.body, dayNum, existing);
    dbData.challenges[idx] = updated;
    dbData.challenges.sort((a, b) => Number(a.day) - Number(b.day));
    writeLandingDB(dbData);

    if (req.body?.notifyStudents === true) {
      try {
        const allStudents = await db.prisma.user.findMany({
          where: { role: 'student', status: { not: 'Chetlashtirilgan' } },
          select: { id: true }
        });
        for (const s of allStudents) {
          await sendNotificationToUser(
            s.id,
            `30 day Challenge: Day ${dayNum} yangilandi! 🔔`,
            `"${updated.title}" vazifasi yangilandi. Kirib ko'rishingiz mumkin.`
          );
        }
      } catch (e) {}
    }

    broadcastToDashboard('challenge_update', { action: 'day_updated', day: dayNum });
    broadcastToDashboard('progress_update', { source: 'challenge_day_updated', day: dayNum });

    res.json({
      success: true,
      day: formatChallengeForClient(updated),
      challenges: dbData.challenges.map(c => formatChallengeForClient(c))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/challenges/day/:day', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.challenges)) dbData.challenges = [];
    const dayNum = parseInt(req.params.day, 10);
    const exists = dbData.challenges.some(c => Number(c.day) === dayNum);
    if (!exists) {
      return res.status(404).json({ error: `Day ${dayNum} topilmadi.` });
    }

    const remaining = dbData.challenges
      .filter(c => Number(c.day) !== dayNum)
      .sort((a, b) => Number(a.day) - Number(b.day))
      .map((c, idx) => ({ ...c, day: idx + 1 }));

    dbData.challenges = remaining;
    if (dbData.challengeProgressOverrides && typeof dbData.challengeProgressOverrides === 'object') {
      Object.keys(dbData.challengeProgressOverrides).forEach(uid => {
        const userMap = dbData.challengeProgressOverrides[uid];
        if (!userMap || typeof userMap !== 'object') return;
        const shifted = {};
        Object.entries(userMap).forEach(([dKey, val]) => {
          const dVal = parseInt(dKey, 10);
          if (!Number.isInteger(dVal)) return;
          if (dVal < dayNum) shifted[String(dVal)] = val;
          else if (dVal > dayNum) shifted[String(dVal - 1)] = val;
        });
        dbData.challengeProgressOverrides[uid] = shifted;
      });
    }
    writeLandingDB(dbData);
    broadcastToDashboard('challenge_update', { action: 'day_deleted', day: dayNum });
    broadcastToDashboard('progress_update', { source: 'challenge_day_deleted', day: dayNum });

    res.json({
      success: true,
      challenges: remaining.map(c => formatChallengeForClient(c))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/challenges/announce', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { announceTitle, announceMessage } = req.body || {};
    const allStudents = await db.prisma.user.findMany({
      where: { role: 'student', status: { not: 'Chetlashtirilgan' } },
      select: { id: true }
    });
    const title = String(announceTitle || "30 day Challenge boshlandi! 🏆").trim();
    const msg = String(announceMessage || "Admin tomonidan yangi 30 day Challenge e'lon qilindi! Har kuni vazifani bajarib Coin, Streak va XP ballar yuting.").trim();

    let count = 0;
    for (const s of allStudents) {
      const created = await sendNotificationToUser(s.id, title, msg);
      if (created) count++;
    }
    broadcastToDashboard('challenge_update', { action: 'announced', title, message: msg, recipientCount: count });
    res.json({ success: true, recipientCount: count, message: "Challenge e'lon qilindi va barcha talabalarga bildirishnoma yuborildi!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/challenges/admin-save', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const dbData = readLandingDB();
    const { challenges, announceTitle, announceMessage } = req.body || {};
    if (Array.isArray(challenges)) {
      dbData.challenges = challenges.map((c, idx) => normalizeChallengeDayPayload(c, c.day || idx + 1, c));
      dbData.challengesInitialized = true;
      writeLandingDB(dbData);
    }

    try {
      const allStudents = await db.prisma.user.findMany({
        where: { role: 'student', status: { not: 'Chetlashtirilgan' } },
        select: { id: true }
      });
      const title = announceTitle || "30 day Challenge boshlandi! 🏆";
      const msg = announceMessage || "Admin tomonidan yangi 30 day Challenge e'lon qilindi! Har kuni yangi vazifani bajaring va sovrinlar yuting.";
      for (const s of allStudents) {
        await sendNotificationToUser(s.id, title, msg);
      }
    } catch (e) {}

    broadcastToDashboard('challenge_update', { action: 'admin_saved' });
    broadcastToDashboard('progress_update', { source: 'challenge_admin_saved' });

    res.json({ success: true, challenges: (dbData.challenges || []).map(c => formatChallengeForClient(c)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/challenges/:day/complete', async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.challenges)) dbData.challenges = [];
    const dayNum = parseInt(req.params.day, 10);
    const ch = dbData.challenges.find(c => Number(c.day) === dayNum);
    if (!ch) {
      return res.status(404).json({ error: `Challenge Day ${dayNum} topilmadi.` });
    }

    const authUser = getOptionalAuthUser(req);
    const targetUserId = authUser?.id || await findStudentIdFromPayload(req.body || {});
    if (!targetUserId) {
      return res.status(401).json({ error: "Talaba aniqlanmadi. Iltimos tizimga qaytadan kiring." });
    }

    const targetUser = await db.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true } });
    if (targetUser?.role === 'student' && getStudentTariff(targetUser.id) === 'FREE') {
      return res.status(403).json({
        error: "Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak.",
        code: 'PREMIUM_REQUIRED'
      });
    }

    if (!Array.isArray(ch.completedBy)) ch.completedBy = [];
    if (!ch.submissions || typeof ch.submissions !== 'object') ch.submissions = {};

    if (ch.completedBy.includes(targetUserId)) {
      const user = await db.prisma.user.findUnique({ where: { id: targetUserId } });
      const stats = user ? normalizePeriodBuckets(user) : null;
      return res.json({
        success: true,
        alreadyCompleted: true,
        bonusPercent: ch.submissions[targetUserId]?.bonusPercent || 100,
        challenge: formatChallengeForClient(ch, { id: targetUserId }),
        awarded: { xp: 0, coins: 0, streak: 0 },
        userStats: stats
      });
    }

    const bonusEval = evaluateChallengeDeadlineBonus(ch);
    const isLate = bonusEval.status === 'expired';
    const multiplier = isLate ? 0 : (bonusEval.bonusPercent / 100);
    const baseXp = Number(ch.xp ?? 100) || 0;
    const baseCoins = Number(ch.coins ?? 30) || 0;
    const baseStreak = Number(ch.streakBonus ?? 2) || 0;

    const scaledXp = isLate ? 0 : Math.round(baseXp * multiplier);
    const scaledCoins = isLate ? 0 : Math.round(baseCoins * multiplier);
    const scaledStreak = (!isLate && baseStreak > 0) ? Math.max(1, Math.round(baseStreak * multiplier)) : 0;

    let awardResult = null;
    if (isLate) {
      const freshUser = await db.prisma.user.findUnique({ where: { id: targetUserId } });
      awardResult = {
        awardedXp: 0,
        awardedCoins: 0,
        awardedStreak: 0,
        userStats: freshUser ? normalizePeriodBuckets(freshUser) : null
      };
    } else {
      const eventId = `challenge_day_${dayNum}_${ch.id || 'v1'}`;
      awardResult = await awardStudentProgress({
        userId: targetUserId,
        eventKey: eventId,
        type: 'challenge',
        xp: scaledXp,
        coins: scaledCoins,
        streakBonus: scaledStreak,
        meta: {
          day: dayNum,
          title: ch.title,
          bonusPercent: bonusEval.bonusPercent,
          bonusStatus: bonusEval.status
        }
      });
    }

    const submissionRecord = {
      submittedAt: new Date().toISOString(),
      bonusPercent: isLate ? 0 : bonusEval.bonusPercent,
      bonusStatus: isLate ? 'late' : bonusEval.status,
      late: isLate,
      awarded: {
        xp: awardResult?.awardedXp ?? scaledXp,
        coins: awardResult?.awardedCoins ?? scaledCoins,
        streak: awardResult?.awardedStreak ?? scaledStreak
      },
      note: String(req.body?.note || '').trim().slice(0, 500)
    };

    ch.completedBy.push(targetUserId);
    ch.submissions[targetUserId] = submissionRecord;
    writeLandingDB(dbData);

    broadcastToDashboard('challenge_update', { action: 'completed', day: dayNum, userId: targetUserId, late: isLate });
    broadcastToDashboard('progress_update', { source: 'challenge_completed', day: dayNum, userId: targetUserId, late: isLate });

    res.json({
      success: true,
      late: isLate,
      bonusPercent: submissionRecord.bonusPercent,
      bonusStatus: submissionRecord.bonusStatus,
      challenge: formatChallengeForClient(ch, { id: targetUserId }),
      awarded: submissionRecord.awarded,
      userStats: awardResult?.userStats || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PROGRESS REPORTS API (Homework Report & 30-Day Challenges Report)
// ==========================================
function decodeProgressText(str) {
  return String(str || '')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function toTashkentYmd(dateVal) {
  if (!dateVal) return '';
  const dt = new Date(dateVal);
  if (isNaN(dt.getTime())) return '';
  return getTashkentDateStr(dt);
}

function formatYmdToDisplay(ymd) {
  if (!ymd || typeof ymd !== 'string') return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function doesTaskApplyToStudent(task, enrolledLowerSet, legacyCourseStr = '') {
  const rawList = Array.isArray(task?.courses) && task.courses.length > 0
    ? task.courses
    : (task?.courseTitle ? String(task.courseTitle).split(',') : []);
  const taskCourses = rawList
    .map(c => decodeProgressText(c).toLowerCase())
    .filter(Boolean);

  if (
    taskCourses.length === 0 ||
    taskCourses.some(c => ['all courses', 'all', 'barchasi', 'barcha kurslar', 'umumiy'].includes(c))
  ) {
    return true;
  }

  const legacyTokens = decodeProgressText(legacyCourseStr)
    .toLowerCase()
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return taskCourses.some(tc => enrolledLowerSet.has(tc) || legacyTokens.includes(tc));
}

function findTaskSubmissionForStudent(task, student) {
  const subs = Array.isArray(task?.submissions) ? task.submissions : [];
  const sId = String(student.id || '').trim();
  const sEmail = decodeProgressText(student.email || '').toLowerCase();
  const sPhone = decodeProgressText(student.phone || '').trim();
  const sName = decodeProgressText(student.name || '').toLowerCase();

  return subs.find(sub => {
    if (!sub) return false;
    if (sId && sub.studentId && String(sub.studentId).trim() === sId) return true;
    const subEmail = decodeProgressText(sub.studentEmail || '').toLowerCase();
    if (sEmail && subEmail && subEmail === sEmail) return true;
    const subPhone = decodeProgressText(sub.studentPhone || '').trim();
    if (sPhone && subPhone && subPhone === sPhone) return true;
    const subName = decodeProgressText(sub.studentName || '').toLowerCase();
    if (sName && subName && subName === sName) return true;
    return false;
  }) || null;
}

function evaluateTimingColor(submittedAt, deadline, explicitLate = false) {
  if (explicitLate) return 'yellow';
  if (!submittedAt) return 'red';
  if (!deadline) return 'green';
  const subMs = new Date(submittedAt).getTime();
  const dlMs = new Date(deadline).getTime();
  if (isNaN(subMs) || isNaN(dlMs)) return 'green';
  return subMs <= dlMs ? 'green' : 'yellow';
}

async function buildProgressReportsPayload(dbData, authUser = null) {
  const [rawStudents, allCatalogCourses] = await Promise.all([
    db.prisma.user.findMany({
      where: { role: 'student', status: { not: 'Chetlashtirilgan' } },
      include: { userCourses: { include: { course: true } } },
      orderBy: { createdAt: 'asc' }
    }),
    db.prisma.course.findMany({ select: { title: true } })
  ]);

  const tasks = Array.isArray(dbData?.tasks) ? dbData.tasks : [];
  const sortedTasks = [...tasks].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const homeworkTasksMeta = sortedTasks.map((t, idx) => {
    const dateIso = toTashkentYmd(t.createdAt) || toTashkentYmd(t.deadline);
    const deadlineIso = toTashkentYmd(t.deadline);
    return {
      id: t.id,
      index: idx + 1,
      title: decodeProgressText(t.title || `Homework ${idx + 1}`),
      label: `HW ${idx + 1}`,
      dateIso,
      dateDisplay: dateIso ? formatYmdToDisplay(dateIso) : '—',
      deadlineIso,
      deadlineDisplay: deadlineIso ? formatYmdToDisplay(deadlineIso) : '',
      deadline: t.deadline || null
    };
  });
  const challenges = [...(Array.isArray(dbData?.challenges) ? dbData.challenges : [])]
    .sort((a, b) => Number(a.day) - Number(b.day));
  const overrides = (dbData?.challengeProgressOverrides && typeof dbData.challengeProgressOverrides === 'object')
    ? dbData.challengeProgressOverrides
    : {};

  const challengeByDay = new Map();
  challenges.forEach(ch => {
    const d = Number(ch.day);
    if (d >= 1 && d <= MAX_CHALLENGE_DAYS) {
      challengeByDay.set(d, ch);
    }
  });

  const challengeDaysMeta = Array.from({ length: MAX_CHALLENGE_DAYS }, (_, idx) => {
    const dayNum = idx + 1;
    const ch = challengeByDay.get(dayNum);
    if (!ch) {
      return {
        day: dayNum,
        exists: false,
        title: `Day ${dayNum}`,
        dateIso: '',
        dateDisplay: '—',
        deadlineIso: '',
        deadlineDisplay: '',
        deadline: null,
        createdAt: null
      };
    }
    const dateIso = toTashkentYmd(ch.createdAt) || toTashkentYmd(ch.deadline);
    const deadlineIso = toTashkentYmd(ch.deadline);
    return {
      day: dayNum,
      exists: true,
      title: decodeProgressText(ch.title || `Day ${dayNum}`),
      dateIso,
      dateDisplay: dateIso ? formatYmdToDisplay(dateIso) : '—',
      deadlineIso,
      deadlineDisplay: deadlineIso ? formatYmdToDisplay(deadlineIso) : '',
      deadline: ch.deadline || null,
      createdAt: ch.createdAt || null
    };
  });

  const activeChallengeCreatedIsos = challengeDaysMeta
    .filter(m => m.exists && m.dateIso)
    .map(m => m.dateIso)
    .sort();
  const activeChallengeDeadlineIsos = challengeDaysMeta
    .filter(m => m.exists && m.deadlineIso)
    .map(m => m.deadlineIso)
    .sort();
  const latestChallengeDateIso = activeChallengeCreatedIsos.length
    ? activeChallengeCreatedIsos[activeChallengeCreatedIsos.length - 1]
    : '';
  const challengeDatesDisplay = activeChallengeCreatedIsos.length > 1
    ? `${formatYmdToDisplay(activeChallengeCreatedIsos[0])} - ${formatYmdToDisplay(activeChallengeCreatedIsos[activeChallengeCreatedIsos.length - 1])}`
    : (latestChallengeDateIso ? formatYmdToDisplay(latestChallengeDateIso) : '—');
  const challengeDateFilterIsos = Array.from(new Set([...activeChallengeCreatedIsos, ...activeChallengeDeadlineIsos]));

  const courseSet = new Set(
    allCatalogCourses.map(c => decodeProgressText(c.title)).filter(Boolean)
  );

  const rawHomeworkRows = [];
  const rawChallengesRows = [];

  for (const s of rawStudents) {
    const fullName = decodeProgressText(s.name || 'Talaba');
    const email = decodeProgressText(s.email || '');
    const enrolledList = Array.from(new Set([
      ...(Array.isArray(s.userCourses) ? s.userCourses.map(uc => decodeProgressText(uc.course?.title)) : []),
      ...decodeProgressText(s.course || '').split(',').map(x => x.trim())
    ].filter(Boolean)));
    enrolledList.forEach(c => courseSet.add(c));
    const enrolledLowerSet = new Set(enrolledList.map(c => c.toLowerCase()));
    const courseName = enrolledList.join(', ') || 'Biriktirilmagan';
    const tariff = getStudentTariff(s.id);

    // 1) Homework metrics
    const assignedTasks = tasks.filter(t => doesTaskApplyToStudent(t, enrolledLowerSet, s.course));
    let homeworkDone = 0;
    let homeworkNotDone = 0;
    let homeworkOnTime = 0;
    let homeworkLate = 0;
    const taskCreatedIsos = [];
    const taskFilterIsos = [];

    for (const t of assignedTasks) {
      const cIso = toTashkentYmd(t.createdAt) || toTashkentYmd(t.deadline);
      const dIso = toTashkentYmd(t.deadline);
      if (cIso) {
        taskCreatedIsos.push(cIso);
        taskFilterIsos.push(cIso);
      }
      if (dIso) taskFilterIsos.push(dIso);

      const sub = findTaskSubmissionForStudent(t, s);
      if (sub) {
        homeworkDone++;
        const c = evaluateTimingColor(sub.submittedAt, t.deadline, false);
        if (c === 'green') homeworkOnTime++;
        else homeworkLate++;
      } else {
        homeworkNotDone++;
      }
    }

    taskCreatedIsos.sort();
    const uniqueTaskIsos = Array.from(new Set(taskCreatedIsos));
    const homeworkAssignedDate = uniqueTaskIsos.length > 1
      ? `${formatYmdToDisplay(uniqueTaskIsos[0])} - ${formatYmdToDisplay(uniqueTaskIsos[uniqueTaskIsos.length - 1])}`
      : (uniqueTaskIsos[0] ? formatYmdToDisplay(uniqueTaskIsos[0]) : '—');
    const latestHomeworkDateIso = uniqueTaskIsos.length ? uniqueTaskIsos[uniqueTaskIsos.length - 1] : '';

    // 2) Challenges 30-day metrics (auto deadline + admin manual override)
    const studentOverrides = (overrides[s.id] && typeof overrides[s.id] === 'object') ? overrides[s.id] : {};
    let chGreenCount = 0;
    let chYellowCount = 0;
    let chRedCount = 0;
    let chManualCount = 0;

    const days = Array.from({ length: MAX_CHALLENGE_DAYS }, (_, idx) => {
      const dayNum = idx + 1;
      const ch = challengeByDay.get(dayNum);
      const rawOverride = studentOverrides[String(dayNum)];
      const manualColor = ['green', 'yellow', 'red'].includes(rawOverride) ? rawOverride : null;

      let autoColor = 'none';
      let submittedAt = null;
      let bonusPercent = null;
      let late = false;

      if (ch) {
        const subsObj = (ch.submissions && typeof ch.submissions === 'object') ? ch.submissions : {};
        const sub = subsObj[s.id] || null;
        const completedArr = Array.isArray(ch.completedBy) ? ch.completedBy : [];
        const isCompleted = Boolean(sub) || completedArr.includes(s.id);

        if (isCompleted) {
          submittedAt = sub?.submittedAt || null;
          bonusPercent = sub?.bonusPercent ?? (sub?.late ? 0 : 100);
          late = Boolean(sub?.late || sub?.bonusStatus === 'late' || sub?.bonusStatus === 'expired');
          autoColor = evaluateTimingColor(submittedAt, ch.deadline, late);
        } else {
          autoColor = 'red';
        }
      }

      const effectiveColor = manualColor || autoColor;
      if (manualColor) chManualCount++;

      if (ch || manualColor) {
        if (effectiveColor === 'green') chGreenCount++;
        else if (effectiveColor === 'yellow') chYellowCount++;
        else if (effectiveColor === 'red') chRedCount++;
      }

      const meta = challengeDaysMeta[idx];
      return {
        day: dayNum,
        exists: Boolean(ch),
        dateIso: meta.dateIso,
        deadlineIso: meta.deadlineIso,
        dateDisplay: meta.dateDisplay,
        autoColor,
        manualColor,
        effectiveColor,
        submittedAt,
        bonusPercent,
        late
      };
    });

    const existingDays = days.filter(d => d.exists);
    const challengeDoneExisting = existingDays.filter(d => d.effectiveColor === 'green' || d.effectiveColor === 'yellow').length;
    const challengeOnTime = existingDays.filter(d => d.effectiveColor === 'green').length;
    const challengeLate = existingDays.filter(d => d.effectiveColor === 'yellow').length;
    const challengeNotDone = existingDays.filter(d => d.effectiveColor === 'red').length;
    const challengeTotal = existingDays.length;

    const challengeDoneForRank = chGreenCount + chYellowCount;
    const homeworkTotal = assignedTasks.length;
    const totalAssigned = homeworkTotal + challengeTotal;
    const totalCompleted = homeworkDone + challengeDoneExisting;
    const totalOnTime = homeworkOnTime + challengeOnTime;

    let rowColor = 'none';
    if (totalAssigned > 0) {
      if (totalCompleted === 0) {
        rowColor = 'red';
      } else if (homeworkNotDone === 0 && challengeNotDone === 0 && homeworkLate === 0 && challengeLate === 0) {
        rowColor = 'green';
      } else {
        rowColor = 'yellow';
      }
    }

    const homeworkCells = homeworkTasksMeta.map(meta => {
      const t = sortedTasks.find(x => String(x.id) === String(meta.id));
      if (!t) return { taskId: meta.id, index: meta.index, effectiveColor: 'none' };
      const applies = doesTaskApplyToStudent(t, enrolledLowerSet, s.course);
      if (!applies) {
        return {
          taskId: meta.id,
          index: meta.index,
          title: meta.title,
          label: meta.label,
          dateDisplay: meta.dateDisplay,
          effectiveColor: 'none',
          statusText: 'Biriktirilmagan'
        };
      }
      const sub = findTaskSubmissionForStudent(t, s);
      let effectiveColor = 'none';
      if (sub) {
        const c = evaluateTimingColor(sub.submittedAt, t.deadline, false);
        effectiveColor = c === 'green' ? 'green' : 'yellow';
      } else {
        effectiveColor = 'red'; // 7-talab: Topshirilmagan bo'lsa qizil rang
      }
      return {
        taskId: meta.id,
        index: meta.index,
        title: meta.title,
        label: meta.label,
        dateDisplay: meta.dateDisplay,
        effectiveColor,
        submittedAt: sub?.submittedAt || null,
        grade: sub?.grade || null
      };
    });

    const isSelf = authUser?.id ? String(s.id) === String(authUser.id) : false;

    rawHomeworkRows.push({
      userId: s.id,
      fullName,
      email,
      courseName,
      courses: enrolledList,
      tariff,
      isSelf,
      homeworkDate: homeworkAssignedDate,
      homeworkDateIso: latestHomeworkDateIso,
      homeworkDateIsos: Array.from(new Set(taskFilterIsos)),
      homeworkDone,
      homeworkNotDone,
      homeworkTotal,
      homeworkOnTime,
      homeworkLate,
      challengesDate: challengeDatesDisplay,
      challengesDateIso: latestChallengeDateIso,
      challengeDateIsos: challengeDateFilterIsos,
      challengeDone: challengeDoneExisting,
      challengeNotDone,
      challengeTotal,
      challengeOnTime,
      challengeLate,
      totalCompleted,
      totalAssigned,
      totalOnTime,
      rowColor,
      days: homeworkCells,
      taskCells: homeworkCells
    });

    rawChallengesRows.push({
      userId: s.id,
      fullName,
      email,
      courseName,
      courses: enrolledList,
      tariff,
      isSelf,
      completedCount: challengeDoneForRank,
      greenCount: chGreenCount,
      yellowCount: chYellowCount,
      redCount: chRedCount,
      manualOverrideCount: chManualCount,
      challengeTotal,
      days
    });
  }

  rawHomeworkRows.sort((a, b) =>
    (b.totalCompleted - a.totalCompleted) ||
    (b.totalOnTime - a.totalOnTime) ||
    (b.homeworkDone - a.homeworkDone) ||
    (b.challengeDone - a.challengeDone) ||
    a.fullName.localeCompare(b.fullName, 'uz')
  );
  const homeworkReport = rawHomeworkRows.map((row, idx) => ({ ...row, rank: idx + 1 }));

  rawChallengesRows.sort((a, b) =>
    (b.completedCount - a.completedCount) ||
    (b.greenCount - a.greenCount) ||
    (b.yellowCount - a.yellowCount) ||
    a.fullName.localeCompare(b.fullName, 'uz')
  );
  const challengesReport = rawChallengesRows.map((row, idx) => ({ ...row, rank: idx + 1 }));

  const myHomeworkRow = authUser?.id ? homeworkReport.find(r => r.userId === authUser.id) : null;
  const myChallengesRow = authUser?.id ? challengesReport.find(r => r.userId === authUser.id) : null;

  return {
    generatedAt: new Date().toISOString(),
    challengeDaysMeta,
    homeworkTasksMeta,
    courses: Array.from(courseSet).sort((a, b) => a.localeCompare(b, 'uz')),
    totalStudents: homeworkReport.length,
    myStudentId: authUser?.role === 'student' ? authUser.id : null,
    myHomeworkRank: myHomeworkRow?.rank || null,
    myChallengesRank: myChallengesRow?.rank || null,
    homeworkReport,
    challengesReport
  };
}

app.get('/api/progress', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'student' && getStudentTariff(req.user.id) === 'FREE') {
      return res.status(403).json({
        error: "Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak.",
        code: 'PREMIUM_REQUIRED'
      });
    }
    const dbData = readLandingDB();
    const payload = await buildProgressReportsPayload(dbData, req.user);
    res.json(payload);
  } catch (err) {
    console.error('Progress GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/progress/challenges/override', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const dayNum = parseInt(req.body?.day, 10);
    const rawColor = String(req.body?.color || '').trim().toLowerCase();

    if (!userId) {
      return res.status(400).json({ error: 'Talaba ID si kiritilishi shart.' });
    }
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > MAX_CHALLENGE_DAYS) {
      return res.status(400).json({ error: `Kun 1 dan ${MAX_CHALLENGE_DAYS} gacha bo'lishi kerak.` });
    }
    if (!['green', 'yellow', 'red', 'auto', 'clear', 'none', ''].includes(rawColor)) {
      return res.status(400).json({ error: "Rang faqat 'green', 'yellow', 'red' yoki 'auto' bo'lishi mumkin." });
    }

    const targetStudent = await db.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!targetStudent) {
      return res.status(404).json({ error: 'Talaba topilmadi.' });
    }

    const dbData = readLandingDB();
    if (!dbData.challengeProgressOverrides || typeof dbData.challengeProgressOverrides !== 'object') {
      dbData.challengeProgressOverrides = {};
    }
    if (!dbData.challengeProgressOverrides[userId] || typeof dbData.challengeProgressOverrides[userId] !== 'object') {
      dbData.challengeProgressOverrides[userId] = {};
    }

    if (['green', 'yellow', 'red'].includes(rawColor)) {
      dbData.challengeProgressOverrides[userId][String(dayNum)] = rawColor;
    } else {
      delete dbData.challengeProgressOverrides[userId][String(dayNum)];
      if (Object.keys(dbData.challengeProgressOverrides[userId]).length === 0) {
        delete dbData.challengeProgressOverrides[userId];
      }
    }

    writeLandingDB(dbData);
    broadcastToDashboard('progress_update', {
      source: 'manual_challenge_override',
      userId,
      day: dayNum,
      color: ['green', 'yellow', 'red'].includes(rawColor) ? rawColor : 'auto'
    });

    const updatedPayload = await buildProgressReportsPayload(dbData, req.user);
    res.json({ success: true, ...updatedPayload });
  } catch (err) {
    console.error('Challenge override error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Scheduled Push Notifications API (Max 10 per day)
app.get('/api/push-notifications', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await processDueScheduledPushes();
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.scheduledPushes)) dbData.scheduledPushes = [];

    const todayDate = getTashkentDateStr();
    const items = [...dbData.scheduledPushes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const dailyCount = items.filter(p => p.usageDate === todayDate && p.status !== 'cancelled').length;

    res.json({
      items,
      dailyCount,
      dailyLimit: DAILY_PUSH_LIMIT,
      remaining: Math.max(0, DAILY_PUSH_LIMIT - dailyCount),
      todayDate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push-notifications', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.scheduledPushes)) dbData.scheduledPushes = [];

    const todayDate = getTashkentDateStr();
    const dailyCount = dbData.scheduledPushes.filter(p => p.usageDate === todayDate && p.status !== 'cancelled').length;

    if (dailyCount >= DAILY_PUSH_LIMIT) {
      return res.status(429).json({
        error: "Kunlik limitingiz tugadi! Bir kunda maksimal 10 ta push bildirishnoma yuborish mumkin. Keyingi kuni yana 10 ta yuborishingiz mumkin.",
        limitReached: true,
        dailyCount,
        dailyLimit: DAILY_PUSH_LIMIT,
        remaining: 0,
        todayDate
      });
    }

    const { title, message, scheduledAt } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Bildirishnoma matni kiritilishi shart." });
    }

    let targetIso = new Date().toISOString();
    if (scheduledAt) {
      const parsedDate = new Date(scheduledAt);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: "Noto'g'ri sana yoki vaqt formati." });
      }
      targetIso = parsedDate.toISOString();
    }

    const newPush = {
      id: `push_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: String(title || "Admin push bildirishnomasi 🔔").trim(),
      message: String(message).trim(),
      scheduledAt: targetIso,
      createdAt: new Date().toISOString(),
      usageDate: todayDate,
      status: 'pending',
      sentAt: null,
      recipientCount: 0
    };

    dbData.scheduledPushes.unshift(newPush);
    writeLandingDB(dbData);

    if (new Date(targetIso).getTime() <= Date.now()) {
      await processDueScheduledPushes();
    }

    const latestDb = readLandingDB();
    const savedItem = (latestDb.scheduledPushes || []).find(p => p.id === newPush.id) || newPush;
    const updatedDailyCount = (latestDb.scheduledPushes || []).filter(p => p.usageDate === todayDate && p.status !== 'cancelled').length;

    res.status(201).json({
      success: true,
      item: savedItem,
      dailyCount: updatedDailyCount,
      dailyLimit: DAILY_PUSH_LIMIT,
      remaining: Math.max(0, DAILY_PUSH_LIMIT - updatedDailyCount),
      todayDate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/push-notifications/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.scheduledPushes)) dbData.scheduledPushes = [];
    const idx = dbData.scheduledPushes.findIndex(p => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Bildirishnoma topilmadi." });
    }
    const target = dbData.scheduledPushes[idx];
    if (target.status === 'sent') {
      return res.status(400).json({ error: "Allaqachon yuborilgan push bildirishnomani bekor qilib bo'lmaydi." });
    }
    target.status = 'cancelled';
    target.cancelledAt = new Date().toISOString();
    writeLandingDB(dbData);

    const todayDate = getTashkentDateStr();
    const dailyCount = dbData.scheduledPushes.filter(p => p.usageDate === todayDate && p.status !== 'cancelled').length;
    res.json({
      success: true,
      dailyCount,
      dailyLimit: DAILY_PUSH_LIMIT,
      remaining: Math.max(0, DAILY_PUSH_LIMIT - dailyCount)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. GAMIFICATION & REAL-TIME LEADERBOARD API
// ==========================================
app.post('/api/gamification/award', authenticateToken, async (req, res) => {
  try {
    const { type, eventKey, xp = 0, coins = 0, meta = null, allowDuplicate = false } = req.body || {};
    const allowedTypes = ['practise', 'games', 'battle', 'live_class', 'speaking', 'grammar', 'vocabulary', 'daily_login'];
    const safeType = allowedTypes.includes(type) ? type : 'practise';

    const maxXp = safeType === 'vocabulary' ? 500 : 100;
    const safeXp = Math.min(maxXp, Math.max(0, Math.round(Number(xp) || 0)));
    const safeCoins = Math.min(50, Math.max(0, Math.round(Number(coins) || 0)));

    const isRepeatable = Boolean(allowDuplicate) && ['practise', 'games', 'battle', 'speaking', 'vocabulary'].includes(safeType);
    const result = await awardStudentProgress({
      userId: req.user.id,
      eventKey: eventKey || `${safeType}_${Date.now()}`,
      type: safeType,
      xp: safeXp,
      coins: safeCoins,
      meta,
      countStreak: true,
      allowDuplicate: isRepeatable
    });

    res.json({
      success: true,
      alreadyAwarded: result?.alreadyAwarded || false,
      awarded: { xp: result?.awardedXp || 0, coins: result?.awardedCoins || 0 },
      userStats: result?.userStats || null
    });
  } catch (err) {
    console.error('Gamification award error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vocabulary/progress', authenticateToken, async (req, res) => {
  try {
    const events = await db.prisma.gamificationEvent.findMany({
      where: { userId: String(req.user.id), type: 'vocabulary' },
      select: { eventKey: true, xp: true, coins: true, meta: true }
    });
    const completedWordIds = [];
    const lessonXpMap = {};
    const lessonTasksMap = {};
    let earnedXp = 0;
    let earnedCoins = 0;
    for (const ev of events) {
      const evXp = Number(ev.xp) || 0;
      earnedXp += evXp;
      earnedCoins += Number(ev.coins) || 0;
      if (ev.eventKey?.startsWith('vocab_word_')) {
        completedWordIds.push(ev.eventKey.slice('vocab_word_'.length));
      }
      if (ev.meta) {
        try {
          const parsed = JSON.parse(ev.meta);
          if (parsed?.lessonId) {
            const lid = String(parsed.lessonId);
            lessonXpMap[lid] = (lessonXpMap[lid] || 0) + evXp;
            lessonTasksMap[lid] = (lessonTasksMap[lid] || 0) + 1;
          }
        } catch (e) {}
      }
    }
    res.json({ completedWordIds, earnedXp, earnedCoins, lessonXpMap, lessonTasksMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const authUser = getOptionalAuthUser(req);
    const period = (req.query.period || 'all').toLowerCase(); // 'daily' | 'weekly' | 'monthly' | 'all'
    const sortBy = (req.query.sortBy || 'xp').toLowerCase(); // 'xp' | 'coins' | 'streak'
    const courseFilter = req.query.course || 'all';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    const students = await db.prisma.user.findMany({
      where: {
        role: 'student',
        status: { not: 'Chetlashtirilgan' }
      },
      include: {
        userCourses: { include: { course: true } },
        _count: {
          select: {
            completedLessons: true,
            submissions: true
          }
        },
        ...(startDate || endDate ? {
          gamificationEvents: {
            select: { xp: true, coins: true, createdAt: true }
          }
        } : {})
      }
    });

    const todayStr = getTashkentDateStr();

    let rows = students.map(u => {
      const buckets = normalizePeriodBuckets(u, todayStr);
      const courseNames = u.userCourses.map(uc => uc.course.title);
      const displayCourse = courseNames.join(', ') || u.course || 'General English Speaking & Fluency';

      let displayXp = buckets.xp;
      if (period === 'daily') displayXp = buckets.dailyXp;
      else if (period === 'weekly') displayXp = buckets.weeklyXp;
      else if (period === 'monthly') displayXp = buckets.monthlyXp;

      if ((startDate || endDate) && Array.isArray(u.gamificationEvents)) {
        const startMs = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
        const endMs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
        displayXp = u.gamificationEvents
          .filter(ev => {
            const t = new Date(ev.createdAt).getTime();
            if (startMs && t < startMs) return false;
            if (endMs && t > endMs) return false;
            return true;
          })
          .reduce((sum, ev) => sum + (ev.xp || 0), 0);
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop',
        course: displayCourse,
        courses: courseNames,
        date: u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU').replace(/\./g, '-') : '',
        createdAt: u.createdAt,
        streak: buckets.streak,
        coins: buckets.coins,
        xp: buckets.xp,
        dailyXp: buckets.dailyXp,
        weeklyXp: buckets.weeklyXp,
        monthlyXp: buckets.monthlyXp,
        displayXp,
        activityDates: buckets.activityDates,
        completedLessonsCount: u._count?.completedLessons || 0,
        submissionsCount: u._count?.submissions || 0,
        isYou: authUser?.id ? u.id === authUser.id : false
      };
    });

    if (courseFilter && courseFilter !== 'all') {
      rows = rows.filter(r => r.course.toLowerCase().includes(courseFilter.toLowerCase()));
    }

    rows.sort((a, b) => {
      if (sortBy === 'coins') return (b.coins - a.coins) || (b.displayXp - a.displayXp);
      if (sortBy === 'streak') return (b.streak - a.streak) || (b.displayXp - a.displayXp);
      return (b.displayXp - a.displayXp) || (b.xp - a.xp) || (b.streak - a.streak);
    });

    const ranked = rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
    const currentUserEntry = ranked.find(r => r.isYou) || null;

    res.json({
      leaderboard: ranked,
      totalStudents: ranked.length,
      currentUserRank: currentUserEntry?.rank || null,
      currentUserStats: currentUserEntry ? {
        xp: currentUserEntry.xp,
        coins: currentUserEntry.coins,
        streak: currentUserEntry.streak,
        dailyXp: currentUserEntry.dailyXp,
        weeklyXp: currentUserEntry.weeklyXp,
        monthlyXp: currentUserEntry.monthlyXp
      } : null
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reset ALL students' Streak, Coins, and XP to 0 in real-time sync
app.post('/api/leaderboard/reset', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const todayStr = getTashkentDateStr();
    const resetAt = new Date().toISOString();

    const [deletedEvents, updatedStudents] = await db.prisma.$transaction([
      db.prisma.gamificationEvent.deleteMany({
        where: { user: { role: 'student' } }
      }),
      db.prisma.user.updateMany({
        where: { role: 'student' },
        data: {
          xp: 0,
          coins: 0,
          streak: 0,
          dailyXp: 0,
          weeklyXp: 0,
          monthlyXp: 0,
          lastActivityDate: null,
          lastXpResetDate: null,
          activityDates: '[]'
        }
      })
    ]);

    const dbData = readLandingDB();
    dbData.gamificationResetDate = todayStr;
    dbData.gamificationResetAt = resetAt;
    dbData.gamificationResetBy = req.user?.email || 'admin';
    writeLandingDB(dbData);

    const zeroStats = {
      xp: 0,
      coins: 0,
      streak: 0,
      dailyXp: 0,
      weeklyXp: 0,
      monthlyXp: 0,
      activityDates: []
    };

    broadcastToDashboard('leaderboard_reset', {
      resetAt,
      resetDate: todayStr,
      affectedStudents: updatedStudents.count,
      clearedEvents: deletedEvents.count
    });
    broadcastToDashboard('gamification_update', {
      resetAll: true,
      ...zeroStats
    });

    res.json({
      success: true,
      affectedStudents: updatedStudents.count,
      clearedEvents: deletedEvents.count,
      resetAt,
      resetDate: todayStr,
      message: "Barcha talabalarning Streak, Coin va XP ko'rsatkichlari nolga (0) tushirildi."
    });
  } catch (err) {
    console.error('Leaderboard reset error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. LIVE 2-PLAYER BATTLE API (Real Matchmaking + Push + 5 MCQ + Coins)
// ==========================================
const BATTLE_QUESTION_BANK = [
  { id: 'bq1', q: 'IELTS Speaking Part 2 da fikrni tabiiy boshlash uchun qaysi ibora eng mos?', options: ['I want say about it.', 'I\'d like to tell you about...', 'Topic is this.', 'No idea about topic.'], correct: 1 },
  { id: 'bq2', q: '"I haven\'t seen him in ages" iborasi nimani anglatadi?', options: ['Men uni ancha yillardan beri ko\'rmadim', 'U juda qari odam', 'Men uni kecha ko\'rdim', 'Men uni tanimayman'], correct: 0 },
  { id: 'bq3', q: 'Suhbatdosh fikriga muloyim tarzda qo\'shilmaslik uchun qaysi ibora ishlatiladi?', options: ['You are totally wrong!', 'I see your point, however I tend to think differently.', 'Never say that!', 'I don\'t care.'], correct: 1 },
  { id: 'bq4', q: '"Eloquent" so\'zining ma\'nosiga eng yaqin sinonim qaysi?', options: ['Boring', 'Articulate', 'Silent', 'Careless'], correct: 1 },
  { id: 'bq5', q: '"Break the ice" idiomasi suhbatda nimani bildiradi?', options: ['Muzni sindirish', 'Ilk suhbatdagi noqulaylikni yo\'qotish', 'Sovuq choy ichish', 'Janjal chiqarish'], correct: 1 },
  { id: 'bq6', q: '"Once in a blue moon" iborasi qanday ma\'noda qo\'llanadi?', options: ['Har kuni muntazam', 'Juda kamdan-kam hollarda', 'Kecha tunda', 'Oy yorug\'ida'], correct: 1 },
  { id: 'bq7', q: '"Get across" phrasal verb nimani anglatadi?', options: ['Fikrni aniq yetkazish', 'Kechikib kelish', 'Ko\'prikdan sakrash', 'Rad etish'], correct: 0 },
  { id: 'bq8', q: '"Hit the nail on the head" qachon ishlatiladi?', options: ['Xato javob berganda', 'Aynan to\'g\'ri fikrni topib aytganda', 'Mix qoqqanda', 'Charchaganda'], correct: 1 },
  { id: 'bq9', q: '"Piece of cake" iborasining to\'g\'ri ma\'nosi qaysi?', options: ['Juda qiyin masala', 'Shirinlik pishirish', 'Juda oson ish', 'Qimmat sovg\'a'], correct: 2 },
  { id: 'bq10', q: 'Qaysi so\'zda "t" harfi o\'qilmaydi (silent letter)?', options: ['Start', 'Listen', 'Speak', 'Letter'], correct: 1 },
  { id: 'bq11', q: '"Resilient" so\'zining ingliz tilidagi to\'g\'ri ma\'nosi nima?', options: ['Tez sinadigan', 'Qiyinchilikdan tez tiklanuvchi va chidamli', 'Dangasa', 'Shubhali'], correct: 1 },
  { id: 'bq12', q: 'Do\'stona suhbatda "How have you been keeping?" savoliga tabiiy javob:', options: ['I am keeping a book.', 'I\'ve been doing great, thanks!', 'Yes, yesterday night.', 'In the supermarket.'], correct: 1 },
  { id: 'bq13', q: '"Look forward to" iborasidan keyin fe\'l qanday shaklda keladi?', options: ['Infinitive (go)', 'Gerund (-ing, meeting)', 'Past simple (went)', 'Base form with to'], correct: 1 },
  { id: 'bq14', q: '"Bite the bullet" idiomasi nimani anglatadi?', options: ['Qiyin vaziyatga mardona chidab kirishish', 'Tez ovqatlanish', 'So\'zlarni unutish', 'Qochib ketish'], correct: 0 },
  { id: 'bq15', q: 'Ingliz tilida fikrni davom ettirish (filler) uchun eng yaxshi ibora:', options: ['As a matter of fact...', 'Close the door...', 'Never mind nothing...', 'Wait ten days...'], correct: 0 },
  { id: 'bq16', q: '"Pros and cons" iborasi nimani bildiradi?', options: ['Ish va dam olish', 'Afzallik va kamchiliklar', 'Savol va javoblar', 'Kirish va chiqish'], correct: 1 },
  { id: 'bq17', q: '"Make up one\'s mind" nimani anglatadi?', options: ['Qaror qabul qilish', 'Pardoz qilish', 'Uxlab qolish', 'Fikrdan qaytish'], correct: 0 },
  { id: 'bq18', q: '"Fluent in English" iborasining tarjimasi qaysi?', options: ['Ingliz tilini yangi boshlagan', 'Ingliz tilida ravon va erkin so\'zlashuvchi', 'Faqat yozishni biladigan', 'Tarjimonlik kasbi'], correct: 1 }
];

function pickBattleQuestions(count = 5) {
  const pool = [...BATTLE_QUESTION_BANK];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function formatBattleForClient(battle, viewerId = null) {
  if (!battle) return null;
  const isChallenger = viewerId && battle.challengerId === viewerId;
  const isOpponent = viewerId && battle.opponentId === viewerId;
  const myAnswers = isChallenger
    ? (battle.challengerAnswers || [])
    : (isOpponent ? (battle.opponentAnswers || []) : []);
  const answeredSet = new Set(myAnswers.map(a => Number(a.qIndex)));

  const safeQuestions = (battle.questions || []).map((q, idx) => {
    const revealAnswer = battle.status === 'completed' || answeredSet.has(idx);
    return {
      id: q.id,
      q: q.q,
      options: q.options,
      ...(revealAnswer ? { correct: q.correct } : {})
    };
  });

  return {
    id: battle.id,
    status: battle.status,
    coinPerCorrect: battle.coinPerCorrect ?? 10,
    xpPerCorrect: battle.xpPerCorrect ?? 10,
    totalQuestions: (battle.questions || []).length || 5,
    challengerId: battle.challengerId,
    challengerName: battle.challengerName,
    challengerAvatar: battle.challengerAvatar,
    challengerXp: battle.challengerXp || 0,
    opponentId: battle.opponentId,
    opponentName: battle.opponentName,
    opponentAvatar: battle.opponentAvatar,
    opponentXp: battle.opponentXp || 0,
    challengerScore: battle.challengerScore || 0,
    opponentScore: battle.opponentScore || 0,
    challengerCoinsEarned: battle.challengerCoinsEarned || 0,
    opponentCoinsEarned: battle.opponentCoinsEarned || 0,
    challengerAnsweredCount: (battle.challengerAnswers || []).length,
    opponentAnsweredCount: (battle.opponentAnswers || []).length,
    challengerAnswers: battle.status === 'completed' || isChallenger ? (battle.challengerAnswers || []) : [],
    opponentAnswers: battle.status === 'completed' || isOpponent ? (battle.opponentAnswers || []) : [],
    winnerId: battle.winnerId || null,
    createdAt: battle.createdAt,
    acceptedAt: battle.acceptedAt || null,
    completedAt: battle.completedAt || null,
    questions: safeQuestions
  };
}

app.get('/api/battle/opponents', authenticateToken, async (req, res) => {
  try {
    const opponents = await db.prisma.user.findMany({
      where: {
        role: 'student',
        status: { not: 'Chetlashtirilgan' },
        id: { not: req.user.id }
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        course: true,
        xp: true,
        coins: true,
        streak: true
      }
    });
    res.json({ opponents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/battle/my', authenticateToken, async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.battles)) dbData.battles = [];

    const uid = req.user.id;
    const myBattles = dbData.battles.filter(b => b.challengerId === uid || b.opponentId === uid);
    const sortNewest = (arr) => [...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const activeBattle = sortNewest(myBattles.filter(b => b.status === 'active'))[0] || null;
    const incomingInvites = sortNewest(myBattles.filter(b => b.opponentId === uid && b.status === 'pending'));
    const outgoingPending = sortNewest(myBattles.filter(b => b.challengerId === uid && b.status === 'pending'))[0] || null;
    const history = sortNewest(myBattles.filter(b => b.status === 'completed')).slice(0, 15);
    const latestCompleted = history[0] || null;

    const opponents = await db.prisma.user.findMany({
      where: {
        role: 'student',
        status: { not: 'Chetlashtirilgan' },
        id: { not: uid }
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        course: true,
        xp: true,
        coins: true,
        streak: true
      }
    });

    res.json({
      opponents,
      activeBattle: formatBattleForClient(activeBattle, uid),
      incomingInvites: incomingInvites.map(b => formatBattleForClient(b, uid)),
      outgoingPending: formatBattleForClient(outgoingPending, uid),
      latestCompleted: formatBattleForClient(latestCompleted, uid),
      history: history.map(b => formatBattleForClient(b, uid))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battle/find', authenticateToken, async (req, res) => {
  try {
    const me = await db.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!me) return res.status(404).json({ error: 'Talaba topilmadi.' });

    const allCandidates = await db.prisma.user.findMany({
      where: {
        role: 'student',
        status: { not: 'Chetlashtirilgan' },
        id: { not: me.id }
      },
      select: { id: true, name: true, email: true, avatar: true, course: true, xp: true, coins: true, streak: true }
    });

    if (allCandidates.length === 0) {
      return res.status(400).json({ error: "Hozircha musobaqa uchun boshqa faol talaba topilmadi." });
    }

    const dbData = readLandingDB();
    if (!Array.isArray(dbData.battles)) dbData.battles = [];

    // If user already has an active battle, return it cleanly
    const existingActive = dbData.battles.find(
      b => (b.challengerId === me.id || b.opponentId === me.id) && b.status === 'active'
    );
    if (existingActive) {
      return res.json({ battle: formatBattleForClient(existingActive, me.id), alreadyActive: true });
    }

    const requestedOppId = req.body?.opponentId;
    let opponent = requestedOppId
      ? allCandidates.find(c => c.id === requestedOppId)
      : null;

    if (!opponent) {
      // Pick random eligible classmate (prefer online/real classmates cleanly)
      opponent = allCandidates[Math.floor(Math.random() * allCandidates.length)];
    }

    // Cancel stale previous pending invites initiated by me so only the newest matchmaking invite stays open
    dbData.battles.forEach(b => {
      if (b.challengerId === me.id && b.status === 'pending') {
        b.status = 'cancelled';
        b.updatedAt = new Date().toISOString();
      }
    });

    const newBattle = {
      id: `battle_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
      coinPerCorrect: 10,
      xpPerCorrect: 10,
      challengerId: me.id,
      challengerName: me.name,
      challengerAvatar: me.avatar || '',
      challengerXp: me.xp || 0,
      opponentId: opponent.id,
      opponentName: opponent.name,
      opponentAvatar: opponent.avatar || '',
      opponentXp: opponent.xp || 0,
      questions: pickBattleQuestions(5),
      challengerAnswers: [],
      opponentAnswers: [],
      challengerScore: 0,
      opponentScore: 0,
      challengerCoinsEarned: 0,
      opponentCoinsEarned: 0,
      winnerId: null,
      createdAt: new Date().toISOString(),
      acceptedAt: null,
      completedAt: null
    };

    dbData.battles.unshift(newBattle);
    dbData.battles = dbData.battles.slice(0, 150);
    writeLandingDB(dbData);

    // Send automatic push notification to the matched opponent asking to accept/confirm battle
    await sendNotificationToUser(
      opponent.id,
      `⚔️ Battle taklifi! (${me.name})`,
      `${me.name} sizni 5 ta MCQ savollik 1v1 ingliz tili bellashuviga chaqirdi! Har bir to'g'ri javob uchun +${newBattle.coinPerCorrect} Coin beriladi. Jangni qabul qilasizmi? [battle:${newBattle.id}]`
    );

    broadcastToDashboard('battle_invite', {
      targetUserId: opponent.id,
      challengerId: me.id,
      challengerName: me.name,
      battleId: newBattle.id,
      coinPerCorrect: newBattle.coinPerCorrect
    });

    res.status(201).json({
      success: true,
      battle: formatBattleForClient(newBattle, me.id)
    });
  } catch (err) {
    console.error('Battle find error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/battle/:id', authenticateToken, (req, res) => {
  const dbData = readLandingDB();
  if (!Array.isArray(dbData.battles)) dbData.battles = [];
  const battle = dbData.battles.find(b => b.id === req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle topilmadi.' });
  if (battle.challengerId !== req.user.id && battle.opponentId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Siz ushbu bellashuv ishtirokchisi emassiz.' });
  }
  res.json({ battle: formatBattleForClient(battle, req.user.id) });
});

app.post('/api/battle/:id/respond', authenticateToken, async (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.battles)) dbData.battles = [];
    const battle = dbData.battles.find(b => b.id === req.params.id);
    if (!battle) return res.status(404).json({ error: 'Battle topilmadi.' });

    if (battle.opponentId !== req.user.id) {
      return res.status(403).json({ error: 'Ushbu taklifga faqat chaqirilgan raqib javob bera oladi.' });
    }
    if (battle.status !== 'pending') {
      return res.json({
        success: true,
        alreadyProcessed: true,
        battle: formatBattleForClient(battle, req.user.id)
      });
    }

    const action = req.body?.action === 'decline' ? 'decline' : 'accept';
    battle.status = action === 'accept' ? 'active' : 'declined';
    battle.updatedAt = new Date().toISOString();
    if (action === 'accept') {
      battle.acceptedAt = battle.updatedAt;
    }

    writeLandingDB(dbData);

    await sendNotificationToUser(
      battle.challengerId,
      action === 'accept' ? '⚔️ Battle qabul qilindi!' : 'Battle rad etildi',
      action === 'accept'
        ? `${battle.opponentName} jangni qabul qildi! 5 ta MCQ savol bo'yicha bellashuv boshlandi.`
        : `${battle.opponentName} hozircha jang taklifini rad etdi.`
    );

    broadcastToDashboard('battle_update', {
      battleId: battle.id,
      status: battle.status,
      challengerId: battle.challengerId,
      opponentId: battle.opponentId
    });

    res.json({
      success: true,
      battle: formatBattleForClient(battle, req.user.id)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battle/:id/cancel', authenticateToken, (req, res) => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.battles)) dbData.battles = [];
    const battle = dbData.battles.find(b => b.id === req.params.id);
    if (!battle) return res.status(404).json({ error: 'Battle topilmadi.' });
    if (battle.challengerId !== req.user.id && battle.opponentId !== req.user.id) {
      return res.status(403).json({ error: 'Ruxsat yo\'q.' });
    }
    if (battle.status === 'pending') {
      battle.status = 'cancelled';
      battle.updatedAt = new Date().toISOString();
      writeLandingDB(dbData);
      broadcastToDashboard('battle_update', {
        battleId: battle.id,
        status: 'cancelled',
        challengerId: battle.challengerId,
        opponentId: battle.opponentId
      });
    }
    res.json({ success: true, battle: formatBattleForClient(battle, req.user.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

let battleLockChain = Promise.resolve();
function withBattleLock(fn) {
  const run = battleLockChain.then(() => fn(), () => fn());
  battleLockChain = run.catch(() => {});
  return run;
}

app.post('/api/battle/:id/answer', authenticateToken, (req, res) => withBattleLock(async () => {
  try {
    const dbData = readLandingDB();
    if (!Array.isArray(dbData.battles)) dbData.battles = [];
    const battle = dbData.battles.find(b => b.id === req.params.id);
    if (!battle) return res.status(404).json({ error: 'Battle topilmadi.' });

    const uid = req.user.id;
    const isChallenger = battle.challengerId === uid;
    const isOpponent = battle.opponentId === uid;
    if (!isChallenger && !isOpponent) {
      return res.status(403).json({ error: 'Siz ushbu bellashuv ishtirokchisi emassiz.' });
    }
    if (battle.status !== 'active') {
      return res.status(400).json({ error: battle.status === 'pending' ? 'Raqib hali jangni tasdiqlamagan.' : 'Bellashuv faol holatda emas.' });
    }

    const qIndex = Number(req.body?.qIndex);
    const selectedIdx = Number(req.body?.selectedIdx);
    const questions = battle.questions || [];
    if (!Number.isInteger(qIndex) || qIndex < 0 || qIndex >= questions.length) {
      return res.status(400).json({ error: 'Noto\'g\'ri savol indeksi.' });
    }

    const myAnswersKey = isChallenger ? 'challengerAnswers' : 'opponentAnswers';
    const myScoreKey = isChallenger ? 'challengerScore' : 'opponentScore';
    const myCoinsKey = isChallenger ? 'challengerCoinsEarned' : 'opponentCoinsEarned';

    if (!Array.isArray(battle[myAnswersKey])) battle[myAnswersKey] = [];
    const alreadyAnswered = battle[myAnswersKey].find(a => Number(a.qIndex) === qIndex);
    if (alreadyAnswered) {
      return res.json({
        success: true,
        alreadyAnswered: true,
        isCorrect: alreadyAnswered.isCorrect,
        correctIdx: questions[qIndex].correct,
        battle: formatBattleForClient(battle, uid)
      });
    }

    const question = questions[qIndex];
    const isCorrect = selectedIdx === Number(question.correct);
    const coinsDelta = isCorrect ? (battle.coinPerCorrect ?? 10) : 0;
    const xpDelta = isCorrect ? (battle.xpPerCorrect ?? 10) : 0;

    battle[myAnswersKey].push({
      qIndex,
      selectedIdx,
      correctIdx: question.correct,
      isCorrect,
      coinsAwarded: coinsDelta,
      answeredAt: new Date().toISOString()
    });
    battle[myScoreKey] = battle[myAnswersKey].filter(a => a.isCorrect).length;
    battle[myCoinsKey] = battle[myAnswersKey].reduce((sum, a) => sum + (a.coinsAwarded || 0), 0);

    let awardResult = null;
    if (isCorrect) {
      awardResult = await awardStudentProgress({
        userId: uid,
        eventKey: `battle_${battle.id}_q_${qIndex}`,
        type: 'battle',
        xp: xpDelta,
        coins: coinsDelta,
        meta: { battleId: battle.id, qIndex, questionId: question.id },
        countStreak: true,
        allowDuplicate: false
      });
    }

    const totalQ = questions.length || 5;
    if (
      (battle.challengerAnswers || []).length >= totalQ &&
      (battle.opponentAnswers || []).length >= totalQ
    ) {
      battle.status = 'completed';
      battle.completedAt = new Date().toISOString();
      if (battle.challengerScore > battle.opponentScore) {
        battle.winnerId = battle.challengerId;
      } else if (battle.opponentScore > battle.challengerScore) {
        battle.winnerId = battle.opponentId;
      } else {
        battle.winnerId = 'draw';
      }

      const summaryMsg = `${battle.challengerName}: ${battle.challengerScore}/${totalQ} (${battle.challengerCoinsEarned} Coin) — ${battle.opponentName}: ${battle.opponentScore}/${totalQ} (${battle.opponentCoinsEarned} Coin).`;
      await sendNotificationToUser(battle.challengerId, '🏆 Battle yakunlandi!', summaryMsg);
      await sendNotificationToUser(battle.opponentId, '🏆 Battle yakunlandi!', summaryMsg);
    }

    writeLandingDB(dbData);

    broadcastToDashboard('battle_update', {
      battleId: battle.id,
      status: battle.status,
      challengerId: battle.challengerId,
      opponentId: battle.opponentId,
      challengerScore: battle.challengerScore,
      opponentScore: battle.opponentScore
    });

    res.json({
      success: true,
      isCorrect,
      correctIdx: question.correct,
      awarded: isCorrect ? { xp: xpDelta, coins: coinsDelta } : { xp: 0, coins: 0 },
      userStats: awardResult?.userStats || null,
      battle: formatBattleForClient(battle, uid)
    });
  } catch (err) {
    console.error('Battle answer error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ==========================================
// 8. ADMIN STUDENT DESIGN THEME API (/api/design)
// ==========================================
const STUDENT_DESIGN_PRESETS = {
  'original': {
    id: 'original',
    name: 'Original (Hozirgi ko\'rinish)',
    description: "Platformaning hozirgi standart yorug' va qorong'i rejimi",
    bg: '#fafafa',
    surface: '#ffffff',
    font: '#09090b',
    button: '#4f46e5'
  },
  'burnt-orange': {
    id: 'burnt-orange',
    name: 'Burnt orange',
    description: 'Issiq krem fon (#F3EEE3), qora siyoh shrift (#111111) va Burnt orange tugmalar (#D9641E)',
    bg: '#F3EEE3',
    surface: '#FAF7F0',
    font: '#111111',
    button: '#D9641E'
  },
  'hot-pink': {
    id: 'hot-pink',
    name: 'Hot pink',
    description: 'Chuqur ko\'k fon (#0F183D), oq shrift (#FFFFFF) va Hot pink tugmalar (#FF3D8B)',
    bg: '#0F183D',
    surface: '#162254',
    font: '#FFFFFF',
    button: '#FF3D8B'
  },
  'electric-blue': {
    id: 'electric-blue',
    name: 'Electric blue',
    description: 'To\'q ko\'mir fon (#1E1E1C), qum rang shrift (#D8CBB3) va Electric blue tugmalar (#2F6BFF)',
    bg: '#1E1E1C',
    surface: '#272724',
    font: '#D8CBB3',
    button: '#2F6BFF'
  }
};

app.get('/api/design', (req, res) => {
  const dbData = readLandingDB();
  const savedPreset = dbData.studentDesign?.preset;
  const preset = STUDENT_DESIGN_PRESETS[savedPreset] ? savedPreset : 'original';
  res.json({
    preset,
    activeConfig: STUDENT_DESIGN_PRESETS[preset],
    presets: Object.values(STUDENT_DESIGN_PRESETS),
    updatedAt: dbData.studentDesign?.updatedAt || null
  });
});

app.put('/api/design', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const requested = String(req.body?.preset || 'original').trim();
    if (!STUDENT_DESIGN_PRESETS[requested]) {
      return res.status(400).json({ error: 'Noto\'g\'ri dizayn mavzusi tanlandi.' });
    }
    const dbData = readLandingDB();
    dbData.studentDesign = {
      preset: requested,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'admin'
    };
    writeLandingDB(dbData);

    broadcastToDashboard('design_update', {
      preset: requested,
      activeConfig: STUDENT_DESIGN_PRESETS[requested],
      updatedAt: dbData.studentDesign.updatedAt
    });

    res.json({
      success: true,
      preset: requested,
      activeConfig: STUDENT_DESIGN_PRESETS[requested],
      updatedAt: dbData.studentDesign.updatedAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. SPEAKING PRACTISE QUESTIONS & ADMIN CRUD API
// ==========================================
const DEFAULT_SPEAKING_PRACTISE_QUESTIONS = [
  {
    id: 'sp_q_1',
    question: 'Speaking English smoothly without long awkward pauses is called _____.',
    answer: 'FLUENCY',
    hint: 'Starts with F (7 letters)',
    category: 'IELTS Speaking',
    xp: 15,
    coins: 10
  },
  {
    id: 'sp_q_2',
    question: 'Could you _____ that question, please? I did not catch the last word.',
    answer: 'REPEAT',
    hint: 'Say it one more time (6 letters)',
    category: 'Conversation',
    xp: 15,
    coins: 10
  },
  {
    id: 'sp_q_3',
    question: 'In my _____, practising English aloud every morning builds strong confidence.',
    answer: 'OPINION',
    hint: 'Personal point of view (7 letters)',
    category: 'Expressing Ideas',
    xp: 15,
    coins: 10
  },
  {
    id: 'sp_q_4',
    question: 'Before giving a two-minute talk in IELTS Part 2, take a deep breath to stay _____.',
    answer: 'CALM',
    hint: 'Relaxed and not nervous (4 letters)',
    category: 'Speaking Confidence',
    xp: 15,
    coins: 10
  },
  {
    id: 'sp_q_5',
    question: 'An English _____ like "break a leg" has a figurative meaning rather than a literal one.',
    answer: 'IDIOM',
    hint: 'Natural expression (5 letters)',
    category: 'Vocabulary',
    xp: 20,
    coins: 12
  },
  {
    id: 'sp_q_6',
    question: 'To make your IELTS Speaking answer convincing, always support your point with a real _____.',
    answer: 'EXAMPLE',
    hint: 'Case or illustration (7 letters)',
    category: 'IELTS Part 3',
    xp: 20,
    coins: 12
  },
  {
    id: 'sp_q_7',
    question: 'Good speakers maintain natural eye _____ with the listener while talking.',
    answer: 'CONTACT',
    hint: 'Looking directly at someone (7 letters)',
    category: 'Body Language',
    xp: 20,
    coins: 12
  },
  {
    id: 'sp_q_8',
    question: 'Could you _____ what you mean by that phrase using simpler words?',
    answer: 'EXPLAIN',
    hint: 'Make something clear (7 letters)',
    category: 'Conversation',
    xp: 20,
    coins: 15
  },
  {
    id: 'sp_q_9',
    question: 'Practising shadowing native audio helps improve your natural English _____ and rhythm.',
    answer: 'ACCENT',
    hint: 'Way of pronouncing words (6 letters)',
    category: 'Pronunciation',
    xp: 25,
    coins: 15
  },
  {
    id: 'sp_q_10',
    question: 'Delivering a short _____ in front of an audience improves your public speaking skills.',
    answer: 'SPEECH',
    hint: 'Spoken talk or presentation (6 letters)',
    category: 'Public Speaking',
    xp: 25,
    coins: 15
  }
];

function computeAnswerShape(answerRaw) {
  const cleanedWords = String(answerRaw || '')
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const wordLengths = cleanedWords.map(w => w.length);
  const letterCount = wordLengths.reduce((sum, n) => sum + n, 0);
  const normalized = cleanedWords.join('');
  return { wordLengths, letterCount, normalized };
}

function ensureSpeakingPractiseSeeded() {
  const dbData = readLandingDB();
  if (!dbData.practiseInitialized) {
    dbData.practiseQuestions = DEFAULT_SPEAKING_PRACTISE_QUESTIONS.map(q => ({
      ...q,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    dbData.practiseInitialized = true;
    writeLandingDB(dbData);
  } else if (!Array.isArray(dbData.practiseQuestions)) {
    dbData.practiseQuestions = [];
  }
  return dbData;
}

app.get('/api/practise/questions', async (req, res) => {
  try {
    const authUser = getOptionalAuthUser(req);
    const isAdmin = authUser?.role === 'admin';
    const dbData = ensureSpeakingPractiseSeeded();
    const questions = Array.isArray(dbData.practiseQuestions) ? dbData.practiseQuestions : [];

    let completedSet = new Set();
    if (authUser?.id) {
      const events = await db.prisma.gamificationEvent.findMany({
        where: { userId: String(authUser.id), type: 'practise' },
        select: { eventKey: true }
      });
      events.forEach(ev => {
        if (ev.eventKey?.startsWith('practise_q_')) {
          completedSet.add(ev.eventKey.slice('practise_q_'.length));
        }
      });
    }

    const formatted = questions.map(q => {
      const shape = computeAnswerShape(q.answer);
      const completed = completedSet.has(String(q.id));
      return {
        id: q.id,
        question: q.question,
        hint: q.hint || '',
        category: q.category || 'Speaking',
        xp: Math.max(0, Number(q.xp) || 0),
        coins: Math.max(0, Number(q.coins) || 0),
        wordLengths: shape.wordLengths,
        letterCount: shape.letterCount,
        completed,
        ...(isAdmin ? { answer: String(q.answer || '').toUpperCase().trim() } : {}),
        ...(!isAdmin && completed ? { solvedAnswer: String(q.answer || '').toUpperCase().trim() } : {}),
        createdAt: q.createdAt,
        updatedAt: q.updatedAt
      };
    });

    res.json({
      questions: formatted,
      totalCount: formatted.length,
      completedCount: formatted.filter(q => q.completed).length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/practise/questions', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { question, answer, hint, category, xp, coins } = req.body || {};
    const cleanQ = String(question || '').trim();
    const cleanA = String(answer || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const shape = computeAnswerShape(cleanA);

    if (!cleanQ) {
      return res.status(400).json({ error: 'Ingliz tilida savol matni kiritilishi shart.' });
    }
    if (shape.letterCount < 1) {
      return res.status(400).json({ error: 'Javob kamida 1 ta harf yoki raqamdan iborat bo\'lishi kerak.' });
    }

    const dbData = ensureSpeakingPractiseSeeded();
    const newItem = {
      id: `sp_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      question: cleanQ,
      answer: cleanA,
      hint: String(hint || '').trim(),
      category: String(category || 'Speaking Practise').trim(),
      xp: Math.max(0, Math.round(Number(xp) || 15)),
      coins: Math.max(0, Math.round(Number(coins) || 10)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dbData.practiseQuestions.push(newItem);
    writeLandingDB(dbData);

    broadcastToDashboard('practise_update', { action: 'create', questionId: newItem.id });
    res.status(201).json({
      success: true,
      question: {
        ...newItem,
        wordLengths: shape.wordLengths,
        letterCount: shape.letterCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/practise/questions/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const dbData = ensureSpeakingPractiseSeeded();
    const idx = dbData.practiseQuestions.findIndex(q => String(q.id) === String(req.params.id));
    if (idx === -1) {
      return res.status(404).json({ error: 'Savol topilmadi.' });
    }

    const existing = dbData.practiseQuestions[idx];
    const cleanQ = req.body?.question !== undefined ? String(req.body.question).trim() : existing.question;
    const cleanA = req.body?.answer !== undefined
      ? String(req.body.answer).replace(/\s+/g, ' ').trim().toUpperCase()
      : existing.answer;
    const shape = computeAnswerShape(cleanA);

    if (!cleanQ) {
      return res.status(400).json({ error: 'Savol matni bo\'sh bo\'lishi mumkin emas.' });
    }
    if (shape.letterCount < 1) {
      return res.status(400).json({ error: 'Javob kamida 1 ta harf yoki raqamdan iborat bo\'lishi kerak.' });
    }

    const updated = {
      ...existing,
      question: cleanQ,
      answer: cleanA,
      hint: req.body?.hint !== undefined ? String(req.body.hint).trim() : (existing.hint || ''),
      category: req.body?.category !== undefined ? String(req.body.category).trim() : (existing.category || 'Speaking Practise'),
      xp: req.body?.xp !== undefined ? Math.max(0, Math.round(Number(req.body.xp) || 0)) : existing.xp,
      coins: req.body?.coins !== undefined ? Math.max(0, Math.round(Number(req.body.coins) || 0)) : existing.coins,
      updatedAt: new Date().toISOString()
    };

    dbData.practiseQuestions[idx] = updated;
    writeLandingDB(dbData);

    broadcastToDashboard('practise_update', { action: 'update', questionId: updated.id });
    res.json({
      success: true,
      question: {
        ...updated,
        wordLengths: shape.wordLengths,
        letterCount: shape.letterCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/practise/questions/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const dbData = ensureSpeakingPractiseSeeded();
    const prevLen = dbData.practiseQuestions.length;
    dbData.practiseQuestions = dbData.practiseQuestions.filter(q => String(q.id) !== String(req.params.id));
    if (dbData.practiseQuestions.length === prevLen) {
      return res.status(404).json({ error: 'Savol topilmadi.' });
    }
    writeLandingDB(dbData);
    broadcastToDashboard('practise_update', { action: 'delete', questionId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/practise/questions/:id/submit', authenticateToken, async (req, res) => {
  try {
    const dbData = ensureSpeakingPractiseSeeded();
    const q = dbData.practiseQuestions.find(item => String(item.id) === String(req.params.id));
    if (!q) {
      return res.status(404).json({ error: 'Savol topilmadi.' });
    }

    const submittedRaw = Array.isArray(req.body?.letters)
      ? req.body.letters.join('')
      : String(req.body?.answer || '');
    const submittedShape = computeAnswerShape(submittedRaw);
    const expectedShape = computeAnswerShape(q.answer);

    if (!submittedShape.normalized || submittedShape.normalized !== expectedShape.normalized) {
      return res.json({
        correct: false,
        awardedXp: 0,
        awardedCoins: 0,
        message: "Noto'g'ri! Katakchalardagi harflarni tekshirib qayta urinib ko'ring."
      });
    }

    const qXp = Math.max(0, Number(q.xp) || 0);
    const qCoins = Math.max(0, Number(q.coins) || 0);

    const resAward = await awardStudentProgress({
      userId: req.user.id,
      eventKey: `practise_q_${q.id}`,
      type: 'practise',
      xp: qXp,
      coins: qCoins,
      meta: { questionId: q.id, category: q.category },
      countStreak: true,
      allowDuplicate: false
    });

    const userStats = resAward?.userStats || null;

    res.json({
      correct: true,
      alreadyCompleted: Boolean(resAward?.alreadyAwarded),
      awardedXp: resAward?.awardedXp || 0,
      awardedCoins: resAward?.awardedCoins || 0,
      solvedAnswer: String(q.answer || '').toUpperCase().trim(),
      userStats,
      message: resAward?.alreadyAwarded
        ? "To'g'ri! Ushbu savol uchun XP va Coin mukofotini avval olgansiz."
        : `Barakalla! To'g'ri javob uchun +${resAward?.awardedXp || 0} XP va +${resAward?.awardedCoins || 0} Coin berildi!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// MUKAMMAL ERROR HANDLER MIDDLEWARE
// ==========================================
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR DETECTED]', err);

  let statusCode = err.status || 500;
  let errorMessage = err.message || 'Serverda ichki xatolik yuz berdi.';
  let errorType = 'SERVER_INTERNAL_ERROR';

  if (err.name === 'PrismaClientKnownRequestError') {
    errorType = 'DATABASE_ERROR';
    if (err.code === 'P2002') {
      statusCode = 409;
      errorMessage = 'Bunday ma\'lumot allaqachon mavjud (Unikallik xatosi).';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      errorMessage = 'So\'ralgan ma\'lumot topilmadi.';
    } else if (err.code === 'P2021') {
      statusCode = 500;
      errorMessage = 'Ma\'lumotlar bazasida kerakli jadval topilmadi. (Prisma db push qilish kerak)';
    } else {
      statusCode = 400;
      errorMessage = 'Ma\'lumotlar bazasi so\'rovida xatolik yuz berdi.';
    }
  } else if (err.name === 'PrismaClientValidationError') {
    errorType = 'DATABASE_VALIDATION_ERROR';
    statusCode = 400;
    errorMessage = 'Yuborilgan ma\'lumotlar formati noto\'g\'ri.';
  }

  if (err.name === 'JsonWebTokenError') {
    errorType = 'AUTH_TOKEN_ERROR';
    statusCode = 401;
    errorMessage = 'Yaroqsiz yoki noto\'g\'ri token.';
  } else if (err.name === 'TokenExpiredError') {
    errorType = 'AUTH_TOKEN_EXPIRED';
    statusCode = 401;
    errorMessage = 'Token muddati tugagan. Iltimos qaytadan tizimga kiring.';
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    errorType = 'JSON_SYNTAX_ERROR';
    statusCode = 400;
    errorMessage = 'Noto\'g\'ri JSON format yuborildi.';
  }

  try {
    db.logSecurityIncident({
      type: errorType,
      severity: statusCode >= 500 ? 'HIGH' : 'MEDIUM',
      message: `Xato: ${errorMessage} | Asl sabab: ${err.message}`,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    });
  } catch (logErr) {
    console.error('[LOGGING ERROR FAILED]', logErr);
  }

  res.status(statusCode).json({
    error: errorMessage,
    type: errorType,
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🔒 MathScore SECURE BACKEND RUNNING ON PORT: ${PORT}`);
    console.log(`🖥️  LIVE CONTROL PANEL: http://localhost:${PORT}`);
    console.log(`==================================================`);
    processDueScheduledPushes().catch(() => {});
    setInterval(() => {
      processDueScheduledPushes().catch(() => {});
    }, 3000);
  });
}

module.exports = app;
