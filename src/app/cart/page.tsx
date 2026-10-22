import { CartPage } from '@/components/cart-page';
export const metadata = { title: 'Your shopping bag', robots: { index: false } };
export default function Page() {
  return (
    <section className="section container">
      <CartPage />
    </section>
  );
}
