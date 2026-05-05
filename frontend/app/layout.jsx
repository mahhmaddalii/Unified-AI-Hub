import '../styles/global.css';
import { AuthProvider } from "../components/auth/auth-context";

// In your layout.js or page.js
export const metadata = {
  // other metadata (title, description, etc.)
  title: 'Unified AI Hub',
  description: 'Unified AI Platform',
   icons: {
    icon: '/logo.png', // This is all you need
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
