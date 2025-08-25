# ChainLit Integrations & Keys (Prod Plan)

## Selected Providers (Phase 1)
- Market: CoinGecko (no key) or CoinMarketCap (key)
- On-chain/holders: Etherscan (key) + Alchemy/Infura (RPC key)
- DEX Liquidity: DexScreener (no key) / DefiLlama (no key)
- Sentiment/News: CryptoPanic (key), Reddit (app), (X/Twitter if available)
- Scam checks: Etherscan (contract verify/owner), Honeypot.is (if accessible), LP lock providers

## Environment Variables (server/.env)
# Core
NODE_ENV=development
PORT=3000

# Data providers
COINGECKO_BASE=https://api.coingecko.com/api/v3
COINMARKETCAP_KEY=
ETHERSCAN_KEY=
ALCHEMY_API_KEY=
INFURA_PROJECT_ID=
COVALENT_API_KEY=
MORALIS_API_KEY=
DEXSCREENER_BASE=https://api.dexscreener.com
DEFI_LLAMA_BASE=https://api.llama.fi
CRYPTOPANIC_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
TWITTER_BEARER_TOKEN=

# Database (Postgres, coming next step)
DATABASE_URL=
REDIS_URL=

## Notes
- Start with Ethereum mainnet; add others later.
- Cache aggressively; set per-provider rate limits.
- All secrets live in env vars; never commit .env.
