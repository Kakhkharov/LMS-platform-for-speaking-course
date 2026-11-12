const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

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

// Initialize SQLite WAL & pragmas on startup (no legacy default admin seeding)
async function initDb() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 8000;').catch(() => {});
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;').catch(() => {});
  } catch (error) {
    console.error("[DB] Init Error:", error);
  }
}
initDb();

module.exports = db;
