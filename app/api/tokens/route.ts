import type { NextRequest } from 'next/server';
import { tokenList } from '../../../lib/tokens';
import { getFromCache, setCache, CACHE_DURATIONS, getCacheControlHeader } from '../../../lib/cache';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';

export const runtime = 'edge';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

const TTL = CACHE_DURATIONS.METADATA; // 24 hours for static token list

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

    const cacheKey = 'tokens_list';
    
    // Bypass cache if refresh is requested
    if (!forceRefresh) {
      const cached = getFromCache(cacheKey, TTL);
      if (cached) {
        return json(cached, 200, { 'X-Cache': 'HIT' });
      }
    }

    const response = {
      success: true,
      count: tokenList.length,
      data: tokenList
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

