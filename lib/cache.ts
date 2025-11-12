// Simple in-memory cache for Edge Runtime
// Each edge region has its own cache instance
const CACHE = new Map<string, { data: string; time: number }>();

// Cache durations in milliseconds
// All endpoints cached for 5 minutes unless refresh is explicitly requested
export const CACHE_DURATIONS = {
  PRICES: 5 * 60 * 1000,          // 5 minutes - Token prices
  MARKETS: 5 * 60 * 1000,         // 5 minutes - Market caps / volume
  CHARTS: 30 * 60 * 1000,         // 30 minutes - Charts (OHLC)
  METADATA: 24 * 60 * 60 * 1000,  // 24 hours - Static project info
  TOKEN_DATA: 5 * 60 * 1000,      // 5 minutes - Alias for prices
};

export function getFromCache(key: string, ttl: number): any | null {
  const now = Date.now();
  const cached = CACHE.get(key);
  
  if (cached && now - cached.time < ttl) {
    try {
      return JSON.parse(cached.data);
    } catch {
      return cached.data;
    }
  }
  
  // Clean up expired entry
  if (cached) {
    CACHE.delete(key);
  }
  
  return null;
}

export function setCache(key: string, data: any): void {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  CACHE.set(key, {
    data: dataString,
    time: Date.now()
  });
}

// Get cache-control header value based on duration
export function getCacheControlHeader(ttl: number): string {
  const sMaxAge = Math.floor(ttl / 1000);
  const staleWhileRevalidate = Math.floor(sMaxAge / 2);
  return `s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
}

