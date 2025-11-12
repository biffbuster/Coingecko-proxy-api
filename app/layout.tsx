import './globals.css'

export const metadata = {
  title: 'CoinGecko Proxy API - Status Dashboard',
  description: 'Real-time monitoring of CoinGecko Proxy API endpoints and performance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
