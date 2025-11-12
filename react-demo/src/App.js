import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3000/api';

function App() {
  const [apiStatus, setApiStatus] = useState('checking');
  const [lastUpdated, setLastUpdated] = useState('');
  const [uptime, setUptime] = useState('0m');
  const [totalRequests, setTotalRequests] = useState(0);
  const [cacheHitRate, setCacheHitRate] = useState('0%');
  const [darkMode, setDarkMode] = useState(false);
  
  const [endpoints] = useState([
    { name: 'Health Check', method: 'GET', path: '/health', description: 'Check API status' },
    { name: 'All Tokens', method: 'GET', path: '/tokens', description: 'Get all 46 tokens from CSV' },
    { name: 'Token Data', method: 'GET', path: '/token/:id', description: 'Get comprehensive token data', param: 'APT' },
    { name: 'Token Price', method: 'GET', path: '/token/price/:id', description: 'Get current price', param: 'NEAR' },
    { name: 'Daily Change', method: 'GET', path: '/token/daily-change/:id', description: 'Get 24h price changes', param: 'DOT' },
    { name: 'Weekly Change', method: 'GET', path: '/token/weekly-change/:id', description: 'Get 7d price changes', param: 'INJ' },
    { name: 'Monthly Change', method: 'GET', path: '/token/monthly-change/:id', description: 'Get 30d price changes', param: 'SEI' },
    { name: 'Token Volume', method: 'GET', path: '/token/volume/:id', description: 'Get volume and market cap', param: 'ARB' },
    { name: 'Start Date', method: 'GET', path: '/token/start-date/:id', description: 'Get launch date from CSV', param: 'BERA' },
    { name: 'Total Market Cap', method: 'GET', path: '/total-market-cap', description: 'Get combined market cap (~60s)', slow: true },
    { name: 'Top Movers', method: 'GET', path: '/top-gainers-losers', description: 'Get top gainers & losers (~60s)', slow: true },
    { name: 'Markets', method: 'GET', path: '/markets', description: 'Get market overview (~60s)', slow: true }
  ]);

  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [param, setParam] = useState('');

  useEffect(() => {
    checkApiStatus();
    const interval = setInterval(() => {
      updateUptime();
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const checkApiStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const data = await res.json();
      if (data.success) {
        setApiStatus('online');
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        setApiStatus('offline');
      }
    } catch {
      setApiStatus('offline');
    }
    setLastUpdated(new Date().toLocaleTimeString());
  };

  const updateUptime = () => {
    const now = Date.now();
    const startTime = parseInt(localStorage.getItem('apiStartTime') || now);
    if (!localStorage.getItem('apiStartTime')) {
      localStorage.setItem('apiStartTime', startTime.toString());
    }
    const diffMinutes = Math.floor((now - startTime) / 60000);
    setUptime(`${diffMinutes}m`);
  };

  const testEndpoint = async (endpoint) => {
    setSelectedEndpoint(endpoint);
    setLoading(true);
    setError(null);
    setResponse(null);
    
    if (endpoint.param && !param) setParam(endpoint.param);

    setTotalRequests(prev => prev + 1);

    try {
      let path = endpoint.path;
      if (endpoint.param) {
        path = path.replace(':id', param || endpoint.param);
      }

      const start = Date.now();
      const res = await fetch(`${API_BASE_URL}${path}`);
      const data = await res.json();
      const duration = Date.now() - start;

      setResponse({ data, status: res.status, duration });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <div className="gecko-icon">🦎</div>
              <h1>CoinGecko API Status</h1>
            </div>
            <p className="subtitle">Real-time monitoring of API endpoints and performance</p>
          </div>
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="container">
        {/* Status Banner */}
        <div className="status-banner">
          <div className="status-main">
            <span className={`status-dot ${apiStatus}`}></span>
            <div className="status-text">
              <h2>API Status: {apiStatus === 'online' ? 'Service Online' : 'Service Offline'}</h2>
              <p>Last updated: {lastUpdated}</p>
            </div>
          </div>
          <button className="refresh-btn" onClick={checkApiStatus}>
            Refresh Status
          </button>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon green">📊</div>
            <div className="stat-content">
              <div className="stat-label">Uptime</div>
              <div className="stat-value">{uptime}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">📈</div>
            <div className="stat-content">
              <div className="stat-label">Total Requests</div>
              <div className="stat-value">{totalRequests}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">💾</div>
            <div className="stat-content">
              <div className="stat-label">Cache Hit Rate</div>
              <div className="stat-value">{cacheHitRate}</div>
            </div>
          </div>
        </div>

        {/* Endpoints Section */}
        <div className="endpoints-section">
          <h2 className="section-title">API Endpoints</h2>
          <div className="endpoints-grid">
            {endpoints.map((endpoint, index) => (
              <div 
                key={index} 
                className={`endpoint-card ${selectedEndpoint?.name === endpoint.name ? 'active' : ''}`}
                onClick={() => testEndpoint(endpoint)}
              >
                <div className="endpoint-header">
                  <span className="method-badge">{endpoint.method}</span>
                  <h3 className="endpoint-name">{endpoint.name}</h3>
                  {endpoint.slow && <span className="slow-badge">🐢 Slow</span>}
                </div>
                <code className="endpoint-path">{endpoint.path}</code>
                <p className="endpoint-desc">{endpoint.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Request/Response Section */}
        {selectedEndpoint && (
          <div className="response-section">
            <div className="request-panel">
              <h2 className="panel-title">Request</h2>
              <div className="request-details">
                <div className="request-method">
                  <span className="method-badge">{selectedEndpoint.method}</span>
                  <code className="request-url">
                    {API_BASE_URL}{selectedEndpoint.path.replace(':id', param || selectedEndpoint.param || '{id}')}
                  </code>
                </div>

                {selectedEndpoint.param && (
                  <div className="param-input-group">
                    <label>Token Ticker (e.g., APT, NEAR, DOT):</label>
                    <div className="input-with-button">
                      <input
                        type="text"
                        value={param}
                        onChange={(e) => setParam(e.target.value.toUpperCase())}
                        placeholder={selectedEndpoint.param}
                        className="param-input"
                      />
                      <button 
                        className="test-button"
                        onClick={() => testEndpoint(selectedEndpoint)}
                        disabled={loading}
                      >
                        {loading ? 'Testing...' : 'Test'}
                      </button>
                    </div>
                  </div>
                )}

                {!selectedEndpoint.param && (
                  <button 
                    className="test-button"
                    onClick={() => testEndpoint(selectedEndpoint)}
                    disabled={loading}
                  >
                    {loading ? 'Testing...' : 'Test Endpoint'}
                  </button>
                )}
              </div>
            </div>

            {loading && (
              <div className="loading-panel">
                <div className="spinner"></div>
                <p>Loading response...</p>
                {selectedEndpoint.slow && (
                  <p className="slow-warning">⏱️ This endpoint may take up to 60 seconds</p>
                )}
              </div>
            )}

            {error && (
              <div className="error-panel">
                <h2 className="panel-title error-title">❌ Error</h2>
                <pre className="error-content">{error}</pre>
              </div>
            )}

            {response && !loading && (
              <div className="response-panel">
                <div className="response-header">
                  <h2 className="panel-title">Response</h2>
                  <div className="response-meta">
                    <span className={`status-code ${response.status === 200 ? 'success' : 'error'}`}>
                      {response.status}
                    </span>
                    <span className="response-time">{response.duration}ms</span>
                  </div>
                </div>
                <pre className="response-content">
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>
          CoinGecko Proxy API | Powered by <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer">CoinGecko</a> | 
          Inspired by <a href="https://coingecko.com" target="_blank" rel="noopener noreferrer">Coingecko</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
