const COINGECKO_BASE_URL = 'https://pro-api.coingecko.com/api/v3';

export async function fetchCoinGecko(endpoint: string, params: Record<string, string> = {}) {
  const apiKey = process.env.COINGECKO_API_KEY;
  if (!apiKey) {
    throw new Error('Missing COINGECKO_API_KEY environment variable');
  }

  const url = new URL(`${COINGECKO_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'x-cg-pro-api-key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`CoinGecko API Error: ${response.statusText}`);
  }

  return response.json();
}

