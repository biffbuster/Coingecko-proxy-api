# 🚀 CoinGecko Proxy API - React Demo

A complete React application demonstrating all features of the CoinGecko Proxy API with a beautiful dark theme UI.

## 🎯 Features

### 📊 Token Dashboard
- Real-time token data display
- Price, market cap, and volume information
- 24h, 7d, 30d, 60d, and 1y price changes
- All-time high/low prices
- Token launch dates from CSV
- Beautiful dark theme with cyan accents

### 🔥 Top Movers
- Top 10 gainers (24h)
- Top 10 losers (24h)
- Visual indicators for price changes
- Sortable by performance

### 📋 Token List
- All 46 tokens in a grid layout
- Click to view detailed information
- Token launch dates
- Active status indicators

## 🚀 Quick Start

### Prerequisites
1. Make sure the API server is running:
   ```bash
   cd path/to/coingecko-proxy-api
   npm start
   # Server should be running on http://localhost:3000
   ```

### Installation

1. **Install dependencies:**
   ```bash
   cd react-demo
   npm install
   ```

2. **Start the React app:**
   ```bash
   npm start
   ```

3. **Open your browser:**
   ```
   http://localhost:3001
   ```
   (React will use port 3001 if 3000 is taken by the API)

## 📸 Screenshots

### Token Dashboard
Shows comprehensive data for a selected token including:
- Current price with 24h change
- Market cap and rank
- 24h trading volume
- Price changes over multiple timeframes
- All-time high/low prices
- Token launch date

### Top Movers
Displays the best and worst performing tokens in your list over 24 hours.

### Token List
Grid view of all 46 tokens with quick access to detailed information.

## 🎨 Design

### Color Scheme
- **Background**: Dark grey (#1a1a1a, #2a2a2a)
- **Accent**: Cyan blue (#00d9ff)
- **Success**: Green (#4caf50)
- **Error**: Red (#f44336)
- **Text**: White primary, grey secondary

### Components
- **Header**: Shows app title and API status
- **Navigation**: Tab-based navigation between sections
- **Token Selector**: Dropdown to choose which token to display
- **Stat Cards**: Grid of key metrics with hover effects
- **Charts**: Price changes and ranges
- **Movers List**: Ranked list of top performers

## 📝 Code Structure

```
react-demo/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── App.js              # Main React component
│   ├── App.css             # Styling (dark theme)
│   ├── index.js            # React entry point
│   └── index.css           # Base styles
├── package.json            # Dependencies
└── README.md              # This file
```

## 🔧 Customization

### Change API URL
Edit `App.js`:
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
// Change to your deployed API URL:
// const API_BASE_URL = 'https://your-api.vercel.app/api';
```

### Change Colors
Edit `App.css` root variables:
```css
:root {
  --dark-bg: #1a1a1a;
  --cyan: #00d9ff;
  /* Customize any color here */
}
```

### Add More Features
The component is well-structured for adding:
- Price charts (integrate Chart.js or Recharts)
- Price alerts
- Favorites/watchlist
- Search functionality
- Export to CSV
- Share functionality

## 💡 Usage Examples

### Fetching Token Data
```javascript
const loadTokenData = async (ticker) => {
  const response = await fetch(`${API_BASE_URL}/token/${ticker}`);
  const data = await response.json();
  if (data.success) {
    setTokenData(data.data);
  }
};
```

### Formatting Currency
```javascript
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};
```

### Displaying Price Changes
```javascript
<div style={{ color: getChangeColor(priceChange) }}>
  {formatPercentage(priceChange)}
</div>
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel deploy
```

### Deploy to Netlify
```bash
# Build
npm run build

# Deploy the build folder to Netlify
```

## 📊 API Integration

This demo uses all available API endpoints:

1. **Health Check** - `/api/health`
2. **All Tokens** - `/api/tokens`
3. **Token Data** - `/api/token/:id`
4. **Top Movers** - `/api/top-gainers-losers`

### Example API Response
```json
{
  "success": true,
  "data": {
    "name": "Aptos",
    "symbol": "apt",
    "currentPrice": 8.42,
    "startDate": "March 21, 2025",
    "priceChangePercentage24h": 2.5,
    "priceChangePercentage7d": -1.2,
    "totalVolume": 125000000,
    "marketCap": 2500000000
  }
}
```

## ⚡ Performance

### Fast Endpoints (~1-2 seconds)
- Token Dashboard
- Token List
- Individual token queries

### Slow Endpoints (~60 seconds)
- Top Movers (fetches all 46 tokens)

**Optimization Tips:**
- Cache results in React state
- Use React Query or SWR for data fetching
- Implement pagination for large lists
- Add loading skeletons for better UX

## 🐛 Troubleshooting

### API Connection Error
- Ensure the API server is running on port 3000
- Check `API_BASE_URL` in `App.js`
- Look for CORS errors in browser console

### Port Already in Use
React will automatically use port 3001 if 3000 is taken.

### Styling Issues
Clear browser cache and restart development server:
```bash
npm start
```

## 📚 Learn More

### React Documentation
- [React Documentation](https://react.dev)
- [Create React App](https://create-react-app.dev)

### API Documentation
- See the main README in the parent directory
- Check API_REFERENCE.md for endpoint details

## 🎯 Next Steps

1. **Add Charts**: Integrate Chart.js for price history
2. **Add Favorites**: Let users save favorite tokens
3. **Add Alerts**: Price alerts and notifications
4. **Add Search**: Filter tokens by name/ticker
5. **Add Comparison**: Compare multiple tokens side-by-side
6. **Add Mobile App**: Convert to React Native

## 💻 Development

### Start Development Server
```bash
npm start
```

### Run Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
```

## 🌟 Features Demonstrated

- ✅ React Hooks (useState, useEffect)
- ✅ API Integration with fetch
- ✅ Responsive Design
- ✅ Dark Theme
- ✅ Tab Navigation
- ✅ Loading States
- ✅ Error Handling
- ✅ Data Formatting
- ✅ Conditional Rendering
- ✅ Interactive Components

## 📄 License

This demo is part of the CoinGecko Proxy API project.

## 🙏 Credits

- Built with React
- Styled with custom CSS
- Powered by CoinGecko Proxy API
- Inspired by modern crypto dashboards

---

**Enjoy building with the CoinGecko Proxy API! 🚀**
