/*
  Warnings:

  - You are about to drop the column `sortino` on the `BacktestRun` table. All the data in the column will be lost.
  - You are about to drop the column `universe` on the `BacktestRun` table. All the data in the column will be lost.
  - You are about to drop the column `window` on the `BacktestRun` table. All the data in the column will be lost.
  - Added the required column `universeSize` to the `BacktestRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `windowDays` to the `BacktestRun` table without a default value. This is not possible if the table is not empty.
  - Made the column `sharpe` on table `BacktestRun` required. This step will fail if there are existing NULL values in that column.
  - Made the column `maxDrawdown` on table `BacktestRun` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "BacktestRun_createdAt_idx";

-- AlterTable
ALTER TABLE "BacktestRun" DROP COLUMN "sortino",
DROP COLUMN "universe",
DROP COLUMN "window",
ADD COLUMN     "universeSize" INTEGER NOT NULL,
ADD COLUMN     "windowDays" INTEGER NOT NULL,
ALTER COLUMN "sharpe" SET NOT NULL,
ALTER COLUMN "maxDrawdown" SET NOT NULL;

-- CreateTable
CREATE TABLE "SignalDaily" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "risk" TEXT NOT NULL,
    "outlook" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignalDaily_date_decision_idx" ON "SignalDaily"("date", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "SignalDaily_date_token_key" ON "SignalDaily"("date", "token");
