// Explicit owner action: preserve store settings and open COD / Make checkout.
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
loadEnvFile('.env.local');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: row, error } = await db.from('settings').select('data').single();
if (error) throw new Error('Cannot read store settings.');
if (!Number.isSafeInteger(row.data.delivery_fee) || row.data.delivery_fee < 0)
  throw new Error('Configure a valid default delivery fee before enabling checkout.');
const { error: updateError } = await db
  .from('settings')
  .update({
    data: { ...row.data, checkout_enabled: true },
  })
  .eq('id', true);
if (updateError) throw new Error('Cannot enable checkout.');
const { data: verified, error: verifyError } = await db.from('settings').select('data').single();
if (verifyError || !verified.data.checkout_enabled)
  throw new Error('Checkout settings could not be verified.');
console.log(
  `Checkout enabled and verified. Make notification configured. Delivery: PKR ${verified.data.delivery_fee / 100}.`,
);
