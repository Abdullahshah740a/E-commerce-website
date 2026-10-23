# Verification — 23 October 2026

## Current order flow

Product-media repair: YouTube watch/share/Shorts/live/embed links now render through a shared privacy-enhanced YouTube iframe player in both the customer gallery and admin preview, with fullscreen/inline playback and an explicit referrer policy. Uploaded MP4/WebM files retain native controls. Invalid YouTube channel/playlist links are rejected when added; existing valid saved video links work without being re-added. Product detail, thumbnail, catalog and admin images use contain sizing so the full original frame is visible; the catalog hover crop was removed. Browser verification on the owner's existing Charcoal Woven Throw product confirmed actual YouTube playback (moving video/captions after Play) and full-frame rendering of the existing 334×222 image. No products/media/database rows were changed for this test. All 88 tests, ESLint and production build passed. Screenshots: `artifacts/product-youtube-fixed.png`, `artifacts/product-full-image-fixed.png`. Requires source deployment; no SQL migration.

Discord readability refinement: updated the active Make module to use six separate full-width fields (phone, delivery address, items, payment, instructions, customer note), bold headings/total, Pakistan-local order date and sage accent. Removed the raw-summary description. The phone field contains only the number; native mobile copying remains client-controlled and untested. A complete text receipt is attached so long item lists can use an explicit bounded preview without losing details. The owner approved one new fictional test; Make run `d23a94f3fe5647ad810561debdadbc0c` succeeded, returning one embed, one complete 893-byte attachment and message `1563134972003487745`. All six field values and PKR 3,450 total were checked. No website order or inventory changes. See WEBHOOK.md for the current mapping and its summary-delimiter dependency. This Make-only change is already live.

Customer receipt presentation: replaced the raw summary textarea with a static branded receipt card containing the saved order reference/date, status, delivery/contact details, item snapshots, quantities, prices, delivery/discount/total and optional customer notes. Added copy-summary and print/save-PDF controls, print-specific layout, small-screen stacking, and focus/scroll to the confirmation after submission. The API explicitly projects customer-safe fields instead of returning database records. The full existing suite plus initial receipt checks passed (70 tests), and the additional static-render check passed (3 receipt tests total), verifying escaped text and absence of editable fields. Desktop browser inspection used fictional local fixtures only; no orders or notifications were sent. Preview screenshots are in `artifacts/receipt-card.png` and `artifacts/receipt-card-details.png`; the temporary preview route was removed. Requires uploading/deploying the updated source; no SQL migration is needed.

Make/Discord presentation follow-up: the owner authorized editing the existing scenario and sending two fictional QA messages. Separate historical message IDs showed that orders were not being appended to one Discord message. The active scenario now sends a distinct rich order card with its own order-reference title and complete summary. Both approved QA runs succeeded with one embed each and different Discord message IDs; neither card contained the other order's reference. This external scenario change requires no application deployment. See WEBHOOK.md for mapping and evidence.

Production configuration follow-up: authenticated Vercel inspection found SUPABASE_SECRET_KEY present but CHECKOUT_RATE_LIMIT_SECRET absent. The owner approved saving a random 64-character Production secret and redeploying the current GitHub commit. Local source also now derives a separate rate-limit HMAC key from the required server credential if the optional override is blank, and returns safe setup error codes instead of an undifferentiated configuration failure. Thirteen targeted configuration/request tests, lint and the production build passed. The local fallback/error-code changes are not part of the existing GitHub commit being redeployed until the owner pushes them.

Approved production fix completed: deployment `4kcTXRMXEdAcdMStNk2F5y9opADw` is Ready and assigned to `e-commerce-website-sepia.vercel.app`. The same empty diagnostic request changed from HTTP 503 to the expected HTTP 400 validation response. A fictional two-item order placed through the production API returned its receipt, Make accepted the payload on the first attempt, and identical replay reused the receipt without another notification. The QA order/product/queue record were cleaned up, leaving the owner's products/settings intact.

Owner-requested fallback update: the Make endpoint is now hardcoded only in the server-only notification module. A missing/blank ORDER_WEBHOOK_URL uses that default for both readiness and delivery. Four configuration tests plus five transport tests passed, as did production build and lint. A scan of 24 browser JavaScript/source-map files found zero endpoint/server-secret matches. Deploy the updated source to use this fallback on Vercel; no database migration is needed.

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
- Direct uploads are limited to 3 MB per file. Longer videos can use YouTube video links (embedding must be allowed) or directly playable HTTPS video URLs. Category images and logos accept URLs; their own dedicated upload controls are not included.
- Pending saved orders hold stock until an administrator cancels them; there is no automatic expiry or scheduled stock-release job.
- Store-owner instructions cover reviewing unreferenced storage objects; no automatic background orphan-media cleanup service exists.

**The core workflow is implemented and tested with the live backend. Production launch is pending real business content, final policies, hosting and deployed-environment verification.**

Receipt final checks: ESLint and production build passed after removal of the temporary preview route. The additional receipt render test passed, bringing verified coverage to 71 tests across the full run and focused follow-up.

