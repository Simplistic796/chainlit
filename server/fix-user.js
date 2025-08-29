const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const keys = await prisma.apiKey.findMany({ include: { user: true } });
    console.log('API Keys:', JSON.stringify(keys, null, 2));
    
    if (keys.length > 0) {
      const key = keys[0];
      console.log('First key:', key.id, 'has user:', key.user);
      
      if (!key.user) {
        console.log('Creating user for key...');
        const user = await prisma.user.create({
          data: {
            email: 'demo@example.com',
            plan: 'pro'
          }
        });
        console.log('Created user:', user);
        
        await prisma.apiKey.update({
          where: { id: key.id },
          data: { userId: user.id }
        });
        console.log('Updated API key with user');
      }
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
