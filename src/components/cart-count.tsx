'use client';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCart } from './cart-provider';
export function CartCount() {
  const { items } = useCart();
  return (
    <Link
      href="/cart"
      className="bag-link"
      aria-label={`Shopping bag, ${items.reduce((n, i) => n + i.quantity, 0)} items`}
    >
      <ShoppingBag size={20} />
      <span>{items.reduce((n, i) => n + i.quantity, 0)}</span>
    </Link>
  );
}
