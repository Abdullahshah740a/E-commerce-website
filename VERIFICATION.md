# Verification — 23 October 2026

## Current order flow

Availability follow-up: the running `/checkout` response reports notification readiness and checkout enabled, with PKR 100 delivery. Browser inspection confirmed the enabled Confirm order button. Checkout now refreshes server availability on focus/pageshow and immediately/every 15 seconds while unavailable, preserving the mounted form; a Check again button provides a manual recheck. TypeScript and lint passed for this fix.

Final checks for the Make change: **60 automated tests, 12 local HTTP checks, 10 read-only hosted Supabase checks, ESLint and production build passed**. A scan of 24 client JavaScript/source-map files found zero matches for the configured webhook URL or server secret. Browser inspection showed an enabled Confirm order button, no WhatsApp checkout field/link, and the unchanged PKR 100 delivery fee. The owner's cart and form data were not submitted during browser inspection.

The owner replaced WhatsApp ordering with server-side Make webhook delivery. Migration 005 is installed. Confirm order saves a pending/unpaid COD order and a durable notification atomically, then returns a receipt immediately. Background delivery has leases, bounded retries and admin status/manual retry. The private endpoint stays in ORDER_WEBHOOK_URL. Live testing verified Make HTTP acceptance on attempt one, complete two-item payload, no WhatsApp link, and idempotent replay without another send. All QA records were removed. The current automated suite passes 60 tests; build, type checks and lint are checked for this change. See WEBHOOK.md. Older WhatsApp/browser observations below describe the previous flow, not the current checkout.

## Implemented source

- Responsive storefront, configurable branding/promotions/policies, dynamic category/product catalog, database-side search/filter/sort/pagination, product detail/gallery/video/variants, genuine delivered-order best sellers.
- Temporary cart with refresh of authoritative prices/availability, guest COD checkout, Pakistani/international phone normalization, delivery rules, persistent order snapshots and WhatsApp summary/retry/copy flow.
- Supabase administrator authentication/recovery/logout, server-side administrator allowlist, product/category/variant/media/settings management and searchable order management.
- PostgreSQL RLS, transactional stock holding/cancellation, idempotency, stale-price/stock checks, stale-admin-form protection, persistent abuse limiting, validated media uploads and storage cleanup attempts.
- Deployment/setup documentation, ignored local secrets, schema migrations and a fresh-install SQL bundle.

## Local checks

- Production build: passed with Next.js 16.4.2 and Node 22.18.
- Strict TypeScript: passed (also checked by production build).
- ESLint: passed.
- Automated tests: **53 tests** across commerce, cart limits/quantity handling, catalog URL validation, HTTP request boundaries, and actual PostgreSQL migration/business-rule tests.
- Local HTTP smoke checks: the original **10 passed against both development and production servers**. The expanded **12-check suite passed against development**, additionally covering repeated search parameters, fractional pages and malformed category/page values.
- Client build scan: **24 JavaScript/source-map files scanned, zero matches for the configured server secret**. The local environment file is Git-ignored.
- Browser: homepage inspected at desktop width and 375px mobile width; no mobile horizontal overflow was observed. Catalog navigation and guest `/admin` → `/admin/login` redirect were observed. A real QA product journey added two variants, preserved the cart across reload, submitted checkout, displayed the saved order reference/total, cleared the cart and copied the full summary. After explicit owner approval, the external WhatsApp preview was inspected and showed every item and the correct destination/total. Send was not pressed. The QA order/product were cancelled and removed afterward.
- Browser testing found an ICU currency-format hydration mismatch. Explicit fraction digits fixed it, a regression test was added, and no new browser errors were observed during the subsequent journey.
- Improvement review fixed misleading success when the cart is full, fractional cart quantities, repeated/invalid catalog parameters, image-dialog keyboard navigation/focus restoration, and unbounded upload/checkout/cart-refresh waits. Checkout retains its idempotency key after a timeout and explains safe recovery. The dialog was checked in-browser for opening, Escape dismissal, restored focus and scroll restoration; repeated search parameters rendered normally. Its disposable gallery product/image were removed without changing settings or orders.

The PostgreSQL tests run the actual migration SQL in isolated PGlite PostgreSQL, with test-only Auth/Storage schemas and roles. This is a test dependency only; the application uses Supabase for persistent business data. Hosted Supabase API/storage and concurrent checkout behavior were also exercised separately with disposable QA fixtures, as described below.

