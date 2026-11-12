const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const studentPass = bcrypt.hashSync('12345678', 10);
  const adminPass = bcrypt.hashSync('admin123', 10);

  // Student 1 (default)
  await prisma.user.upsert({
    where: { email: 'student@mathscore.uz' },
    update: { password: studentPass },
    create: {
      name: 'O\'quvchi (Demo)',
      email: 'student@mathscore.uz',
      password: studentPass,
      role: 'student',
      course: 'SAT Mathematics Intensive',
      status: 'Online'
    }
  });

  console.log('Legacy admin seeding removed. Use primary admin accounts.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
