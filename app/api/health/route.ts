import type { NextRequest } from 'next/server';
import { tokenList } from '../../../lib/tokens';

export const runtime = 'edge';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

export async function GET(req: NextRequest) {
  return new Response(JSON.stringify({
    success: true,
    message: 'CoinGecko Proxy API is running',
    tokensLoaded: tokenList.length,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...cors,
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: cors });
}

