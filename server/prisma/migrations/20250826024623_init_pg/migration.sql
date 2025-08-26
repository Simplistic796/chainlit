-- CreateTable
CREATE TABLE "TokenLookup" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "risk" TEXT NOT NULL,
    "outlook" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenLookup_createdAt_idx" ON "TokenLookup"("createdAt");

-- CreateIndex
CREATE INDEX "TokenLookup_token_createdAt_idx" ON "TokenLookup"("token", "createdAt");