## Live Supabase status at last check

- Project is reachable.
- Settings table exists; publishable and secret clients can read its public settings row.
- Anonymous users cannot read orders or administrator identities.
- Anonymous callers cannot execute the guest order-creation RPC.
- Product media storage bucket exists.
- All five migrations are installed; public catalog and best-seller functions pass. No further SQL setup is currently needed. Do not rerun the fresh-install bundle.
- The supplied administrator account was created without assigning a password or sending email, added to the allowlist, and verified with an in-memory authenticated session. The owner subsequently confirmed private password setup and successful sign-in.
- Real business settings are persisted: Rahat Bedsheets, WhatsApp +923490896871, and PKR 100 delivery. The owner subsequently requested checkout activation; it is now enabled. Nine live checkout checks were repeated successfully, their QA records removed, and the enabled state restored afterward. The latest checkout sends to Make and immediately shows a receipt; WhatsApp is no longer part of ordering.

## Live integration exercises

- **8 read-only checks passed** for schema/function access, RLS and storage configuration.
- **13 authenticated admin checks passed**: administrator session, actual dashboard, category creation/editing, draft visibility, product/variant saves, catalog filters, current cart prices, PNG uploads/public retrieval, primary-image/reordering persistence, file deletion from origin storage, disguised-file rejection, invalid-setting rejection, stale-stock protection, non-admin rejection, archiving and logout.
- **9 checkout checks passed**: persisted pending/unpaid COD order with authoritative totals, full correctly encoded WhatsApp summary, idempotent retry, mismatched-key rejection, changed-price rejection, immutable snapshots, cancellation/restocking once, concurrent last-unit protection, and malformed-input rejection. Two parallel HTTP submissions for one remaining unit produced exactly one saved order and one stock rejection.
- Browser QA separately saved a two-variant order totalling PKR 3,600 including PKR 100 delivery, then showed retry/copy controls. WhatsApp's preview displayed the full saved summary after the owner's explicit inspection approval; no message was sent.
- Tests used clearly labeled disposable records and short-lived sessions held only in memory. The test-only non-admin account, products, category, images and orders were cleaned up. Business settings and the real administrator were preserved. No real customer order was created or modified.
- Longer video playback/upload, password-reset delivery reliability under production SMTP, and deployed-host behavior still require launch checks. The local owner-confirmed password flow is not a guarantee of production email deliverability.

## Still required before launch

Owner-requested browsing samples were subsequently added: **12 products with 24 original sample illustrations**, variants, fictional stock/prices, sale examples and an out-of-stock example. Each product name starts with `Demo —`, and its description identifies it as a sample. These records are intentionally retained for the owner to browse and delete through admin. This is separate from the disposable QA fixtures that were removed. The demo seeder is manual-only and skips existing demo slugs; it never runs during a build or deployment. Store settings and orders were not changed.

Remove/archive these demo products through `/admin/products` before launch. If a sample has acquired order history, archive it instead of permanently deleting it.

1. Add the real product catalog, photos, prices, variants and inventory through `/admin`. The storefront intentionally has an honest empty state until then.
2. Configure the actual store logo/address and final delivery/return/privacy policies. Business name, phone, WhatsApp and delivery fee are already saved.
3. Configure production Auth URLs, recovery email/SMTP, signup restrictions and backups. Test the owner's password login/recovery in the deployed environment and test a real video if videos will be used.
4. Select commercial-compatible hosting, configure secure production environment/redirect URLs and trusted client-address headers, deploy and verify the deployed workflow. Checkout is enabled at the owner's request; search indexing remains disabled pending production launch review. **No deployment has been performed.**

## Deliberate release limits

- Pakistan/PKR only. The settings display these fixed initial-market values; international storefront configuration is not implemented.
- Direct uploads are limited to 3 MB per file. Longer videos require a directly playable HTTPS URL. Category images and logos accept URLs; their own dedicated upload controls are not included.
- Pending saved orders hold stock until an administrator cancels them; there is no automatic expiry or scheduled stock-release job.
- Store-owner instructions cover reviewing unreferenced storage objects; no automatic background orphan-media cleanup service exists.

**The core workflow is implemented and tested with the live backend. Production launch is pending real business content, final policies, hosting and deployed-environment verification.**
