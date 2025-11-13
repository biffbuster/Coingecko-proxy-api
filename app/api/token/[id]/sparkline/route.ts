import type { NextRequest } from 'next/server';
import { tokenList, getCoinIdFromTicker, parseStartDateToTimestamp } from '../../../../../lib/tokens';
import { getFromCache, getStaleCache, setCache, CACHE_DURATIONS, getCacheControlHeader } from '../../../../../lib/cache';
import { checkRateLimit, getClientIP } from '../../../../../lib/rate-limit';

export const runtime = 'edge';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

// Use longer cache duration for sparklines to reduce API calls and prevent rate limiting
// Chart data doesn't change frequently, so 1 hour cache is reasonable
const TTL = 60 * 60 * 1000; // 1 hour for sparkline data (longer than CHARTS to reduce calls)

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
  { params }: { params: Promise<{ id: string }> }
) {
  // Capture ticker early so we can use it in catch block
  let ticker = 'UNKNOWN';
  let tokenFromList = null;
  
  try {
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return json({ error: 'Rate limit exceeded' }, 429);
    }

    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    const { id } = await params;
    ticker = id.toUpperCase();
    tokenFromList = tokenList.find(t => t.ticker.toUpperCase() === ticker);
    
    if (!tokenFromList) {
      // Return success: true with empty arrays to keep endpoint "online"
      return json({
        success: true,
        ticker: ticker,
        name: '',
        startDate: '',
        coinId: '',
        from: 0,
        to: Math.floor(Date.now() / 1000),
        days: 0,
        points: [],
        prices: [],
        marketCaps: [],
        volumes: [],
        priceArray: [],
        timeArray: [],
        timestampArray: [],
        marketCapArray: [],
        volumeArray: [],
        currentPrice: 0,
        startPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        minPrice: 0,
        maxPrice: 0,
        dataPoints: 0,
        error: 'Token not found',
        message: `Token ${ticker} not found in token list`
      }, 200);
    }

    const coinId = getCoinIdFromTicker(ticker);
    
    // Parse start date to Unix timestamp (seconds)
    const from = parseStartDateToTimestamp(tokenFromList.startDate);
    const to = Math.floor(Date.now() / 1000); // Current time in Unix seconds
    
    // Cache key uses from and date (rounded to day) to ensure cache works across requests in same day
    // Round 'to' to current day start to ensure cache hits throughout the day
    // This reduces API calls significantly since sparkline data only updates once per day
    const todayStart = Math.floor(to / (24 * 60 * 60)) * (24 * 60 * 60);
    const cacheKey = `token_sparkline_${coinId}_${from}_${todayStart}`;
    
    // Bypass cache if refresh is requested
    if (!forceRefresh) {
      const cached = getFromCache(cacheKey, TTL);
      if (cached) {
        return json(cached, 200, { 'X-Cache': 'HIT' });
      }
    }

    // Fetch market chart data from CoinGecko Pro API using range endpoint
    // This gets data from start date to current date with daily granularity
    // Using Pro API with API key for higher rate limits and better reliability
    // Daily granularity is automatically applied for ranges > 90 days
    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) {
      // Return cached data if available when API key is missing
      const staleCache = getStaleCache(cacheKey);
      if (staleCache) {
        return json(staleCache, 200, { 'X-Cache': 'STALE', 'X-Error': 'Missing API key' });
      }
      
      return json({
        success: true,
        ticker: ticker,
        name: tokenFromList.name,
        startDate: tokenFromList.startDate,
        coinId: coinId,
        from: from,
        to: to,
        days: 0,
        points: [],
        prices: [],
        marketCaps: [],
        volumes: [],
        priceArray: [],
        timeArray: [],
        timestampArray: [],
        marketCapArray: [],
        volumeArray: [],
        currentPrice: 0,
        startPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        minPrice: 0,
        maxPrice: 0,
        dataPoints: 0,
        error: 'Configuration error',
        message: 'Missing COINGECKO_API_KEY environment variable'
      }, 200);
    }

    // Use Pro API directly to get better error handling for rate limits
    const coinGeckoUrl = new URL(`https://pro-api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart/range`);
    coinGeckoUrl.searchParams.set('vs_currency', 'usd');
    coinGeckoUrl.searchParams.set('from', from.toString());
    coinGeckoUrl.searchParams.set('to', to.toString());
    // Leave interval empty for auto granularity (will use daily for ranges > 90 days)
    
    try {
      const response = await fetch(coinGeckoUrl.toString(), {
        headers: {
          'x-cg-pro-api-key': apiKey,
          'accept': 'application/json'
        }
      });

      // Handle rate limiting with stale cache fallback
      if (response.status === 429) {
        // Return cached data if available, even if expired (stale-while-revalidate pattern)
        const staleCache = getStaleCache(cacheKey); // Get any cached data regardless of TTL
        if (staleCache) {
          return json(staleCache, 200, { 'X-Cache': 'STALE', 'X-Rate-Limited': 'true' });
        }
        
        return json({
          success: true,
          ticker: ticker,
          name: tokenFromList.name,
          startDate: tokenFromList.startDate,
          coinId: coinId,
          from: from,
          to: to,
          days: 0,
          points: [],
          prices: [],
          marketCaps: [],
          volumes: [],
          priceArray: [],
          timeArray: [],
          timestampArray: [],
          marketCapArray: [],
          volumeArray: [],
          currentPrice: 0,
          startPrice: 0,
          priceChange: 0,
          priceChangePercent: 0,
          minPrice: 0,
          maxPrice: 0,
          dataPoints: 0,
          error: 'Rate Limited',
          message: 'CoinGecko Pro API rate limit exceeded. Cached data will be served when available.'
        }, 200);
      }

      if (!response.ok) {
        // For other errors, try to get cached data first (stale cache fallback)
        const staleCache = getStaleCache(cacheKey);
        if (staleCache) {
          return json(staleCache, 200, { 'X-Cache': 'STALE', 'X-Error': `API Error ${response.status}` });
        }
        
        let errorDetail = 'Unknown error';
        try {
          const errorBody = await response.json().catch(() => null);
          if (errorBody && typeof errorBody === 'object') {
            errorDetail = JSON.stringify(errorBody);
          } else {
            const errorText = await response.text().catch(() => response.statusText);
            errorDetail = errorText || response.statusText;
          }
        } catch {
          errorDetail = response.statusText || 'Unknown error';
        }
        
        return json({
          success: true,
          ticker: ticker,
          name: tokenFromList.name,
          startDate: tokenFromList.startDate,
          coinId: coinId,
          from: from,
          to: to,
          days: 0,
          points: [],
          prices: [],
          marketCaps: [],
          volumes: [],
          priceArray: [],
          timeArray: [],
          timestampArray: [],
          marketCapArray: [],
          volumeArray: [],
          currentPrice: 0,
          startPrice: 0,
          priceChange: 0,
          priceChangePercent: 0,
          minPrice: 0,
          maxPrice: 0,
          dataPoints: 0,
          error: response.status === 404 ? 'Token not found on CoinGecko' : 'API Error',
          message: response.status === 404 
            ? `The coin ID "${coinId}" for ticker "${ticker}" may not exist on CoinGecko yet`
            : `CoinGecko Pro API returned ${response.status}: ${errorDetail}`
        }, 200);
      }

      const data = await response.json();

      // Format data for sparklines
      // CoinGecko returns: { prices: [[timestamp_ms, price]], market_caps: [[timestamp_ms, cap]], total_volumes: [[timestamp_ms, volume]] }
      // Convert to normalized format with time in seconds and price
      const prices = (data.prices || []).map((item: [number, number]) => ({
        time: Math.floor(item[0] / 1000), // Convert ms to seconds
        timestamp: item[0], // Keep original ms timestamp
        price: item[1]
      }));

      const marketCaps = (data.market_caps || []).map((item: [number, number]) => ({
        time: Math.floor(item[0] / 1000),
        timestamp: item[0],
        marketCap: item[1]
      }));

      const volumes = (data.total_volumes || []).map((item: [number, number]) => ({
        time: Math.floor(item[0] / 1000),
        timestamp: item[0],
        volume: item[1]
      }));

      // If we have no data, return empty structure but still success: true
      // This allows the endpoint to show as "online" even if there's no data
      if (prices.length === 0) {
        return json({
          success: true,
          ticker: ticker,
          name: tokenFromList.name,
          startDate: tokenFromList.startDate,
          coinId: coinId,
          from: from,
          to: to,
          days: 0,
          points: [],
          prices: [],
          marketCaps: [],
          volumes: [],
          priceArray: [],
          timeArray: [],
          timestampArray: [],
          marketCapArray: [],
          volumeArray: [],
          currentPrice: 0,
          startPrice: 0,
          priceChange: 0,
          priceChangePercent: 0,
          minPrice: 0,
          maxPrice: 0,
          dataPoints: 0,
          message: 'No historical data available - token may not have trading history yet'
        }, 200);
      }

      // Extract arrays for easy sparkline rendering
      const priceArray = prices.map(p => p.price);
      const timeArray = prices.map(p => p.time); // Unix seconds
      const timestampArray = prices.map(p => p.timestamp); // Unix milliseconds
      const marketCapArray = marketCaps.map(m => m.marketCap);
      const volumeArray = volumes.map(v => v.volume);

      // Calculate price change from start to now
      const startPrice = prices[0].price;
      const endPrice = prices[prices.length - 1].price;
      const priceChange = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
      const priceChangeAmount = endPrice - startPrice;

      // Calculate number of days in range
      const daysInRange = Math.ceil((to - from) / (24 * 60 * 60));

      const responseData = {
        success: true,
        ticker: ticker,
        name: tokenFromList.name,
        startDate: tokenFromList.startDate,
        coinId: coinId,
        from: from,
        to: to,
        days: daysInRange,
        // Full data arrays with timestamps (time in seconds)
        points: prices.map(p => ({ time: p.time, price: p.price })),
        prices: prices,
        marketCaps: marketCaps,
        volumes: volumes,
        // Simple arrays for sparkline rendering
        priceArray: priceArray,
        timeArray: timeArray, // Unix seconds
        timestampArray: timestampArray, // Unix milliseconds
        marketCapArray: marketCapArray,
        volumeArray: volumeArray,
        // Summary statistics
        currentPrice: endPrice,
        startPrice: startPrice,
        priceChange: priceChangeAmount,
        priceChangePercent: priceChange,
        minPrice: priceArray.length > 0 ? Math.min(...priceArray) : 0,
        maxPrice: priceArray.length > 0 ? Math.max(...priceArray) : 0,
        dataPoints: prices.length
      };

      setCache(cacheKey, responseData);
      return json(responseData, 200, { 'X-Cache': 'MISS' });
    } catch (apiError: unknown) {
      // Handle network/parsing errors - try to return stale cache
      const staleCache = getStaleCache(cacheKey);
      if (staleCache) {
        return json(staleCache, 200, { 'X-Cache': 'STALE', 'X-Error': 'Network error' });
      }
      
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      return json({
        success: true,
        ticker: ticker,
        name: tokenFromList.name,
        startDate: tokenFromList.startDate,
        coinId: coinId,
        from: from,
        to: to,
        days: 0,
        points: [],
        prices: [],
        marketCaps: [],
        volumes: [],
        priceArray: [],
        timeArray: [],
        timestampArray: [],
        marketCapArray: [],
        volumeArray: [],
        currentPrice: 0,
        startPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        minPrice: 0,
        maxPrice: 0,
        dataPoints: 0,
        error: 'Network Error',
        message: `Failed to fetch data from CoinGecko Pro API: ${errorMessage}`
      }, 200);
    }
  } catch (err: unknown) {
    // For any other errors (network, parsing, etc.), return empty structure but success: true
    // This keeps the endpoint "online" even if there's a transient error
    const message = err instanceof Error ? err.message : 'Unknown error';
    
    return json({
      success: true,
      ticker: ticker,
      name: tokenFromList?.name || '',
      startDate: tokenFromList?.startDate || '',
      coinId: '',
      from: 0,
      to: Math.floor(Date.now() / 1000),
      days: 0,
      points: [],
      prices: [],
      marketCaps: [],
      volumes: [],
      priceArray: [],
      timeArray: [],
      timestampArray: [],
      marketCapArray: [],
      volumeArray: [],
      currentPrice: 0,
      startPrice: 0,
      priceChange: 0,
      priceChangePercent: 0,
      minPrice: 0,
      maxPrice: 0,
      dataPoints: 0,
      error: 'Request failed',
      message: `Error fetching data: ${message}`
    }, 200);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: cors });
}

