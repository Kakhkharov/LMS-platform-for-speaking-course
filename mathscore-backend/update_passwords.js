const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    console.log("Legacy update script disabled.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
