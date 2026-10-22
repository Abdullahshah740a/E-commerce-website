import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
try {
  loadEnvFile('.env.local');
} catch {}
const [name, rawNumber, rawFee] = process.argv.slice(2);
const whatsapp = rawNumber?.replace(/[\s+()-]/g, '');
const fee = Number(rawFee);
if (
  !name ||
  !whatsapp ||
  !/^[1-9]\d{7,14}$/.test(whatsapp) ||
  rawFee === undefined ||
  !Number.isFinite(fee) ||
  fee < 0
)
  throw new Error(
    'Usage: node scripts/configure-store.mjs BUSINESS_NAME WHATSAPP DELIVERY_FEE_RUPEES',
  );
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await db.from('settings').select('data').single();
if (error) throw new Error('Cannot read store settings.');
const updated = {
  ...data.data,
  business_name: name,
  description: `Sofa covers, bedsheets and home textiles from ${name}.`,
  whatsapp,
  phone: data.data.phone || `+${whatsapp}`,
  delivery_fee: Math.round(fee * 100),
  checkout_enabled: false,
};
const { error: saveError } = await db.from('settings').update({ data: updated }).eq('id', true);
if (saveError) throw new Error('Cannot save business settings.');
const { data: verified, error: verifyError } = await db.from('settings').select('data').single();
if (
  verifyError ||
  verified.data.business_name !== name ||
  verified.data.whatsapp !== whatsapp ||
  verified.data.delivery_fee !== Math.round(fee * 100)
)
  throw new Error('Business settings verification failed.');
console.log('Real business name, WhatsApp destination and delivery fee saved and verified.');
console.log('Checkout remains disabled except during the controlled integration exercise.');
