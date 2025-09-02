import { prisma } from "../src/db/prisma";

async function main() {
  const up = async (key: string, description: string, defaultOn = false) => {
    await (prisma as any).featureFlag.upsert({
      where: { key },
      update: { description, defaultOn },
      create: { key, description, defaultOn },
    });
  };

  await up("agent.sentiment.v1", "Enable Sentiment agent v1", true);
  await up("agent.valuation.v1", "Enable Valuation agent v1", true);
  await up("agent.risk.v1", "Enable Risk agent v1", true);
  await up("portfolio.pnl", "Enable Portfolio PnL view", true);
  await up("alerts.webhook", "Enable webhook alerts", true);
  await up("agent.valuation.v2", "New valuation model (canary)", false);
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});


