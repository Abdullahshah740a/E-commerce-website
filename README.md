# Home textile store

Next.js App Router, React, strict TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage. Guest Cash on Delivery checkout saves a transaction before preparing WhatsApp. No payment gateway or WhatsApp API subscription is required.

## Status

The source implements the storefront, variant-aware catalog, product gallery, persistent local cart, checkout, admin authentication, product/category/inventory/media/settings management and order management. See `VERIFICATION.md` for the completed checks and remaining launch requirements. **No production deployment has been performed.**

The connected project now has all four migrations, the first administrator allowlist, and the owner's real business name/WhatsApp/delivery fee configured. Live admin and checkout integration exercises have passed, including actual media persistence and concurrent last-unit purchases. The owner confirmed successful password setup and sign-in. A real browser journey verified multi-variant cart persistence, saved checkout, copy-summary feedback and the WhatsApp preview without sending a message. All disposable QA records were removed. The real catalog/photos, policies, and deployment verification remain before launch. Checkout is deliberately disabled after QA.

## Local development

Requires Node.js 22.18+ and npm. On Windows PowerShell use `npm.cmd` if script execution policy blocks `npm.ps1`.

```powershell
npm.cmd ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Fill .env.local locally. Never commit it or paste secret keys into chat.
npm.cmd run dev
```

Open http://127.0.0.1:3000. The public site explains when the backend is unavailable; it never supplies a fake product catalog. There are no seeded production products or fabricated reviews/sales. The sofa hero is a decorative CSS illustration, labeled as such. Temporary business branding is editable in admin settings.

## Environment

| Variable                               | Purpose                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase Project Settings → API → Project URL                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → publishable key (`sb_publishable_…`)                |
| `SUPABASE_SECRET_KEY`                  | Server-only secret key (`sb_secret_…`); never use a NEXT_PUBLIC prefix            |
| `CHECKOUT_RATE_LIMIT_SECRET`           | Random 32+ character secret for hashing rate-limit identifiers                    |
| `NEXT_PUBLIC_SITE_URL`                 | Canonical origin, e.g. `https://shop.example.com`; used in email recovery and SEO |
| `STORE_LAUNCHED`                       | Default false; set true only after QA to allow search-engine indexing             |

Generate a rate-limit secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. It is not a user password. No infrastructure secrets belong in the store-settings screen. If a secret has been shared outside a trusted secret-entry mechanism, replace it in Supabase API Keys and update the local/hosting environment.

## Supabase setup — required before real data tests

1. Create a Supabase project. Obtain the URL, publishable key and secret key from its dashboard. Enter them only in `.env.local` or the hosting secret manager.
2. For a fresh project with no store tables, run **`supabase/setup.sql` once** in the project's SQL Editor. This bundles all migrations in a single transaction. If you already applied some files, run only the remaining migrations **once each, in order**:
   - `supabase/migrations/001_store.sql`
   - `supabase/migrations/002_media.sql`
   - `supabase/migrations/003_catalog_safety.sql`
   - `supabase/migrations/004_inventory_and_bestsellers.sql`
3. Do not rerun applied migrations. For later changes, append a migration. These scripts create tables, indexes, RLS policies, transactional RPCs, the six initial categories, default disabled store settings and the public `product-media` bucket. They do not create fictional products.
4. Supabase project API keys cannot run SQL migrations. Use the SQL Editor or Supabase CLI with the appropriate account/database access. Do not expose a general SQL-execution RPC.
5. In Auth settings, disable public signups. Create your father's user under Authentication → Users → Add user. Choose a strong password and configure MFA in your organization if required. There is no registration page in this app.
6. Copy that user's UUID and run this administrative SQL, replacing the placeholder locally:

```sql
insert into public.admins(user_id) values ('YOUR_AUTH_USER_UUID');
```

Alternatively, a trusted operator can run `node --env-file=.env.local scripts/provision-admin.mjs ADMIN_EMAIL`. It is idempotent, requires the local server secret, preserves existing passwords and creates new users without assigning a password or sending email. The owner must complete password recovery themselves. No provisioning endpoint is exposed on the website.

7. Set Auth → URL Configuration → Site URL to your production origin (and localhost for development as appropriate). Allow redirects to `http://localhost:3000/auth/confirm`, `http://127.0.0.1:3000/auth/confirm` and `https://YOUR_DOMAIN/auth/confirm` only for your actual environments.
8. Configure a production SMTP provider for reliable reset mail. In the **Reset Password** email template, use a token-hash recovery link so SSR can establish a server-side session:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Set SiteURL to the environment you're testing; the handler supports PKCE `code` links as well. Test recovery before launch. Don't use wildcard redirect origins.

9. Sign in at `/admin/login`. Set the real business name/contact details, logo URL, policies, WhatsApp number (international digits only), delivery fee, optional city fees/free-delivery threshold. Set 0 only when delivery is actually free. Enable checkout only when those details are ready.
10. Add real products and images. Every product needs at least one variant, even if it is named Standard. Variant SKU is unique. Inventory and optional override prices are per variant.

## Security and inventory design

- Public reads use the publishable key and RLS. Inactive products/categories and private orders are hidden. All admin operations revalidate the Supabase user and `admins` membership, then use the authenticated user's client.
- The secret client is server-only and used for guest checkout/rate limiting. SQL `place_order` is executable only by `service_role`, validates database prices/status/stock, locks variants in deterministic order, saves immutable item snapshots and subtracts stock in the same transaction. Browser totals and discounts are ignored.
- Prices are integer **paisa** in PostgreSQL; forms show rupees. Currency/country are intentionally restricted to PKR/Pakistan for this release to avoid unsupported international phone/shipping behavior.
- An idempotency UUID plus canonical request hash prevents duplicate successful requests and rejects reuse for a different payload. Never retry an uncertain checkout with a fresh key unless deliberately starting a new order.
- Inventory is held immediately for a saved order, including pending confirmation. Carts do not reserve stock. There is **no automatic expiry job**: the administrator must regularly cancel abandoned/unverified orders. Cancellation atomically restores stock once; cancelled orders cannot reopen. Delivered orders cannot reopen or cancel. Payment status is separate; initial COD status is unpaid.
- Products with historical orders cannot be deleted; archive them. Removed variants are disabled, preserving IDs and snapshots. A database trigger protects product deletion even if requests race.
- PostgreSQL-backed checkout limit: 8 attempts per 15 minutes per HMAC-hashed client address. Expired rate-limit rows are cleaned lazily. On Vercel use its edge-set `x-vercel-forwarded-for`; another host must **strip and replace** `x-real-ip` with a trusted client address. Production checkout fails closed if an address is unavailable. Do not trust arbitrary inbound forwarding headers on a custom host.
- JSON mutation endpoints require the same Origin. Admin routes are dynamic, no-store, and noindex. Sessions use HTTP-only, Secure-in-production, SameSite Lax cookies and a refresh proxy. There is no public order lookup by sequential reference. Order details are returned only to the submitting request or authenticated admin.
- React escapes descriptions/customer text; there is no raw HTML content editor. JSON-LD escapes `<`. Product media allows raster image/video types, not SVG/HTML. Server uploads verify signatures, MIME and size.
- Uploads are limited to **3 MB per file** to fit common serverless request limits (Vercel's request limit includes multipart overhead). Multiple files upload sequentially with progress and individual persistence. Larger videos need an HTTPS directly playable URL; YouTube watch links are not direct video files. No new paid video service is required. External URLs load in the browser, not a server-side URL fetch.
- Storage persists in Supabase, not the production filesystem. Upload failures clean up their new object where possible; removing media/product also attempts cleanup. If storage deletion fails, the admin sees an error. Review unreferenced keys in the Storage dashboard before deleting; do not bulk delete files without checking `product_media.storage_key`. There is no unattended cleanup service.
- The public storage bucket is for published product assets only; don't upload private documents or customer information. Supabase database backups do not substitute for object-storage backups.

## Tests

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:integration
npm.cmd run test:smoke # requires npm run dev or npm start in another terminal
```

Unit tests cover phone formats, paisa prices, shipping rules, checkout/settings/product validation, WhatsApp encoding and all-item summaries, long-message fallback, upload signatures, request origins, body-size limits and safe errors. Database tests execute the actual migrations in an isolated embedded PostgreSQL database with test-only Auth and Storage schemas; they verify RLS, transaction rollback, idempotency, inventory, cancellations, stale stock edits, immutable snapshots, media ordering and best sellers. They do not substitute for hosted Supabase authentication/storage tests or multi-connection concurrency testing. The live integration script makes read-only schema/RLS/function-access/storage checks. It fails when migrations/configuration are missing; it never silently skips them.

Trusted-operator live exercises (run only with authorization against the intended project, while the local app is running):

```powershell
node --env-file=.env.local scripts/live-admin.mjs ADMIN_EMAIL
node --env-file=.env.local scripts/live-checkout.mjs ADMIN_EMAIL
```

These tests authenticate through the Supabase Admin API using short-lived in-memory sessions without assigning passwords or sending email. They create clearly labeled disposable QA records, exercise the real HTTP APIs, cancel/delete only their own test orders, clean up their own products/media/users, and sign out. The checkout exercise temporarily enables ordering and restores it to disabled after testing; do not run it against an operating store. A failed cleanup is reported explicitly. No WhatsApp message is sent. `scripts/browser-fixture.mjs setup` and `cleanup ADMIN_EMAIL` provide the equivalent disposable fixture for manual browser QA; its local state is ignored by Git. `scripts/check-auth-redirect.mjs ADMIN_EMAIL` checks callback acceptance without sending email or printing recovery tokens.

### Required manual acceptance before launch

1. On desktop and mobile, sign in as the allowlisted admin. Verify logout and reset password, and that an ordinary authenticated user is rejected.
2. Add/edit/archive a product and two differently priced variants. Upload several real images, select a primary image, reorder/remove them, add a short video. Refresh and verify public catalog/detail changes. Inactive categories/products must disappear.
3. Search/filter/sort and paginate. Add both variants to a cart, reload, change quantities, remove one and re-add it. Try quantities above stock.
4. Set actual shipping/WhatsApp, enable checkout, submit one test order with real permission to use those contact details. Verify persisted order/items and stock subtraction before WhatsApp opens. Tap Send manually. Verify retry/copy controls. Cancel the test order to release stock.
5. Submit an identical idempotency key twice; expect one order. Change price/stock before checkout; expect rejection with a cart-refresh prompt. Make two simultaneous orders for the last unit; exactly one may succeed.
6. Change product name/price after ordering; the old order must retain original snapshots. Cancel twice; stock must restore once. Check private data cannot be fetched anonymously. Check client bundles do not contain the server secret.
7. Verify database/network/upload failure messages, keyboard use, contrast, 375px/mobile layout, actual WhatsApp launch and long-message copying.

## Deployment preparation

The project owner will upload to GitHub and import into Vercel manually. See `DEPLOYMENT.md` for the focused handover checklist. No account connection, Git push, hosting purchase or deployment is authorized as an automatic follow-up.

No deployment has been performed. Use a provider/plan permitting commercial use. **Vercel Hobby is for personal, non-commercial use; do not launch this business there on Hobby.** Review current [Vercel plan terms](https://vercel.com/docs/plans/hobby) and [Supabase limits/pricing](https://supabase.com/pricing) before selecting a plan. This project does not automatically purchase a plan, recommend an unnecessary upgrade, or assume free-tier capacity and backups are sufficient.

For an authorized Vercel deployment:

1. Apply migrations, configure Auth/Storage and complete the acceptance checklist above. Confirm hosting terms/limits and choose the appropriate plan.
2. Push this repository (without `.env.local`) to your Git provider, import it into Vercel, select Next.js and Node 22.x, install with `npm ci`, build with `npm run build`.
3. Configure the environment variables in Vercel → Project → Settings → Environment Variables; keep server secrets in the secure field. Set the production SITE_URL, Auth recovery origin and trusted client address handling. Do not put secrets in `next.config.ts` or `NEXT_PUBLIC_*` variables.
4. Deploy and run `npm run test:integration` against that same database, plus authenticated CRUD/upload/checkout checks against the deployed URL. Inspect provider logs for safe error messages, without logging customer addresses, phone numbers or keys.
5. Add the custom domain in the hosting dashboard; apply the exact DNS values the host supplies, verify HTTPS, then update SITE_URL and Supabase redirect allowlist and redeploy. Do not guess DNS records.
6. After real branding, catalog, policies and tests pass, set STORE_LAUNCHED=true and request indexing. Rotate any exposed credentials before launch.

Troubleshooting: PGRST205 / missing tables → apply migrations in order. Missing `search_catalog` → apply migration 003. Login succeeds but access is rejected → check `admins.user_id`. Upload fails → check bucket/policies/type/size. Checkout disabled → set WhatsApp/delivery and enable orders. Production checkout unavailable → check secret key, rate-limit secret and trusted IP header. SQL migration errors → stop, record the exact error and check which migrations were applied before rerunning anything.

Official references: [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).
