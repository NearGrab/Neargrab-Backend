-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "city" TEXT NOT NULL DEFAULT 'Surat',
ADD COLUMN     "googleMapsUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredCity" TEXT;

-- CreateTable
CREATE TABLE "ProductAnalytics" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAnalytics_productId_key" ON "ProductAnalytics"("productId");

-- AddForeignKey
ALTER TABLE "ProductAnalytics" ADD CONSTRAINT "ProductAnalytics_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
