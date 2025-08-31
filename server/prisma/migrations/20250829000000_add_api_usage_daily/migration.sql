-- CreateTable
CREATE TABLE "ApiUsageDaily" (
    "id" SERIAL NOT NULL,
    "apiKeyId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "ok2xx" INTEGER NOT NULL DEFAULT 0,
    "client4xx" INTEGER NOT NULL DEFAULT 0,
    "server5xx" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION,
    "topEndpoint" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsageDaily_apiKeyId_date_key" ON "ApiUsageDaily"("apiKeyId", "date");

-- CreateIndex
CREATE INDEX "ApiUsageDaily_apiKeyId_date_idx" ON "ApiUsageDaily"("apiKeyId", "date");

-- CreateIndex
CREATE INDEX "ApiUsageDaily_date_idx" ON "ApiUsageDaily"("date");

-- AddForeignKey
ALTER TABLE "ApiUsageDaily" ADD CONSTRAINT "ApiUsageDaily_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
