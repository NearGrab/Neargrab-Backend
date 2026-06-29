const { prisma } = require("../config/prisma");

async function main() {
  console.log("Starting ProductAnalytics backfill...");
  
  const products = await prisma.product.findMany({
    include: {
      analytics: true,
    },
  });
  
  console.log(`Found ${products.length} total products in database.`);
  
  let createdCount = 0;
  for (const product of products) {
    if (!product.analytics) {
      await prisma.productAnalytics.create({
        data: {
          productId: product.id,
          totalClicks: 0,
        },
      });
      createdCount++;
    }
  }
  
  console.log(`Successfully initialized ProductAnalytics for ${createdCount} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
