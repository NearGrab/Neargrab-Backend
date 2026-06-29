const { prisma } = require("./config/prisma");

async function main() {
  const halfHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  console.log("Checking MediaAssets created since:", halfHourAgo.toISOString());
  
  const media = await prisma.mediaAsset.findMany({
    where: {
      createdAt: { gte: halfHourAgo }
    },
    orderBy: { createdAt: "desc" }
  });
  console.log(`Found ${media.length} recent MediaAssets:`, JSON.stringify(media, null, 2));

  const products = await prisma.product.findMany({
    where: {
      createdAt: { gte: halfHourAgo }
    },
    orderBy: { createdAt: "desc" }
  });
  console.log(`Found ${products.length} recent Products:`, JSON.stringify(products, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
