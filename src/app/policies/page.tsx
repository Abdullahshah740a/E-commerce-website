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
        Confirm your guest order on this website to receive a receipt immediately. Your order
        details are securely forwarded to our order-processing service. Our team will contact you to
        confirm delivery before dispatch. Payment is Cash on Delivery.
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
