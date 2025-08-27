-- CreateTable
CREATE TABLE "AgentRun" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "inputsJSON" JSONB NOT NULL,
    "outputJSON" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsensusRun" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationaleJSON" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsensusRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" SERIAL NOT NULL,
    "universe" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL,
    "sharpe" DOUBLE PRECISION,
    "sortino" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "detailsJSON" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRun_token_createdAt_idx" ON "AgentRun"("token", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_agentType_createdAt_idx" ON "AgentRun"("agentType", "createdAt");

-- CreateIndex
CREATE INDEX "ConsensusRun_token_createdAt_idx" ON "ConsensusRun"("token", "createdAt");

-- CreateIndex
CREATE INDEX "BacktestRun_createdAt_idx" ON "BacktestRun"("createdAt");
