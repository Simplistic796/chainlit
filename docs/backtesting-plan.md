# Backtesting Plan: Multi-Agent Strategy Validation

## Dataset & Universe
- **Universe**: Top 200 by mcap + new listings
- **Time Period**: 2+ years of historical data
- **Data Sources**: CoinGecko, DEX data, on-chain metrics, social sentiment
- **Rebalance Frequency**: Daily/weekly rebalancing windows
- **Positioning**: Long-only initially, long/flat later, long/short future

## Trading Rules & Execution
- **Position Sizing**: Proportional to confidence scores, risk parity option
- **Entry/Exit**: Based on agent consensus decisions
- **Rebalancing**: Systematic rebalancing at specified intervals
- **Risk Management**: Position limits, stop-losses, portfolio heat limits
- **Execution Costs**: Spread + slippage + fee placeholders for realistic modeling

## Performance Metrics
- **Risk-Adjusted Returns**: Sharpe ratio, Sortino ratio, Calmar ratio
- **Risk Metrics**: Maximum drawdown, Value at Risk (VaR), volatility
- **Performance Metrics**: Hit rate, win/loss ratio, average holding period
- **Efficiency Metrics**: Turnover ratio, transaction costs, slippage impact
- **Benchmarks**: Buy-and-hold, equal-weight, market-cap weighted

## Backtesting Framework
- **Walk-Forward Analysis**: Out-of-sample validation with rolling windows
- **Monte Carlo Simulation**: Stress testing with various market conditions
- **Regime Analysis**: Performance across bull/bear/sideways markets
- **Parameter Sensitivity**: Testing different confidence thresholds and weights
- **Robustness Checks**: Cross-validation and statistical significance testing
