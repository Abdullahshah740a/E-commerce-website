import { Checkout } from '@/components/checkout';
import { storeData } from '@/lib/data';
import { webhookConfigured } from '@/lib/order-webhooks';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout', robots: { index: false } };
export default async function Page() {
  const { settings } = await storeData();
  return (
    <section className="container section">
      <Checkout settings={settings} notificationsReady={webhookConfigured()} />
    </section>
  );
}
