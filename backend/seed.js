const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create sponsor
  const sponsor = await prisma.user.upsert({
    where: { phone: '+256700000001' },
    update: {},
    create: {
      phone: '+256700000001',
      name: 'BrandBoost Uganda',
      role: 'SPONSOR',
    },
  });

  console.log('✅ Created sponsor:', sponsor.name);

  // Create challenges
  const challenges = await prisma.challenge.createMany({
    data: [
      {
        sponsorId: sponsor.id,
        title: 'Share Tuka on Twitter',
        description: 'Post a tweet about Tuka with #EarnNow and screenshot it.',
        rewardPool: 5000000, // 5M UGX
        locationType: 'REMOTE',
        city: 'Global',
        status: 'ACTIVE',
      },
      {
        sponsorId: sponsor.id,
        title: 'Visit Kampala Road Store',
        description: 'Go to the shop, take a photo with the Tuka poster, and submit.',
        rewardPool: 2000000, // 2M UGX
        locationType: 'PHYSICAL',
        city: 'Kampala',
        lat: 0.3136,
        lng: 32.5811,
        radiusMeters: 1000, // 1km radius
        status: 'ACTIVE',
      },
    ],
  });

  console.log('✅ Created challenges');
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });