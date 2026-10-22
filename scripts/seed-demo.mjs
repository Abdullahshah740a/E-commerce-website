// Explicit, owner-requested demo catalog. Never runs during install/build/deployment.
// Existing demo slugs are skipped so rerunning does not overwrite admin edits.
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
loadEnvFile('.env.local');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const samples = [
  ['Sage Stripe Bedsheet', 'bedsheets', 'bed', '#8b9a80', 'Sage', 3200, 'stripe'],
  ['Rose Garden Bedsheet', 'bedsheets', 'bed', '#bd8d90', 'Dusty Rose', 3600, 'flower'],
  ['Sandstone Sofa Cover', 'sofa-covers', 'sofa', '#c2aa87', 'Sand', 4800, 'plain'],
  ['Forest Sofa Cover', 'sofa-covers', 'sofa', '#5f7663', 'Forest', 5200, 'stripe'],
  [
    'Terracotta Cushion Covers',
    'cushion-covers',
    'cushion',
    '#b97659',
    'Terracotta',
    1400,
    'diamond',
  ],
  [
    'Midnight Cushion Covers',
    'cushion-covers',
    'cushion',
    '#526a7a',
    'Midnight Blue',
    1600,
    'stripe',
  ],
  ['Ivory Pillow Covers', 'pillow-covers', 'pillow', '#d7cbb6', 'Ivory', 1100, 'plain'],
  ['Olive Pillow Covers', 'pillow-covers', 'pillow', '#8c9270', 'Olive', 1250, 'flower'],
  ['Cloud Comfort Bedding Set', 'bedding-sets', 'bed', '#a4b6be', 'Cloud Blue', 6900, 'plain'],
  ['Warm Linen Bedding Set', 'bedding-sets', 'bed', '#bd9b7c', 'Oatmeal', 7500, 'diamond'],
  ['Honeycomb Woven Throw', 'other-home-textiles', 'throw', '#c5a464', 'Honey', 2400, 'diamond'],
  ['Charcoal Woven Throw', 'other-home-textiles', 'throw', '#737775', 'Charcoal', 2600, 'stripe'],
];

function illustration(kind, color, design, closeup) {
  const pattern =
    design === 'stripe'
      ? '<path d="M0 0V60M20 0V60M40 0V60" stroke="#fff" stroke-opacity=".3" stroke-width="5"/>'
      : design === 'diamond'
        ? '<path d="M30 0L60 30 30 60 0 30Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>'
        : design === 'flower'
          ? '<g fill="#f6ecdb" opacity=".6"><ellipse cx="30" cy="22" rx="5" ry="10"/><ellipse cx="30" cy="38" rx="5" ry="10"/><ellipse cx="22" cy="30" rx="10" ry="5"/><ellipse cx="38" cy="30" rx="10" ry="5"/></g><circle cx="30" cy="30" r="4" fill="#a58c54"/>'
          : '<path d="M0 15H60M0 45H60M15 0V60M45 0V60" stroke="#fff" stroke-opacity=".1"/>';
  let shape;
  if (closeup)
    shape =
      '<path d="M100 180Q350 100 700 190L760 610Q510 540 130 650Z" fill="url(#fabric)"/><path d="M130 220Q350 150 670 220M150 620Q400 530 730 580" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="5"/><path d="M380 170Q300 350 460 590M600 190Q500 400 610 590" fill="none" stroke="#000" stroke-opacity=".07" stroke-width="18"/>';
  else if (kind === 'bed')
    shape =
      '<rect x="140" y="225" width="520" height="230" rx="35" fill="#c5b59f"/><path d="M130 365L670 365 735 620H65Z" fill="#e8dfd0"/><path d="M140 385H660L715 585H85Z" fill="url(#fabric)"/><path d="M85 585H715V650H85Z" fill="url(#fabric)"/><rect x="165" y="300" width="210" height="105" rx="22" fill="#f3ebde"/><rect x="425" y="300" width="210" height="105" rx="22" fill="#f3ebde"/><path d="M105 650V675M695 650V675" stroke="#8c7358" stroke-width="18"/>';
  else if (kind === 'sofa')
    shape =
      '<rect x="140" y="300" width="520" height="230" rx="45" fill="url(#fabric)"/><rect x="115" y="465" width="570" height="100" rx="25" fill="url(#fabric)"/><rect x="70" y="385" width="95" height="195" rx="35" fill="url(#fabric)"/><rect x="635" y="385" width="95" height="195" rx="35" fill="url(#fabric)"/><path d="M165 510H635M400 320V510" stroke="#000" stroke-opacity=".13" stroke-width="4"/><rect x="200" y="355" width="115" height="115" rx="18" fill="#ece1ce" transform="rotate(-12 255 410)"/><rect x="485" y="360" width="115" height="115" rx="18" fill="#d1b995" transform="rotate(10 540 415)"/><path d="M125 575V620M675 575V620" stroke="#8c7358" stroke-width="18"/>';
  else if (kind === 'pillow')
    shape =
      '<rect x="95" y="320" width="440" height="220" rx="45" fill="#d2c2ac" transform="rotate(-10 300 430)"/><rect x="255" y="370" width="450" height="220" rx="45" fill="url(#fabric)" transform="rotate(8 480 480)"/>';
  else if (kind === 'throw')
    shape =
      '<path d="M210 250L620 320 560 640 150 565Z" fill="url(#fabric)"/><path d="M210 275L590 340M195 310L585 375" stroke="#fff" stroke-opacity=".4" stroke-width="5"/><path d="M150 565L140 600M180 570L170 605M210 575L200 610M240 580L230 615M270 585L260 620M300 590L290 625M330 595L320 630M360 600L350 635M390 605L380 640M420 610L410 645M450 615L440 650M480 620L470 655M510 625L500 660M540 630L530 665" stroke="' +
      color +
      '" stroke-width="7"/>';
  else
    shape =
      '<rect x="130" y="300" width="310" height="310" rx="35" fill="#d9c6ad" transform="rotate(-12 285 455)"/><rect x="345" y="280" width="310" height="310" rx="35" fill="url(#fabric)" transform="rotate(12 500 435)"/>';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 800 800"><defs><pattern id="fabric" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="${color}"/>${pattern}</pattern><filter id="shadow"><feDropShadow dx="0" dy="15" stdDeviation="14" flood-opacity=".14"/></filter></defs><rect width="800" height="800" fill="#f2eee6"/><rect y="530" width="800" height="270" fill="#e8dfd1"/><path d="M0 530H800" stroke="#d6cbbb"/><circle cx="650" cy="140" r="65" fill="#e7dbc6"/><path d="M80 160H250M80 180H195" stroke="#d1c3af" stroke-width="4"/><ellipse cx="400" cy="660" rx="300" ry="35" fill="#d1c3ae" opacity=".5"/><g filter="url(#shadow)">${shape}</g><text x="40" y="745" fill="#726c60" font-family="sans-serif" font-size="16" letter-spacing="3">DEMO ${closeup ? 'FABRIC DETAIL' : 'PRODUCT ILLUSTRATION'}</text><text x="40" y="775" fill="#8e8575" font-family="sans-serif" font-size="13">Sample image · not an actual product photograph</text></svg>`,
  );
}

