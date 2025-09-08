import '../styles/global.css';

export const metadata = {
  title: 'Generative AI Hub',
  description: 'Unified AI Platform',
  viewport: 'width=device-width, initial-scale=1.0',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}