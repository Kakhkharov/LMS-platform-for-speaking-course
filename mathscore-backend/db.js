const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}
try { require('dotenv').config(); } catch (e) {}

const DEFAULT_DATABASE_URL = "postgresql://postgres.oluicgncdqvuwboptnon:%2BM%40s%3FrjHHxStxv7@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=25";
const DEFAULT_DIRECT_URL = "postgresql://postgres.oluicgncdqvuwboptnon:%2BM%40s%3FrjHHxStxv7@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = DEFAULT_DIRECT_URL;
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Auto-encode special characters in DATABASE_URL password if raw string is provided
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes(':+M@s?rjHHxStxv7@')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(':+M@s?rjHHxStxv7@', ':%2BM%40s%3FrjHHxStxv7@');
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout=')) {
  process.env.DATABASE_URL += (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connect_timeout=25';
}

const prisma = new PrismaClient();

const db = {
  get: async (table) => {
    switch (table) {
      case 'users': return await prisma.user.findMany();
      case 'courses': return await prisma.course.findMany({ include: { lessons: true } });
      case 'tests': {
        const tests = await prisma.test.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            questions: true,
            course: true
          }
        });
        return tests.map(t => ({
          ...t,
          course: t.course ? t.course.title : (t.category || null),
          questions: t.questions.map(q => {
            let parsedAns = q.correctAnswer;
            if (q.type === 'multiple') {
              try { parsedAns = JSON.parse(q.correctAnswer); } catch (e) { parsedAns = [0]; }
            } else if (q.type === 'truefalse') {
              parsedAns = q.correctAnswer === 'true' || q.correctAnswer === '1' || q.correctAnswer === true || q.correctAnswer === 1;
            } else if (q.type === 'single' || q.type === 'mcq') {
              parsedAns = isNaN(Number(q.correctAnswer)) ? q.correctAnswer : Number(q.correctAnswer);
            }
            let parsedMarkingScheme = null;
            if (q.markingScheme) {
              try { parsedMarkingScheme = JSON.parse(q.markingScheme); } catch (e) { parsedMarkingScheme = null; }
            }
            return {
              ...q,
              options: JSON.parse(q.options || '[]'),
              correctAnswer: parsedAns,
              markingScheme: parsedMarkingScheme
            };
          })
        }));
      }
      case 'submissions': {
        const subs = await prisma.submission.findMany({ orderBy: { submittedAt: 'desc' } });
        return subs.map(s => {
          let parsedDetails = null;
          if (s.details) {
            try { parsedDetails = JSON.parse(s.details); } catch(e) {}
          }
          return { ...s, details: parsedDetails };
        });
      }
      case 'securityLogs': return await prisma.securityLog.findMany({ orderBy: { timestamp: 'desc' }, take: 100 });
      case 'apiLogs': return await prisma.apiLog.findMany({ orderBy: { timestamp: 'desc' }, take: 100 });
      default: return [];
    }
  },

  getById: async (table, id) => {
    switch (table) {
      case 'users': return await prisma.user.findUnique({ where: { id } });
      case 'courses': return await prisma.course.findUnique({ where: { id }, include: { lessons: true } });
      case 'tests': {
        const t = await prisma.test.findUnique({
          where: { id },
          include: { questions: true, course: true }
        });
        if (!t) return null;
        return {
          ...t,
          course: t.course ? t.course.title : (t.category || null),
          questions: t.questions.map(q => {
            let parsedAns = q.correctAnswer;
            if (q.type === 'multiple') {
              try { parsedAns = JSON.parse(q.correctAnswer); } catch (e) { parsedAns = [0]; }
            } else if (q.type === 'truefalse') {
              parsedAns = q.correctAnswer === 'true' || q.correctAnswer === '1' || q.correctAnswer === true || q.correctAnswer === 1;
            } else if (q.type === 'single' || q.type === 'mcq') {
              parsedAns = isNaN(Number(q.correctAnswer)) ? q.correctAnswer : Number(q.correctAnswer);
            }
            let parsedMarkingScheme = null;
            if (q.markingScheme) {
              try { parsedMarkingScheme = JSON.parse(q.markingScheme); } catch (e) { parsedMarkingScheme = null; }
            }
            return {
              ...q,
              options: JSON.parse(q.options || '[]'),
              correctAnswer: parsedAns,
              markingScheme: parsedMarkingScheme
            };
          })
        };
      }
      case 'submissions': {
        const s = await prisma.submission.findUnique({ where: { id } });
        if (!s) return null;
        let parsedDetails = null;
        if (s.details) {
          try { parsedDetails = JSON.parse(s.details); } catch(e) {}
        }
        return { ...s, details: parsedDetails };
      }
      default: return null;
    }
  },

  insert: async (table, record) => {
    switch (table) {
      case 'users': return await prisma.user.create({ data: record });
      case 'submissions': {
        const subData = { ...record };
        if (typeof subData.details === 'object' && subData.details !== null) {
          subData.details = JSON.stringify(subData.details);
        }
        return await prisma.submission.create({ data: subData });
      }
      case 'courses': {
        const data = {
          title: record.title,
          category: record.category,
          instructor: record.instructor,
          price: record.price !== undefined && record.price !== null ? String(record.price) : "",
          image: record.image,
          description: record.description
        };
        if (record.lessons && Array.isArray(record.lessons)) {
          data.lessons = {
            create: record.lessons.map(lesson => ({
              title: lesson.title,
              duration: lesson.duration,
              videoUrl: lesson.videoUrl || ''
            }))
          };
        }
        return await prisma.course.create({ data });
      }
      case 'tests': {
        const { questions, ...testData } = record;
        const mappedQuestions = questions ? questions.map(q => {
          const { id, ...qData } = q;
          return {
            type: qData.type || 'single',
            text: qData.text || '',
            options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
            correctAnswer: typeof qData.correctAnswer === 'object'
              ? JSON.stringify(qData.correctAnswer)
              : String(qData.correctAnswer !== undefined && qData.correctAnswer !== null ? qData.correctAnswer : ''),
            score: Number(qData.score !== undefined ? qData.score : 1),
            explanation: qData.explanation || '',
            hint: qData.hint || '',
            imageUrl: qData.imageUrl || null,
            markingScheme: typeof qData.markingScheme === 'object' && qData.markingScheme !== null
              ? JSON.stringify(qData.markingScheme)
              : (qData.markingScheme || null)
          };
        }) : [];

        let resolvedCourseId = testData.courseId || null;
        if (!resolvedCourseId && testData.course) {
          const matchedCourse = await prisma.course.findFirst({
            where: {
              OR: [
                { id: testData.course },
                { title: testData.course },
                { title: { contains: testData.course } }
              ]
            }
          });
          if (matchedCourse) resolvedCourseId = matchedCourse.id;
        }
        
        const cleanTestData = {
          title: testData.title,
          category: testData.category || 'General',
          difficulty: testData.difficulty || 'Medium',
          questionCount: Number(testData.questionCount || (mappedQuestions.length || 0)),
          duration: Number(testData.duration || 60),
          status: testData.status || 'Draft',
          passingPercentage: testData.passingPercentage !== undefined ? Number(testData.passingPercentage) : 70,
          startDate: testData.startDate || null,
          endDate: testData.endDate || null,
          randomizeQuestions: Boolean(testData.randomizeQuestions),
          randomizeAnswers: Boolean(testData.randomizeAnswers),
          courseId: resolvedCourseId
        };

        const created = await prisma.test.create({
          data: {
            ...cleanTestData,
            questions: { create: mappedQuestions }
          },
          include: { questions: true, course: true }
        });

        return {
          ...created,
          course: created.course ? created.course.title : (created.category || null),
          questions: created.questions.map(q => ({
            ...q,
            options: JSON.parse(q.options || '[]')
          }))
        };
      }
      case 'submissions': {
        return await prisma.submission.create({
          data: {
            userId: record.userId,
            userName: record.userName,
            userEmail: record.userEmail,
            testId: record.testId,
            testTitle: record.testTitle,
            score: Number(record.score),
            correctCount: Number(record.correctCount),
            incorrectCount: Number(record.incorrectCount),
            tabSwitches: Number(record.tabSwitches || 0),
            timeSpent: record.timeSpent || '00:00',
            passed: Boolean(record.passed)
          }
        });
      }
      default: return null;
    }
  },

  update: async (table, id, updatedFields) => {
    switch (table) {
      case 'courses': {
        const allowed = ['title', 'category', 'instructor', 'price', 'image', 'description'];
        const data = {};
        for (const key of allowed) {
          if (updatedFields[key] !== undefined) {
            if (key === 'price') {
              data[key] = String(updatedFields[key]);
            } else {
              data[key] = updatedFields[key];
            }
          }
        }
        
        if (updatedFields.lessons && Array.isArray(updatedFields.lessons)) {
          // Replace all lessons with new array
          await prisma.lesson.deleteMany({ where: { courseId: id } });
          data.lessons = {
            create: updatedFields.lessons.map(lesson => ({
              title: lesson.title,
              duration: lesson.duration,
              videoUrl: lesson.videoUrl || ''
            }))
          };
        }
        
        return await prisma.course.update({ where: { id }, data });
      }
      case 'tests': {
        const allowed = ['title', 'category', 'difficulty', 'questionCount', 'duration', 'status', 'passingPercentage', 'startDate', 'endDate', 'randomizeQuestions', 'randomizeAnswers', 'courseId'];
        const data = {};
        for (const key of allowed) {
          if (updatedFields[key] !== undefined) {
            if (['questionCount', 'duration', 'passingPercentage'].includes(key)) {
              data[key] = Number(updatedFields[key]);
            } else if (['randomizeQuestions', 'randomizeAnswers'].includes(key)) {
              data[key] = Boolean(updatedFields[key]);
            } else {
              data[key] = updatedFields[key];
            }
          }
        }

        if (!data.courseId && updatedFields.course) {
          const matchedCourse = await prisma.course.findFirst({
            where: {
              OR: [
                { id: updatedFields.course },
                { title: updatedFields.course },
                { title: { contains: updatedFields.course } }
              ]
            }
          });
          if (matchedCourse) data.courseId = matchedCourse.id;
        }

        if (updatedFields.questions && Array.isArray(updatedFields.questions)) {
          await prisma.question.deleteMany({ where: { testId: id } });
          data.questions = {
            create: updatedFields.questions.map(q => {
              const { id: qId, ...qData } = q;
              return {
                type: qData.type || 'single',
                text: qData.text || '',
                options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
                correctAnswer: typeof qData.correctAnswer === 'object'
                  ? JSON.stringify(qData.correctAnswer)
                  : String(qData.correctAnswer !== undefined && qData.correctAnswer !== null ? qData.correctAnswer : ''),
                score: Number(qData.score !== undefined ? qData.score : 1),
                explanation: qData.explanation || '',
                hint: qData.hint || '',
                imageUrl: qData.imageUrl || null,
                markingScheme: typeof qData.markingScheme === 'object' && qData.markingScheme !== null
                  ? JSON.stringify(qData.markingScheme)
                  : (qData.markingScheme || null)
              };
            })
          };
          if (!data.questionCount) {
            data.questionCount = updatedFields.questions.filter(q => (q.text || '').trim() !== '').length || updatedFields.questions.length;
          }
        }

        const updated = await prisma.test.update({
          where: { id },
          data,
          include: { questions: true, course: true }
        });

        return {
          ...updated,
          course: updated.course ? updated.course.title : (updated.category || null),
          questions: updated.questions.map(q => ({
            ...q,
            options: JSON.parse(q.options || '[]')
          }))
        };
      }
      default: return null;
    }
  },

  delete: async (table, id) => {
    try {
      switch (table) {
        case 'users': await prisma.user.delete({ where: { id } }); break;
        case 'courses': {
          await prisma.lesson.deleteMany({ where: { courseId: id } }).catch(() => {});
          await prisma.userCourse.deleteMany({ where: { courseId: id } }).catch(() => {});
          await prisma.test.updateMany({ where: { courseId: id }, data: { courseId: null } }).catch(() => {});
          await prisma.course.delete({ where: { id } });
          break;
        }
        case 'tests': await prisma.test.delete({ where: { id } }); break;
        default: return false;
      }
      return true;
    } catch (error) {
      console.error(`Error deleting from ${table}:`, error);
      return false;
    }
  },

  _apiLogQueue: Promise.resolve(),
  _apiLogPending: 0,

  logApiRequest: async (logEntry) => {
    if (db._apiLogPending > 25) return;
    db._apiLogPending += 1;
    db._apiLogQueue = db._apiLogQueue.then(async () => {
      try {
        await prisma.apiLog.create({
          data: {
            method: logEntry.method,
            url: logEntry.url,
            statusCode: logEntry.statusCode || 200,
            ip: logEntry.ip,
            userAgent: logEntry.userAgent || ''
          }
        });
      } catch (err) {
        if (!String(err?.code || '').startsWith('P')) console.error(err);
      } finally {
        db._apiLogPending = Math.max(0, db._apiLogPending - 1);
      }
    });
    return db._apiLogQueue;
  },

  logSecurityIncident: async (logEntry) => {
    try {
      await prisma.securityLog.create({
        data: {
          type: logEntry.type,
          severity: logEntry.severity,
          message: logEntry.message,
          ip: logEntry.ip,
          details: logEntry.details ? JSON.stringify(logEntry.details) : null
        }
      });
    } catch (err) { console.error(err); }
  },
  
  clearLogs: async () => {
    await prisma.apiLog.deleteMany({});
    await prisma.securityLog.deleteMany({});
  },

  prisma
};

