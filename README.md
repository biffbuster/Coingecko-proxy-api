# 🚀 CoinGecko Proxy API

A professional proxy API for CoinGecko Pro API with built-in CORS protection, rate limiting, and token launch schedule integration.

## ✨ Features

- **CORS Enabled**: No CORS errors - ready for frontend integration
- **Rate Limit Protection**: Automatic rate limiting (50 calls/minute)
- **Comprehensive Data**: Price, volume, market cap, and historical changes
- **Filtered Results**: Only tokens from your curated list
- **Launch Date Integration**: Token launch schedule from CSV
- **Real-time Updates**: Live data from CoinGecko Pro API
- **Dark Mode UI**: Beautiful documentation interface with cyan blue accents

## 📋 Token List

The API serves data for 46 tokens from the token launch schedule:

- Aptos (APT)
- Berachain (BERA)
- Injective (INJ)
- Polkadot (DOT)
- Arbitrum (ARB)
- And 41 more...

## 🔧 Installation

1. **Clone or download this repository**

2. **Install dependencies:**
```bash
npm install
```

3. **Start the server:**
```bash
npm start
```

The server will run on `http://localhost:3000`

## 📖 API Endpoints

### Health Check
```
GET /api/health
```
Check API status and get basic information.

### Get All Tokens
```
GET /api/tokens
```
Returns all tokens from the CSV list with their details.

**Response:**
```json
{
  "success": true,
  "count": 46,
  "data": [
    {
      "name": "Aptos",
      "ticker": "APT",
      "startDate": "March 21, 2025",
      "hasToken": true
    }
  ]
}
```

### Get Token Data (Comprehensive)
```
GET /api/token/:id
```
Get all available data for a specific token (use ticker symbol).

**Example:** `GET /api/token/APT`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "aptos",
    "symbol": "apt",
    "name": "Aptos",
    "currentPrice": 8.42,
    "startDate": "March 21, 2025",
    "priceChangePercentage24h": 2.5,
    "priceChangePercentage7d": -1.2,
    "priceChangePercentage30d": 15.8,
    "priceChangePercentage60d": 45.2,
    "priceChangePercentage1y": 120.5,
    "totalVolume": 125000000,
    "marketCap": 2500000000,
    "marketCapRank": 25,
    "high24h": 8.65,
    "low24h": 8.15,
    "ath": 19.92,
    "atl": 3.08
  }
}
```

### Get Token Price
```
GET /api/token/price/:id
```
Get current price data for a specific token.

### Get Daily Change
```
GET /api/token/daily-change/:id
```
Get 24-hour price changes, highs, and lows.

### Get Weekly Change
```
GET /api/token/weekly-change/:id
```
Get 7-day price change percentage.

### Get Monthly Change
```
GET /api/token/monthly-change/:id
```
Get 30-day price change percentage.

### Get Token Volume
```
GET /api/token/volume/:id
```
Get trading volume and market cap data.

### Get Start Date
```
GET /api/token/start-date/:id
```
Get launch date information from CSV.

**Example:** `GET /api/token/start-date/BERA`

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Berachain",
    "ticker": "BERA",
    "startDate": "December 2024",
    "hasToken": true
  }
}
```

### Get Total Market Cap
```
GET /api/total-market-cap
```
Get combined market cap of all tokens in your list.

⚠️ **Note:** This endpoint is slow as it fetches data for all tokens.

### Get Top Gainers/Losers
```
GET /api/top-gainers-losers
```
Get top gainers and losers from your token list (24h changes).

⚠️ **Note:** This endpoint is slow as it fetches data for all tokens.

### Get Markets Data
```
GET /api/markets
```
Get market overview data for all tokens sorted by market cap.

⚠️ **Note:** This endpoint is slow as it fetches data for all tokens.

## 🔌 Usage Examples

### JavaScript (Fetch API)
```javascript
// Get comprehensive token data
fetch('http://localhost:3000/api/token/APT')
  .then(res => res.json())
  .then(data => console.log(data));

// Get all tokens
fetch('http://localhost:3000/api/tokens')
  .then(res => res.json())
  .then(data => console.log(data));

// Get token start date
fetch('http://localhost:3000/api/token/start-date/NEAR')
  .then(res => res.json())
  .then(data => console.log(data));
```

### cURL
```bash
# Get token data
curl http://localhost:3000/api/token/DOT

# Get daily change
curl http://localhost:3000/api/token/daily-change/INJ

# Get all tokens
curl http://localhost:3000/api/tokens
```

### Python
```python
import requests

# Get token data
response = requests.get('http://localhost:3000/api/token/APT')
data = response.json()
print(data)

# Get start date
response = requests.get('http://localhost:3000/api/token/start-date/BERA')
data = response.json()
print(data)
```

## ⚙️ Configuration

### API Key
Create a `.env` file (or configure environment variables in your hosting provider) and add your CoinGecko Pro API key:
```bash
COINGECKO_API_KEY=your-coingecko-pro-api-key
```

Restart the server after updating environment variables so the new key is picked up.

### Port
Change the port in `server.js`:
```javascript
const PORT = process.env.PORT || 3000;
```

### Update Token List
Edit `token_launch_schedule.csv` to add or remove tokens, then restart the server.

## 🚨 Important Notes

### Rate Limiting
- CoinGecko Pro API allows **50 calls per minute**
- The proxy includes automatic rate limiting with 1.2s delays between requests
- Endpoints that fetch all tokens (`/api/total-market-cap`, `/api/top-gainers-losers`, `/api/markets`) are slower

### CORS
- CORS is enabled on all endpoints
- No browser restrictions when making requests from your frontend

### Error Handling
All endpoints return consistent error responses:
```json
{
  "success": false,
  "error": "Error message here"
}
```

## 📁 Project Structure

```
coingecko-proxy-api/
├── server.js                      # Main Express server
├── package.json                   # Dependencies
├── token_launch_schedule.csv      # Token list with launch dates
├── public/
│   └── index.html                 # API documentation interface
└── README.md                      # This file
```

## 🎨 UI Features

The documentation interface (`http://localhost:3000`) includes:
- **Dark Mode Theme**: Dark grey background with cyan blue accents
- **Live Status**: Real-time API health check
- **Token List**: Interactive token grid (click to copy ticker)
- **Endpoint Documentation**: Comprehensive API reference
- **Example Responses**: JSON examples for each endpoint

## 🔄 Development

For development with auto-reload:
```bash
npm install -g nodemon
npm run dev
```

## 📝 Response Format

All successful responses follow this format:
```json
{
  "success": true,
  "data": { ... }
}
```

All error responses follow this format:
```json
{
  "success": false,
  "error": "Error message"
}
```

## 🌐 Deployment

### Heroku
```bash
heroku create your-app-name
git push heroku main
```

### Vercel
Use the provided `vercel.json` configuration.

### Docker
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Ticker to CoinGecko ID Mapping

The server automatically maps ticker symbols to CoinGecko IDs:
- APT → aptos
- BERA → berachain
- INJ → injective-protocol
- DOT → polkadot
- ARB → arbitrum
- NEAR → near
- And more...

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT License

## 🙏 Acknowledgments

- Inspired by [defi-proxy](https://github.com/biffbuster/defi-proxy)
- Powered by [CoinGecko API](https://www.coingecko.com/api)

---

Built with ❤️ for Token Launch Schedule Tracking
