import '../styles/global.css';

// In your layout.js or page.js
export const metadata = {
  // other metadata (title, description, etc.)
  title: 'Generative AI Hub',
  description: 'Unified AI Platform',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}