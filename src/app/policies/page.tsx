import { storeData } from '@/lib/data';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Store policies & delivery' };
export default async function Page() {
  const { settings: s } = await storeData();
  return (
    <section className="container section narrow">
      <span className="eyebrow">SHOP WITH CONFIDENCE</span>
      <h1 className="page-title">Our store & policies.</h1>
      <h2>Ordering & payment</h2>
      <p>
        Place a guest order and send the saved summary through WhatsApp. Our team will call to
        confirm your order before dispatch. Payment is Cash on Delivery.
      </p>
      <h2>Delivery, returns & privacy</h2>
      <p className="preserve-lines">{s.policies}</p>
      <h2>Contact</h2>
      <p>{s.address || 'Store contact details will be published before orders open.'}</p>
      {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
      {s.email && (
        <p>
          <a href={`mailto:${s.email}`}>{s.email}</a>
        </p>
      )}
    </section>
  );
}