// Initialize SQLite WAL & pragmas and ensure primary admins on startup
async function initDb() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 8000;').catch(() => {});
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;').catch(() => {});
  } catch (error) {
    console.error("[DB] Init Error:", error);
  }

  try {
    const adminDefaults = [
      {
        email: 'turgunboevsss@gmail.com',
        name: "Azizbek Turg'unboyev",
        passwordHash: bcrypt.hashSync('Azizbek2026$', 10)
      },
      {
        email: 'musurmonqahharov747@gmail.com',
        name: 'Musurmon Qahharov',
        passwordHash: bcrypt.hashSync('Musulmon2026$', 10)
      }
    ];

    for (const adm of adminDefaults) {
      const existing = await prisma.user.findUnique({ where: { email: adm.email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            name: adm.name,
            email: adm.email,
            password: adm.passwordHash,
            role: 'admin',
            status: 'Online'
          }
        });
        console.log(`[DB] Created primary admin: ${adm.email}`);
      } else if (existing.role !== 'admin') {
        await prisma.user.update({
          where: { email: adm.email },
          data: { role: 'admin' }
        });
        console.log(`[DB] Ensured primary admin role: ${adm.email}`);
      }
    }

    const courseDefaults = [
      {
        title: 'IELTS Speaking Masterclass (Band 8.0+)',
        category: 'IELTS Speaking',
        instructor: 'Musurmon Qahharov',
        price: '1200000',
        image: 'https://cdn.jsdelivr.net/gh/Kakhkharov/LMS-platform-for-speaking-course@main/image/course_default_cover.jpg',
        description: "IELTS Speaking bo'yicha Band 8.0+ darajaga chiqish uchun intensiv amaliyot va strategiyalar kursi."
      },
      {
        title: 'IELTS Speaking Masterclass',
        category: 'IELTS Speaking',
        instructor: 'Musurmon Qahharov',
        price: '1200000',
        image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=250&fit=crop',
        description: "IELTS Speaking imtihoni uchun to'liq tayyorgarlik kursi: Part 1, Part 2 va Part 3."
      },
      {
        title: 'General English Speaking & Fluency',
        category: 'Spoken English',
        instructor: 'Musurmon Qahharov',
        price: '850000',
        image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=250&fit=crop',
        description: "Ingliz tilida ravon so'zlashuv va so'z boyligini kengaytirish uchun mo'ljallangan darslar."
      },
      {
        title: 'Pronunciation & American Accent Training',
        category: 'Pronunciation',
        instructor: 'Musurmon Qahharov',
        price: '700000',
        image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=250&fit=crop',
        description: "Amerika talaffuzi, urg'u va intonatsiya bo'yicha professional mahorat darsi."
      },
      {
        title: 'Everyday English Conversations & Idioms',
        category: 'Conversational',
        instructor: 'Musurmon Qahharov',
        price: '600000',
        image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&h=250&fit=crop',
        description: "Kundalik suhbatlar, frazeologik birikmalar va idiomalar yordamida erkin muloqot."
      },
      {
        title: 'Business English Spoken Communication',
        category: 'Business English',
        instructor: 'Musurmon Qahharov',
        price: '950000',
        image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&h=250&fit=crop',
        description: "Biznes uchrashuvlar, taqdimotlar va muzokaralar uchun professional ingliz tili."
      }
    ];

    for (const c of courseDefaults) {
      const existingCourse = await prisma.course.findFirst({
        where: {
          title: { equals: c.title, mode: 'insensitive' }
        }
      });
      if (!existingCourse) {
        await prisma.course.create({ data: c });
        console.log(`[DB] Created default course: ${c.title}`);
      }
    }
  } catch (admErr) {
    // Non-blocking
  }
}
initDb();

db.initDb = initDb;
module.exports = db;
