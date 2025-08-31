/*
  Warnings:

  - You are about to drop the column `topEndpoint` on the `ApiUsageDaily` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ApiUsage" ADD COLUMN     "latencyMs" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ApiUsageDaily" DROP COLUMN "topEndpoint",
ADD COLUMN     "p95LatencyMs" DOUBLE PRECISION,
ADD COLUMN     "topEndpoints" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Portfolio',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" SERIAL NOT NULL,
    "portfolioId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holding_portfolioId_token_key" ON "Holding"("portfolioId", "token");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
