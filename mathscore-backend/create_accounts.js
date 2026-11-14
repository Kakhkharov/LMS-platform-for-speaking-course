require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes(':+M@s?rjHHxStxv7@')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(':+M@s?rjHHxStxv7@', ':%2BM%40s%3FrjHHxStxv7@');
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connect_timeout=')) {
  process.env.DATABASE_URL += (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connect_timeout=25';
}
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Passwords
  const passTurgunboev = bcrypt.hashSync('Azizbek2026$', 10);
  const passMusurmon = bcrypt.hashSync('Musulmon2026$', 10);
  const passStudent = bcrypt.hashSync('uzb1234', 10);

  // 1. Asosiy Admin: turgunboevsss@gmail.com
  await prisma.user.upsert({
    where: { email: 'turgunboevsss@gmail.com' },
    update: { 
      password: passTurgunboev, 
      role: 'admin',
      status: 'Online' 
    },
    create: {
      name: "Azizbek Turg'unboyev",
      email: 'turgunboevsss@gmail.com',
      password: passTurgunboev,
      role: 'admin',
      status: 'Online'
    }
  });
  console.log("Asosiy Admin yaratildi/yangilandi: turgunboevsss@gmail.com (parol: Azizbek2026$)");

  // 2. Asosiy Admin: musurmonqahharov747@gmail.com
  await prisma.user.upsert({
    where: { email: 'musurmonqahharov747@gmail.com' },
    update: { 
      password: passMusurmon, 
      role: 'admin',
      status: 'Online' 
    },
    create: {
      name: 'Musurmon Qahharov',
      email: 'musurmonqahharov747@gmail.com',
      password: passMusurmon,
      role: 'admin',
      status: 'Online'
    }
  });
  console.log("Asosiy Admin yaratildi/yangilandi: musurmonqahharov747@gmail.com (parol: Musulmon2026$)");

  // 3. Student: muborakkhonkeldieva@gmail.com
  await prisma.user.upsert({
    where: { email: 'muborakkhonkeldieva@gmail.com' },
    update: { 
      password: passStudent, 
      role: 'student',
      status: 'Online' 
    },
    create: {
      name: 'Muborakxon Keldiyeva',
      email: 'muborakkhonkeldieva@gmail.com',
      password: passStudent,
      role: 'student',
      course: 'IELTS Speaking Masterclass',
      status: 'Online'
    }
  });
  console.log("Student yaratildi/yangilandi: muborakkhonkeldieva@gmail.com (parol: uzb1234)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
