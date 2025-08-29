const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function main() {
  try {
    const demoKey = process.env.DEMO_API_KEY;
    if (!demoKey) {
      console.error('DEMO_API_KEY environment variable not set');
      process.exit(1);
    }

    console.log('DEMO_API_KEY found:', demoKey ? 'SET' : 'NOT SET');
    
    const keyHash = hashKey(demoKey);
    console.log('Looking for key hash:', keyHash);

    // Check if API key exists
    let apiKey = await prisma.apiKey.findFirst({ 
      where: { keyHash, isActive: true } 
    });

    if (!apiKey) {
      console.log('Creating new API key...');
      apiKey = await prisma.apiKey.create({
        data: { 
          name: 'DEMO_KEY', 
          plan: 'pro', 
          keyHash, 
          requestsPerMin: 1000, 
          requestsPerDay: 100000, 
          isActive: true 
        },
      });
      console.log('Created API key with ID:', apiKey.id);
    } else {
      console.log('Found existing API key with ID:', apiKey.id);
    }

    // Check if demo user exists
    let user = await prisma.user.findFirst({ 
      where: { email: 'demo@chainlit.com' } 
    });

    if (!user) {
      console.log('Creating demo user...');
      user = await prisma.user.create({
        data: { 
          email: 'demo@chainlit.com',
          plan: 'pro'
        },
      });
      console.log('Created user with ID:', user.id);
    } else {
      console.log('Found existing user with ID:', user.id);
    }

    // Link API key to user if not already linked
    if (!apiKey.userId) {
      console.log('Linking API key to user...');
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { userId: user.id }
      });
      console.log('API key linked to user');
    } else {
      console.log('API key already linked to user ID:', apiKey.userId);
    }

    // Check if portfolio exists
    let portfolio = await prisma.portfolio.findFirst({ 
      where: { userId: user.id } 
    });

    if (!portfolio) {
      console.log('Creating demo portfolio...');
      portfolio = await prisma.portfolio.create({
        data: { 
          userId: user.id, 
          name: 'Demo Portfolio' 
        },
      });
      console.log('Created portfolio with ID:', portfolio.id);
    } else {
      console.log('Found existing portfolio with ID:', portfolio.id);
    }

    // Add some sample holdings
    const sampleHoldings = [
      { token: 'ETH', weight: 0.4 },
      { token: 'SOL', weight: 0.3 },
      { token: 'MATIC', weight: 0.2 },
      { token: 'LINK', weight: 0.1 }
    ];

    for (const holding of sampleHoldings) {
      const existing = await prisma.holding.findFirst({
        where: { portfolioId: portfolio.id, token: holding.token }
      });

      if (!existing) {
        await prisma.holding.create({
          data: {
            portfolioId: portfolio.id,
            token: holding.token,
            weight: holding.weight
          }
        });
        console.log(`Added holding: ${holding.token} (${holding.weight})`);
      } else {
        console.log(`Holding already exists: ${holding.token}`);
      }
    }

    console.log('✅ Demo user setup complete!');
    console.log('User ID:', user.id);
    console.log('API Key ID:', apiKey.id);
    console.log('Portfolio ID:', portfolio.id);

  } catch (error) {
    console.error('Error setting up demo user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
