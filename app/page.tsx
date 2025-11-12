'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

interface EndpointStatus {
  name: string;
  status: 'online' | 'offline' | 'checking';
  responseTime: number | null;
  endpoint: string;
}

interface StatusData {
  uptime: string;
  totalRequests: number;
  cacheHitRate: string;
  endpoints: EndpointStatus[];
}

export default function APIStatusDashboard() {
  const [isDark, setIsDark] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [testToken, setTestToken] = useState<string>('APT');
  
  const initialStatus: StatusData = {
    uptime: '0m',
    totalRequests: 0,
    cacheHitRate: '0%',
    endpoints: [
      { name: 'Health Check', status: 'checking', responseTime: null, endpoint: '/api/health' },
      { name: 'All Tokens', status: 'checking', responseTime: null, endpoint: '/api/tokens' },
      { name: 'Token Data', status: 'checking', responseTime: null, endpoint: `/api/token/${testToken}` },
      { name: 'Token Price', status: 'checking', responseTime: null, endpoint: `/api/token/${testToken}/price` },
      { name: 'Price Change', status: 'checking', responseTime: null, endpoint: `/api/token/${testToken}/price-change` },
      { name: 'Volume', status: 'checking', responseTime: null, endpoint: `/api/token/${testToken}/volume` },
    ],
  };
  
  const [status, setStatus] = useState<StatusData>(initialStatus);
  const [testCounter, setTestCounter] = useState(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  const testCounterRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);
  const isRateLimitedRef = useRef(false);
  const statusRef = useRef<StatusData>(initialStatus);

  // Sync ref with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const isJsonResponse = (res: Response) =>
    (res.headers.get('content-type') || '').toLowerCase().includes('application/json');

  const validatePayload = async (endpointName: string, res: Response) => {
    if (!isJsonResponse(res)) return false;

    const body = await res.json().catch(() => null as any);
    if (!body) return false;

    switch (endpointName) {
      case 'Health Check':
        return body.success === true && typeof body.message === 'string';

      case 'All Tokens':
        return body.success === true && Array.isArray(body.data) && body.data.length > 0;

      case 'Token Data':
        return body.success === true && body.data && typeof body.data === 'object' && body.data.id && typeof body.data.currentPrice === 'number';

      case 'Token Price':
        return body.success === true && body.data && typeof body.data === 'object' && typeof body.data.currentPrice === 'number';

      case 'Price Change':
        return body.success === true && body.data && typeof body.data === 'object' && typeof body.data.priceChange24h === 'number';

      case 'Volume':
        return body.success === true && body.data && typeof body.data === 'object' && typeof body.data.totalVolume === 'number';

      default:
        return res.ok && body.success !== false;
    }
  };

  const calculateUptime = () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getTestInterval = useCallback(() => {
    if (isRateLimitedRef.current) return 600000; // 10 minutes if rate limited
    if (consecutiveErrorsRef.current > 3) return 900000; // 15 minutes if many errors
    return 300000; // 5 minutes normal
  }, []);

  const checkEndpointHealth = useCallback(async (forceRefresh = false) => {
    // Use current testToken from state
    const currentToken = testToken || 'APT';
    const endpoints = [
      { name: 'Health Check', status: 'checking' as const, responseTime: null, endpoint: '/api/health' },
      { name: 'All Tokens', status: 'checking' as const, responseTime: null, endpoint: '/api/tokens' },
      { name: 'Token Data', status: 'checking' as const, responseTime: null, endpoint: `/api/token/${currentToken}` },
      { name: 'Token Price', status: 'checking' as const, responseTime: null, endpoint: `/api/token/${currentToken}/price` },
      { name: 'Price Change', status: 'checking' as const, responseTime: null, endpoint: `/api/token/${currentToken}/price-change` },
      { name: 'Volume', status: 'checking' as const, responseTime: null, endpoint: `/api/token/${currentToken}/volume` },
    ];

    const tests = endpoints.map((ep, idx) => ({
      ...ep,
      key: idx,
    }));

    const testsToRun = tests;

    // Run async tests
    const results = await Promise.all(
      testsToRun.map(async (test) => {
        try {
          const start = Date.now();
          // Add ?refresh=true to bypass cache when refresh button is clicked
          const url = forceRefresh && !test.endpoint.includes('/health') && !test.endpoint.includes('/tokens')
            ? `${test.endpoint}?refresh=true`
            : test.endpoint;
          const res = await fetch(url, {
            cache: 'no-store',
          });
          const ms = Date.now() - start;

          if (res.status === 429) {
            return { test, status: 'online' as const, responseTime: ms, cacheHit: false, error: false, rateLimited: true };
          }

          const cacheHeader = (res.headers.get('X-Cache') || '').toUpperCase();
          const cacheHit = cacheHeader.includes('HIT') || cacheHeader.includes('CACHED');

          const ok = await validatePayload(test.name, res);
          const status: 'online' | 'offline' = ok ? 'online' : 'offline';
          return { test, status, responseTime: ms, cacheHit, error: !ok, rateLimited: false };
        } catch {
          return { test, status: 'offline' as const, responseTime: null, cacheHit: false, error: true, rateLimited: false };
        }
      })
    );

    // Update state with results
    setStatus((prevStatus) => {
      const newEndpoints = [...prevStatus.endpoints];
      let totalRequests = 0;
      let cacheHits = 0;
      let errorCount = 0;
      let rateLimited = false;

      results.forEach((result) => {
        totalRequests++;
        if (result.cacheHit) cacheHits++;
        if (result.error) errorCount++;
        if (result.rateLimited) rateLimited = true;
        newEndpoints[result.test.key] = { 
          ...result.test, 
          status: result.status, 
          responseTime: result.responseTime 
        };
      });

      const hitRate = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;

      setLastUpdate(new Date());
      testCounterRef.current = testCounterRef.current + 1;
      setTestCounter(testCounterRef.current);
      consecutiveErrorsRef.current = errorCount > 0 ? consecutiveErrorsRef.current + 1 : 0;
      setConsecutiveErrors(consecutiveErrorsRef.current);
      isRateLimitedRef.current = rateLimited;
      setIsRateLimited(rateLimited);

      const newStatus = {
        uptime: calculateUptime(),
        totalRequests: prevStatus.totalRequests + totalRequests,
        cacheHitRate: `${hitRate}%`,
        endpoints: newEndpoints,
      };
      
      // Update ref
      statusRef.current = newStatus;
      
      return newStatus;
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      setIsDark(savedTheme !== 'light');
    }

    checkEndpointHealth(false);

    let timeoutId: NodeJS.Timeout;
    const scheduleNext = () => {
      const interval = getTestInterval();
      timeoutId = setTimeout(() => {
        checkEndpointHealth(false); // Don't force refresh on automatic checks
        scheduleNext();
      }, interval);
    };

    scheduleNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [checkEndpointHealth, getTestInterval, testToken]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    }
  };

  const overallStatus =
    status.endpoints.every((ep) => ep.status === 'online')
      ? 'online'
      : status.endpoints.some((ep) => ep.status === 'online')
      ? 'partial'
      : 'offline';

  // CoinGecko colors: lime green theme (matching CoinGecko branding)
  const themeClasses = isDark 
    ? 'bg-[#0a0a0a] text-white' 
    : 'bg-gray-100 text-gray-900';
  const cardClasses = isDark 
    ? 'bg-[#1a1a1a] border-[#2a2a2a]' 
    : 'bg-white border-gray-200';
  const headerTextClasses = isDark 
    ? 'text-[#8CC84B]' 
    : 'text-gray-600';

  return (
    <div className={`min-h-screen ${themeClasses} relative transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto px-6 py-8 relative">
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6">
          <button
            onClick={toggleTheme}
            className={`p-3 rounded-lg transition-colors ${
              isDark 
                ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#8CC84B] border border-[#8CC84B]/30' 
                : 'bg-white hover:bg-gray-50 text-gray-900 shadow-sm'
            }`}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Image 
              src="/coingecko_logo.svg" 
              alt="CoinGecko Logo" 
              width={48} 
              height={48}
              className="w-12 h-12"
            />
            <h1 className={`text-4xl font-bold bg-gradient-to-r from-[#8CC84B] to-[#6BA83A] bg-clip-text text-transparent`}>
              CoinGecko Proxy API
            </h1>
          </div>
          <p className={headerTextClasses}>Real-time monitoring of API endpoints and performance</p>
          
          {/* Token Input */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <label className={`text-sm font-medium ${isDark ? 'text-[#8CC84B]' : 'text-gray-700'}`}>
              Test Token (Ticker):
            </label>
            <input
              type="text"
              value={testToken}
              onChange={(e) => {
                const newToken = e.target.value.toUpperCase();
                setTestToken(newToken);
                // Update endpoints immediately
                setStatus(prev => ({
                  ...prev,
                  endpoints: [
                    { name: 'Health Check', status: prev.endpoints[0]?.status || 'checking', responseTime: prev.endpoints[0]?.responseTime || null, endpoint: '/api/health' },
                    { name: 'All Tokens', status: prev.endpoints[1]?.status || 'checking', responseTime: prev.endpoints[1]?.responseTime || null, endpoint: '/api/tokens' },
                    { name: 'Token Data', status: 'checking', responseTime: null, endpoint: `/api/token/${newToken}` },
                    { name: 'Token Price', status: 'checking', responseTime: null, endpoint: `/api/token/${newToken}/price` },
                    { name: 'Price Change', status: 'checking', responseTime: null, endpoint: `/api/token/${newToken}/price-change` },
                    { name: 'Volume', status: 'checking', responseTime: null, endpoint: `/api/token/${newToken}/volume` },
                  ]
                }));
              }}
              placeholder="APT, NEAR, DOT, INJ..."
              className={`px-4 py-2 rounded-lg border ${
                isDark 
                  ? 'bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#8CC84B]' 
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 ${
                isDark ? 'focus:ring-[#8CC84B]' : 'focus:ring-blue-500'
              }`}
            />
            <button
              onClick={() => checkEndpointHealth(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isDark 
                  ? 'bg-[#8CC84B] hover:bg-[#6BA83A] text-black' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Test
            </button>
          </div>
          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Enter a token ticker from the CSV list (e.g., APT, NEAR, DOT, INJ, BERA, etc.)
          </p>
        </div>

        {/* Overall Status */}
        <div className={`${cardClasses} rounded-lg shadow-lg border p-6 mb-8 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`w-4 h-4 rounded-full mr-3 ${
                  overallStatus === 'online' 
                    ? 'bg-[#8CC84B]' 
                    : overallStatus === 'partial' 
                    ? 'bg-yellow-500' 
                    : 'bg-red-500'
                }`}
              />
              <div>
                <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  API Status:{' '}
                  {overallStatus === 'online'
                    ? 'All Systems Online'
                    : overallStatus === 'partial'
                    ? 'Partial Outage'
                    : 'Service Offline'}
                </h2>
                <p className={`text-sm ${isDark ? 'text-[#8CC84B]' : 'text-gray-500'}`}>
                  Last updated: {isClient ? lastUpdate.toLocaleTimeString() : '--:--:--'}
                  {isRateLimited && (
                    <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded">
                      Rate Limited - Extended Intervals
                    </span>
                  )}
                  {consecutiveErrors > 0 && (
                    <span className="ml-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded">
                      {consecutiveErrors} Error(s) - Slowing Down
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => checkEndpointHealth(true)}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                isDark 
                  ? 'bg-[#8CC84B] hover:bg-[#6BA83A] text-black font-semibold' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Refresh Status
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className={`${cardClasses} rounded-lg shadow-lg border p-6 transition-colors duration-300`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-[#8CC84B]' : 'text-gray-600'}`}>Uptime</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{status.uptime}</p>
              </div>
              <div className={`w-8 h-8 ${isDark ? 'bg-[#8CC84B]/20' : 'bg-green-100'} rounded-lg flex items-center justify-center`}>
                <div className={`w-4 h-4 ${isDark ? 'bg-[#8CC84B]' : 'bg-green-600'} rounded`} />
              </div>
            </div>
          </div>

          <div className={`${cardClasses} rounded-lg shadow-lg border p-6 transition-colors duration-300`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-[#8CC84B]' : 'text-gray-600'}`}>Total Requests</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{status.totalRequests.toLocaleString()}</p>
              </div>
              <div className={`w-8 h-8 ${isDark ? 'bg-[#8CC84B]/20' : 'bg-blue-100'} rounded-lg flex items-center justify-center`}>
                <div className={`w-4 h-4 ${isDark ? 'bg-[#8CC84B]' : 'bg-blue-600'} rounded`} />
              </div>
            </div>
          </div>

          <div className={`${cardClasses} rounded-lg shadow-lg border p-6 transition-colors duration-300`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-[#8CC84B]' : 'text-gray-600'}`}>Cache Hit Rate</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{status.cacheHitRate}</p>
              </div>
              <div className={`w-8 h-8 ${isDark ? 'bg-[#8CC84B]/20' : 'bg-purple-100'} rounded-lg flex items-center justify-center`}>
                <div className={`w-4 h-4 ${isDark ? 'bg-[#8CC84B]' : 'bg-purple-600'} rounded`} />
              </div>
            </div>
          </div>
        </div>

        {/* Endpoints Status */}
        <div className={`${cardClasses} rounded-lg shadow-lg border transition-colors duration-300`}>
          <div className={`px-6 py-4 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Endpoint Health</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {status.endpoints.map((ep, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-4 ${
                    isDark ? 'bg-[#0f0f0f] border border-[#2a2a2a]' : 'bg-gray-50'
                  } rounded-lg transition-colors duration-300`}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full mr-3 ${
                        ep.status === 'online' 
                          ? 'bg-[#8CC84B]' 
                          : ep.status === 'checking' 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{ep.name}</h4>
                      <p className={`text-sm font-mono ${isDark ? 'text-[#8CC84B]' : 'text-gray-500'}`}>
                        {ep.endpoint}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {ep.responseTime !== null && (
                      <p className={`text-sm font-medium ${isDark ? 'text-[#8CC84B]' : 'text-gray-900'}`}>
                        {ep.responseTime}ms
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-6 right-6 text-center">
        <p className={`text-xs ${isDark ? 'text-[#8CC84B]' : 'text-gray-500'} mb-1`}>
          Built with ❤️ by{' '}
          <a 
            href="https://x.com/biff_buster" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`${isDark ? 'text-[#8CC84B] hover:text-[#6BA83A]' : 'text-blue-600 hover:text-blue-700'} font-semibold`}
          >
            Biff Buster
          </a>
          {' '}for Kaito campaign token performance tracking
        </p>
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} flex items-center justify-center gap-1.5`}>
          Powered by{' '}
          <Image 
            src="/coingecko_logo.svg" 
            alt="CoinGecko Logo" 
            width={16} 
            height={16}
            className="w-4 h-4"
          />
          <a 
            href="https://coingecko.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`${isDark ? 'text-[#8CC84B] hover:text-[#6BA83A]' : 'text-blue-600'} font-semibold`}
          >
            CoinGecko
          </a>
        </p>
      </div>
    </div>
  );
}