const { data: categories, error: categoryError } = await db.from('categories').select('id,slug');
if (categoryError) throw new Error('Cannot load categories. Check the Supabase connection.');
let created = 0;
for (const [index, [name, category, kind, color, colorName, price, design]] of samples.entries()) {
  const slug = `demo-${name.toLowerCase().replaceAll(' ', '-')}`;
  const sku = `DEMO-${String(index + 1).padStart(2, '0')}`;
  const { data: existing, error: lookupError } = await db
    .from('products')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (lookupError) throw new Error('Cannot check existing demo products.');
  if (existing) {
    console.log(`SKIP: ${name} (already exists)`);
    continue;
  }
  const categoryId = categories.find((c) => c.slug === category)?.id;
  if (!categoryId) throw new Error(`Missing category ${category}; no category changes were made.`);
  const { data: product, error } = await db
    .from('products')
    .insert({
      name: `Demo — ${name}`,
      slug,
      sku,
      category_id: categoryId,
      short_description: 'Demo product for browsing only. Sample image, price and stock.',
      description: `DEMO ONLY — not an item for sale.\nThis sample lets you try the gallery, variants and shopping bag. Images are illustrations, not product photographs. Prices and stock are fictional.\nYou can edit, archive or permanently delete this product through the admin product page.`,
      price: price * 100,
      sale_price: index % 4 === 0 ? (price - 300) * 100 : null,
      active: false,
      featured: index < 6,
      tags: ['demo', 'sample', design],
    })
    .select('id')
    .single();
  if (error) throw new Error(`Cannot create ${name}.`);
  const keys = [];
  try {
    const sizes = ['bed'].includes(kind)
      ? ['Single', 'Double', 'King']
      : kind === 'sofa'
        ? ['2 Seater', '3 Seater']
        : kind === 'throw'
          ? ['130 × 170 cm', '150 × 200 cm']
          : ['Standard', 'Large'];
    const variants = await db.from('variants').insert(
      sizes.map((size, i) => ({
        product_id: product.id,
        sku: `${sku}-${i + 1}`,
        size,
        color: colorName,
        design: design[0].toUpperCase() + design.slice(1),
        price: i === 2 ? (price + 600) * 100 : null,
        stock: index === 11 ? 0 : i === 1 ? 4 : 12,
        active: true,
      })),
    );
    if (variants.error) throw new Error('Variant save failed.');
    for (let position = 0; position < 2; position++) {
      const key = `${product.id}/demo-${position + 1}.png`;
      const image = await sharp(illustration(kind, color, design, position === 1))
        .png()
        .toBuffer();
      const upload = await db.storage
        .from('product-media')
        .upload(key, image, { contentType: 'image/png', upsert: false });
      if (upload.error) throw new Error('Image upload failed.');
      keys.push(key);
      const {
        data: { publicUrl },
      } = db.storage.from('product-media').getPublicUrl(key);
      const media = await db
        .from('product_media')
        .insert({
          product_id: product.id,
          type: 'image',
          url: publicUrl,
          storage_key: key,
          position,
          is_primary: position === 0,
        });
      if (media.error) throw new Error('Image save failed.');
    }
    const published = await db.from('products').update({ active: true }).eq('id', product.id);
    if (published.error) throw new Error('Demo activation failed.');
    created++;
    console.log(`ADDED: Demo — ${name} (${sizes.length} variants, 2 images)`);
  } catch (error) {
    const cleanup = keys.length
      ? await db.storage.from('product-media').remove(keys)
      : { error: null };
    const removal = await db.from('products').delete().eq('id', product.id);
    if (cleanup.error || removal.error)
      console.error(`Cleanup incomplete for ${sku}; review this demo in admin.`);
    throw error;
  }
}
console.log(`Done: ${created} demo products added. Existing products/settings/orders unchanged.`);
