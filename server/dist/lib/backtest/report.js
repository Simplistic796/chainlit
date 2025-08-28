"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backtestSummary = backtestSummary;
const prisma_1 = require("../../db/prisma");
const stats_1 = require("../quant/stats");
async function backtestSummary(days = 30) {
    // fetch the most recent N+1 days of signals (to get next-day prices)
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await prisma_1.prisma.signalDaily.findMany({
        where: { date: { gte: new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate())) } },
        orderBy: [{ date: "asc" }, { token: "asc" }],
    });
    // group by date
    const byDate = new Map();
    for (const r of rows) {
        const key = r.date.toISOString().slice(0, 10);
        const arr = byDate.get(key) || [];
        arr.push({ date: r.date, token: r.token, decision: r.decision, priceUsd: r.priceUsd });
        byDate.set(key, arr);
    }
    const dates = Array.from(byDate.keys()).sort();
    const dailyRets = [];
    for (let i = 0; i < dates.length - 1; i++) {
        const d = dates[i], d1 = dates[i + 1];
        if (!d || !d1)
            continue;
        const today = byDate.get(d);
        const next = byDate.get(d1);
        if (!today || !next)
            continue;
        // map token -> next day price
        const nextPrice = new Map(next.map(r => [r.token, r.priceUsd]));
        const buys = today.filter(r => r.decision === "BUY");
        if (buys.length === 0) {
            dailyRets.push(0);
            continue;
        }
        let basketRet = 0;
        for (const b of buys) {
            const p0 = b.priceUsd;
            const p1 = nextPrice.get(b.token);
            if (!p1 || p0 <= 0)
                continue;
            basketRet += (p1 - p0) / p0;
        }
        basketRet = basketRet / buys.length;
        dailyRets.push(basketRet);
    }
    // metrics
    const cum = dailyRets.reduce((acc, r) => acc * (1 + r), 1) - 1;
    const m = (0, stats_1.mean)(dailyRets);
    const s = (0, stats_1.stdev)(dailyRets);
    const sharpe = s === 0 ? 0 : m / s;
    // max drawdown from equity curve
    let equity = 1, peak = 1, maxDD = 0;
    for (const r of dailyRets) {
        equity *= (1 + r);
        if (equity > peak)
            peak = equity;
        const dd = (peak - equity) / peak;
        if (dd > maxDD)
            maxDD = dd;
    }
    return {
        windowDays: days,
        dailyCount: dailyRets.length,
        cumulativeReturn: cum, // e.g., 0.21 = +21%
        meanDaily: m,
        stdevDaily: s,
        sharpeDaily: sharpe, // daily Sharpe-like (not annualized)
        maxDrawdown: maxDD,
    };
}
//# sourceMappingURL=report.js.map