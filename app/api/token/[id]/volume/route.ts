import type { NextRequest } from 'next/server';
import { tokenList, getCoinIdFromTicker } from '../../../../../lib/tokens';
import { fetchCoinGecko } from '../../../../../lib/coingecko';
import { getFromCache, setCache, CACHE_DURATIONS, getCacheControlHeader } from '../../../../../lib/cache';
import { checkRateLimit, getClientIP } from '../../../../../lib/rate-limit';

export const runtime = 'edge';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

const TTL = CACHE_DURATIONS.MARKETS; // 5 minutes for market cap/volume data

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': getCacheControlHeader(TTL),
      ...cors,
      ...extra,
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return json({ error: 'Rate limit exceeded' }, 429);
    }

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    const ticker = params.id.toUpperCase();
    const tokenFromList = tokenList.find(t => t.ticker.toUpperCase() === ticker);
    
    if (!tokenFromList) {
      return json({ success: false, error: `Token ${ticker} not found in token list` }, 404);
    }

    const coinId = getCoinIdFromTicker(ticker);
    const cacheKey = `token_volume_${coinId}`;
    
    // Bypass cache if refresh is requested
    if (!forceRefresh) {
      const cached = getFromCache(cacheKey, TTL);
      if (cached) {
        return json(cached, 200, { 'X-Cache': 'HIT' });
      }
    }

    const data = await fetchCoinGecko(`/coins/${coinId}`, {
      localization: 'false',
      tickers: 'false',
      community_data: 'false',
      developer_data: 'false'
    });

    const response = {
      success: true,
      data: {
        ticker: ticker,
        name: data.name || tokenFromList.name,
        startDate: tokenFromList.startDate,
        totalVolume: data.market_data?.total_volume?.usd || 0,
        marketCap: data.market_data?.market_cap?.usd || 0,
        marketCapRank: data.market_cap_rank || 0
      }
    };

    setCache(cacheKey, response);
    return json(response, 200, { 'X-Cache': 'MISS' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ success: false, error: message }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: cors });
}

