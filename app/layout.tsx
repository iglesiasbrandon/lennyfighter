import './globals.css';
import { RootErrorBoundary } from './components/RootErrorBoundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>LennyFighter — Battle for LennyCoin</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RootErrorBoundary>{children}</RootErrorBoundary>
      </body>
    </html>
  );
}
