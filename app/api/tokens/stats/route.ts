import type { NextRequest } from 'next/server';
import { tokenList, getCoinIdFromTicker } from '../../../../lib/tokens';
import { getFromCache, setCache, CACHE_DURATIONS, getCacheControlHeader } from '../../../../lib/cache';
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limit';
import { fetchCoinGecko } from '../../../../lib/coingecko';

export const runtime = 'edge';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

const TTL = CACHE_DURATIONS.MARKETS; // 5 minutes for market data

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

export async function GET(req: NextRequest) {
  try {
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return json({ error: 'Rate limit exceeded' }, 429);
    }

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const categoryFilter = url.searchParams.get('category'); // Optional filter by category

    const cacheKey = categoryFilter 
      ? `tokens_stats_category_${categoryFilter.toLowerCase().replace(/\s+/g, '_')}` 
      : 'tokens_stats_all';

    // Check cache
    if (!forceRefresh) {
      const cached = getFromCache(cacheKey, TTL);
      if (cached) {
        return json(cached, 200, { 'X-Cache': 'HIT' });
      }
    }

    // Filter tokens by category if specified
    const tokensToProcess = categoryFilter
      ? tokenList.filter(t => t.category?.toLowerCase() === categoryFilter.toLowerCase())
      : tokenList;

    // Fetch market data for all tokens in parallel (with error handling)
    const tokenPromises = tokensToProcess.map(async (token) => {
      try {
        const coinId = getCoinIdFromTicker(token.ticker);
        const data = await fetchCoinGecko(`/coins/${coinId}`, {
          localization: 'false',
          tickers: 'false',
          community_data: 'false',
          developer_data: 'false'
        });

        return {
          ticker: token.ticker,
          name: token.name,
          category: token.category || 'Uncategorized',
          marketCap: data.market_data?.market_cap?.usd || 0,
          totalVolume24h: data.market_data?.total_volume?.usd || 0,
          currentPrice: data.market_data?.current_price?.usd || 0,
          priceChange24h: data.market_data?.price_change_percentage_24h || 0,
          success: true
        };
      } catch (err) {
        // Handle errors gracefully - return 0 values for failed tokens
        return {
          ticker: token.ticker,
          name: token.name,
          category: token.category || 'Uncategorized',
          marketCap: 0,
          totalVolume24h: 0,
          currentPrice: 0,
          priceChange24h: 0,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
      }
    });

    // Wait for all requests
    const tokenData = await Promise.all(tokenPromises);

    // Calculate overall totals
    const totals = tokenData.reduce((acc, token) => {
      acc.totalMarketCap += token.marketCap;
      acc.totalVolume24h += token.totalVolume24h;
      acc.successfulTokens += token.success ? 1 : 0;
      acc.failedTokens += token.success ? 0 : 1;
      return acc;
    }, {
      totalMarketCap: 0,
      totalVolume24h: 0,
      successfulTokens: 0,
      failedTokens: 0
    });

    // Group by category and calculate category totals
    const byCategory = tokenData.reduce((acc, token) => {
      const category = token.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = {
          category,
          tokenCount: 0,
          totalMarketCap: 0,
          totalVolume24h: 0,
          successfulTokens: 0,
          failedTokens: 0,
          tokens: []
        };
      }
      acc[category].tokenCount += 1;
      acc[category].totalMarketCap += token.marketCap;
      acc[category].totalVolume24h += token.totalVolume24h;
      if (token.success) {
        acc[category].successfulTokens += 1;
      } else {
        acc[category].failedTokens += 1;
      }
      acc[category].tokens.push({
        ticker: token.ticker,
        name: token.name,
        marketCap: token.marketCap,
        volume24h: token.totalVolume24h,
        price: token.currentPrice,
        priceChange24h: token.priceChange24h
      });
      return acc;
    }, {} as Record<string, any>);

    // Convert grouped object to array and sort by market cap
    const categories = Object.values(byCategory)
      .map((cat: any) => ({
        ...cat,
        tokens: cat.tokens.sort((a: any, b: any) => b.marketCap - a.marketCap)
      }))
      .sort((a: any, b: any) => b.totalMarketCap - a.totalMarketCap);

    const response = {
      success: true,
      summary: {
        totalTokens: tokensToProcess.length,
        successfulTokens: totals.successfulTokens,
        failedTokens: totals.failedTokens,
        totalMarketCap: totals.totalMarketCap,
        totalVolume24h: totals.totalVolume24h,
        averageMarketCap: totals.successfulTokens > 0 
          ? totals.totalMarketCap / totals.successfulTokens 
          : 0,
        averageVolume24h: totals.successfulTokens > 0
          ? totals.totalVolume24h / totals.successfulTokens
          : 0
      },
      byCategory: categories,
      // Optional: include raw token data for custom aggregation
      tokens: tokenData.map(t => ({
        ticker: t.ticker,
        name: t.name,
        category: t.category,
        marketCap: t.marketCap,
        volume24h: t.totalVolume24h,
        price: t.currentPrice,
        priceChange24h: t.priceChange24h
      }))
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

