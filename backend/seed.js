const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  const sponsor = await prisma.user.upsert({
    where: { phone: '+256700000001' },
    update: {},
    create: {
      phone: '+256700000001',
      name: 'BrandBoost Uganda',
      role: 'SPONSOR',
    },
  });

  await prisma.challenge.createMany({
    data: [
      {
        sponsorId: sponsor.id,
        title: 'Share Tuka on Twitter',
        description: 'Post about Tuka with #EarnNow',
        rewardPool: 5000000,
        locationType: 'REMOTE',
        city: 'Global',
        status: 'ACTIVE',
      },
      {
        sponsorId: sponsor.id,
        title: 'Visit Kampala Store',
        description: 'Take photo at Kampala Road shop',
        rewardPool: 2000000,
        locationType: 'PHYSICAL',
        city: 'Kampala',
        lat: 0.3136,
        lng: 32.5811,
        radiusMeters: 1000,
        status: 'ACTIVE',
      },
    ],
  });

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());