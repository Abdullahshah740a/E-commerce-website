import type { Metadata } from 'next';
import { CartProvider } from '@/components/cart-provider';
import { Header, Footer } from '@/components/store-shell';
import { storeData } from '@/lib/data';
import './globals.css';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const { settings: s } = await storeData();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: { default: `Home textiles | ${s.business_name}`, template: `%s | ${s.business_name}` },
    description: s.description,
    robots: {
      index: process.env.STORE_LAUNCHED === 'true',
      follow: process.env.STORE_LAUNCHED === 'true',
    },
  };
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <CartProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
