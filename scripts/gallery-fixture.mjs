// Disposable gallery QA only. Does not change checkout, settings, customers or orders.
import { loadEnvFile } from 'node:process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
loadEnvFile('.env.local');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stateFile = '.qa-gallery-state.json';
if (process.argv[2] === 'setup') {
  if (existsSync(stateFile)) throw new Error('Clean up the previous gallery fixture first.');
  const suffix = crypto.randomUUID();
  const { data: p, error } = await db
    .from('products')
    .insert({
      name: 'QA ONLY - Gallery check - NOT FOR SALE',
      slug: `qa-gallery-${suffix}`,
      sku: `QA-GALLERY-${suffix}`,
      price: 100000,
      active: true,
    })
    .select('id,slug')
    .single();
  if (error) throw new Error('Cannot create gallery fixture.');
  const key = `${p.id}/qa-gallery.png`;
  writeFileSync(stateFile, JSON.stringify({ ...p, key }));
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await db.storage
    .from('product-media')
    .upload(key, bytes, { contentType: 'image/png' });
  if (upload.error) throw new Error('Gallery image upload failed; run cleanup.');
  const {
    data: { publicUrl },
  } = db.storage.from('product-media').getPublicUrl(key);
  const media = await db
    .from('product_media')
    .insert({ product_id: p.id, url: publicUrl, storage_key: key, type: 'image', position: 0 });
  if (media.error) throw new Error('Gallery media save failed; run cleanup.');
  console.log(`/products/${p.slug}`);
} else if (process.argv[2] === 'cleanup') {
  if (existsSync(stateFile)) {
    const p = JSON.parse(readFileSync(stateFile, 'utf8'));
    const removed = await db.storage.from('product-media').remove([p.key]);
    if (removed.error) throw new Error('Gallery storage cleanup failed.');
    const removedProduct = await db.from('products').delete().eq('id', p.id).eq('slug', p.slug);
    if (removedProduct.error) throw new Error('Gallery product cleanup failed.');
    unlinkSync(stateFile);
  }
  console.log('Disposable gallery fixture removed.');
} else throw new Error('Usage: node scripts/gallery-fixture.mjs setup|cleanup');
