'use client';
import { useState } from 'react';
import { adminAction } from './admin-common';
import type { Settings } from '@/lib/types';
export function SettingsEditor({ settings: s }: { settings: Settings }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <>
      <h1 className="page-title">Store settings.</h1>
      <p>
        Configure real business details before enabling checkout. All prices below are in rupees.
        Leave delivery fees blank until decided; enter 0 only if delivery is genuinely free.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setMessage('');
          try {
            const cityFees: Record<string, number> = Object.create(null);
            for (const line of String(f.city_fees)
              .split('\n')
              .filter((l) => l.trim())) {
              const [city, value] = line.split('=');
              if (!city?.trim() || !value?.trim() || !Number.isFinite(Number(value)))
                throw new Error('Use City=fee for each city delivery rule.');
              cityFees[city.trim().toLowerCase()] = Math.round(Number(value) * 100);
            }
            const data = {
              ...s,
              ...f,
              delivery_fee: f.delivery_fee === '' ? null : Math.round(Number(f.delivery_fee) * 100),
              free_delivery_threshold:
                f.free_delivery_threshold === ''
                  ? null
                  : Math.round(Number(f.free_delivery_threshold) * 100),
              city_fees: cityFees,
              delivery_enabled: f.delivery_enabled === 'on',
              checkout_enabled: f.checkout_enabled === 'on',
            };
            await adminAction('settings', data);
            setMessage('Settings saved.');
          } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Unable to save settings.');
          }
          setBusy(false);
        }}
      >
        <div className="form-grid">
          <label>
            Business name
            <input name="business_name" required defaultValue={s.business_name} />
          </label>
          <label>
            Logo URL (HTTPS)
            <input name="logo_url" type="url" defaultValue={s.logo_url || ''} />
          </label>
          <label className="wide">
            Store description
            <textarea name="description" defaultValue={s.description} />
          </label>
          <label>
            Contact phone
            <input name="phone" defaultValue={s.phone || ''} />
          </label>
          <label>
            Business email
            <input name="email" type="email" defaultValue={s.email || ''} />
          </label>
          <label>
            Store address
            <input name="address" defaultValue={s.address || ''} />
          </label>
          <label>
            Currency
            <select name="currency" defaultValue={s.currency}>
              <option>PKR</option>
            </select>
          </label>
          <label>
            Country
            <select name="country" defaultValue={s.country}>
              <option>Pakistan</option>
            </select>
          </label>
          <label>
            Default delivery fee (Rs.)
            <input
              name="delivery_fee"
              type="number"
              min="0"
              step="0.01"
              defaultValue={s.delivery_fee === null ? '' : s.delivery_fee / 100}
            />
          </label>
          <label>
            Free delivery threshold (Rs., optional)
            <input
              name="free_delivery_threshold"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                s.free_delivery_threshold === null ? '' : s.free_delivery_threshold / 100
              }
            />
          </label>
          <label className="wide">
            City delivery fees (one per line: City=fee in rupees)
            <textarea
              name="city_fees"
              rows={4}
              defaultValue={Object.entries(s.city_fees)
                .map(([city, fee]) => `${city}=${fee / 100}`)
                .join('\n')}
            />
          </label>
          <label className="check-label">
            <input name="delivery_enabled" type="checkbox" defaultChecked={s.delivery_enabled} />
            Delivery enabled
          </label>
          <label className="check-label">
            <input name="checkout_enabled" type="checkbox" defaultChecked={s.checkout_enabled} />
            Accept customer orders
          </label>
        </div>
        <h2>Homepage & policies</h2>
        <div className="form-grid">
          <label className="wide">
            Hero heading
            <input name="hero_title" required defaultValue={s.hero_title} />
          </label>
          <label className="wide">
            Hero description
            <textarea name="hero_text" defaultValue={s.hero_text} />
          </label>
          <label className="wide">
            Announcement / promotion
            <input name="promotion" defaultValue={s.promotion} />
          </label>
          <label className="wide">
            Delivery, returns & privacy policies
            <textarea name="policies" rows={10} defaultValue={s.policies} />
          </label>
          <label>
            Instagram URL
            <input name="instagram" type="url" defaultValue={s.instagram || ''} />
          </label>
          <label>
            Facebook URL
            <input name="facebook" type="url" defaultValue={s.facebook || ''} />
          </label>
        </div>
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Save store settings'}
        </button>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </form>
    </>
  );
}
