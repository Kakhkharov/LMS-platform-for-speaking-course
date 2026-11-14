const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const studentPass = bcrypt.hashSync('12345678', 10);
  const adminPass = bcrypt.hashSync('admin123', 10);
  const defaultPass = bcrypt.hashSync('12345678', 10);

  // 1. Admin accounts
  await prisma.user.upsert({
    where: { email: 'malikatoxirova31@gmail.com' },
    update: { password: defaultPass, role: 'admin' },
    create: {
      name: 'Malika Toxirova',
      email: 'malikatoxirova31@gmail.com',
      password: defaultPass,
      role: 'admin',
      status: 'Online'
    }
  });
  console.log('Admin created/updated: malikatoxirova31@gmail.com (parol: 12345678)');

  await prisma.user.upsert({
    where: { email: 'admin@mathscore.uz' },
    update: { password: adminPass, role: 'admin' },
    create: {
      name: 'Asosiy Admin',
      email: 'admin@mathscore.uz',
      password: adminPass,
      role: 'admin',
      status: 'Online'
    }
  });
  console.log('Admin created/updated: admin@mathscore.uz (parol: admin123)');

  await prisma.user.upsert({
    where: { email: 'musurmonqahharov747@gmail.com' },
    update: { password: defaultPass, role: 'admin' },
    create: {
      name: 'Musurmon Qahharov',
      email: 'musurmonqahharov747@gmail.com',
      password: defaultPass,
      role: 'admin',
      status: 'Online'
    }
  });
  console.log('Admin created/updated: musurmonqahharov747@gmail.com (parol: 12345678)');

  // 2. Student account
  await prisma.user.upsert({
    where: { email: 'student@mathscore.uz' },
    update: { password: studentPass, role: 'student' },
    create: {
      name: "O'quvchi (Demo)",
      email: 'student@mathscore.uz',
      password: studentPass,
      role: 'student',
      course: 'IELTS Speaking Masterclass',
      status: 'Online'
    }
  });
  console.log('Student created/updated: student@mathscore.uz (parol: 12345678)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
