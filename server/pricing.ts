import type { CryptoCurrency, CryptoQuote } from '../src/types.ts';

interface CachedRates {
  solUsd: number;
  btcUsd: number;
  fetchedAt: number;
  source: string;
}

let cachedRates: CachedRates | null = null;
const CACHE_TTL_MS = 60_000;

async function fetchLiveRates(): Promise<CachedRates> {
  if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin&vs_currencies=usd',
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const json = (await res.json()) as {
        solana?: { usd?: number };
        bitcoin?: { usd?: number };
      };
      const solUsd = Number(json.solana?.usd);
      const btcUsd = Number(json.bitcoin?.usd);
      if (Number.isFinite(solUsd) && solUsd > 0 && Number.isFinite(btcUsd) && btcUsd > 0) {
        cachedRates = {
          solUsd,
          btcUsd,
          fetchedAt: Date.now(),
          source: 'CoinGecko Spot Feed',
        };
        return cachedRates;
      }
    }
  } catch {
    // Fall through to cached or conservative reference quote
  }

  if (cachedRates) return cachedRates;

  return {
    solUsd: 185,
    btcUsd: 90000,
    fetchedAt: Date.now(),
    source: 'Cached Reference Rate',
  };
}

export async function getCryptoQuote(
  currency: CryptoCurrency,
  priceUsd: number
): Promise<CryptoQuote> {
  if (currency === 'USDT_ERC20' || currency === 'USDC_ERC20') {
    return {
      currency,
      usdRate: 1,
      expectedAmount: priceUsd.toFixed(2),
      fetchedAt: new Date().toISOString(),
      source: 'USD Stablecoin Peg (1:1)',
    };
  }

  const rates = await fetchLiveRates();
  if (currency === 'SOL') {
    const expected = priceUsd / rates.solUsd;
    return {
      currency,
      usdRate: rates.solUsd,
      expectedAmount: expected.toFixed(6),
      fetchedAt: new Date(rates.fetchedAt).toISOString(),
      source: rates.source,
    };
  }

  const expected = priceUsd / rates.btcUsd;
  return {
    currency,
    usdRate: rates.btcUsd,
    expectedAmount: expected.toFixed(8),
    fetchedAt: new Date(rates.fetchedAt).toISOString(),
    source: rates.source,
  };
}
