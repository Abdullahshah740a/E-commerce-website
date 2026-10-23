# Manual GitHub → Vercel handover

The owner will perform GitHub upload and Vercel hosting manually. This document prepares those steps; it does not mean a deployment has happened.

## Current state

The application builds and has passed local automated tests, live Supabase access/admin/checkout checks, and a real browser purchase journey. All five migrations and the requested administrator are installed. The owner confirmed password setup and sign-in. Business name and PKR 100 delivery are stored in the database. The private Make endpoint is stored server-side in the environment. Disposable QA records are removed. At the owner's request, checkout is enabled using the server-side Make webhook; see WEBHOOK.md. Search indexing remains disabled. Remove demo products and finish production launch checks before accepting real sales.

Business content is managed through `/admin`: add the real products/photos/prices/stock, store logo/address and final policies. That content is in Supabase and does **not** need another code upload each time it changes.

## 1. Upload the source to GitHub yourself

- Use the project folder as the repository root: the root must contain `package.json`, `package-lock.json`, `src/`, `supabase/` and the Next.js configuration.
- Include the source, migration files, tests, scripts, `.env.example`, `.gitignore` and documentation. A private repository is suitable for initial setup; Vercel supports repository imports through its Git integration.
- Do not upload `.env.local`, other real environment files, `node_modules/`, `.next/`, `.npm-cache/`, temporary QA state, or logs. `.gitignore` already excludes them when using Git or GitHub Desktop. A web-based folder upload may still include explicitly selected ignored files: review that selection yourself.
- Never copy actual API secrets into README files, source code, issue text or commit messages. The new Supabase server secret is used through `SUPABASE_SECRET_KEY` only.

## 2. Choose a commercial-compatible Vercel plan

This is a commercial store, including when orders use COD. Vercel's Hobby plan is restricted to non-commercial personal use. Check the current [Vercel fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines) and [plan terms](https://vercel.com/legal/terms) before selecting a plan. No plan has been purchased or upgraded by this project.

## 3. Import the repository in Vercel

Use Vercel's GitHub import flow and select this repository. Confirm:

| Setting          | Value                                  |
| ---------------- | -------------------------------------- |
| Framework        | Next.js                                |
| Root directory   | Folder containing `package.json`       |
| Node.js          | 22.x (also declared in `package.json`) |
| Install command  | `npm ci`                               |
| Build command    | `npm run build`                        |
| Output directory | Leave the Next.js default              |

Do not configure a static export or use `dist/` as the output. This application needs server-side authentication and checkout routes.

## 4. Enter environment variables in Vercel

Copy the required values privately from your local `.env.local` or the provider dashboards into Vercel's environment-variable fields. Do not upload that file to GitHub.

| Variable                               | Production value                            |
| -------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Existing Supabase project URL               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing `sb_publishable_…` key             |
| `ORDER_WEBHOOK_URL`                    | Owner-provided private Make endpoint        |
| `SUPABASE_SECRET_KEY`                  | Server-only `sb_secret_…` key               |
| `CHECKOUT_RATE_LIMIT_SECRET`           | Random secret at least 32 characters long   |
| `NEXT_PUBLIC_SITE_URL`                 | Actual HTTPS production URL                 |
| `STORE_LAUNCHED`                       | `false` until the launch review is complete |

Do not give the secret key a `NEXT_PUBLIC_` prefix. Do not manually invent or set the `VERCEL` platform variable; Vercel supplies it. Checkout uses Vercel's documented edge-set client-address header for abuse limiting.

If the production URL is not known until the first deployment, update `NEXT_PUBLIC_SITE_URL` with the URL Vercel actually assigns and redeploy before testing recovery links or enabling orders. Environment-variable edits apply to subsequent deployments, so redeploy after changes. Configure Preview variables separately if you will use Preview deployments; avoid sending casual previews to a live production database once the store is operating.

## 5. Configure production Supabase authentication

- Set the Supabase Auth Site URL to the actual production HTTPS origin.
- Add the exact production `/auth/confirm` callback to the redirect allowlist. Keep localhost entries only if local development is still required; don't use broad wildcard origins.
- Follow the reset-email/SMTP instructions in `README.md`. Confirm password recovery actually reaches the intended inbox and lands on `/admin/reset` in production.
- Disable public signups; customers use guest checkout. Only identities listed in `public.admins` can administer the store.
- Do **not** rerun `supabase/setup.sql` or migrations 001–005 on the configured project. They are already installed. Future schema changes must use new migrations.

## 6. Test the deployed website before accepting orders

1. Open the production URL on mobile and desktop. Check the real branding, product photos, variants and stock. Verify category/search/filter/sort/cart persistence.
2. Sign in as the owner. Edit one test product, upload an image, refresh and confirm the public catalog reflects the change. Sign out and verify private pages/API operations are blocked.
3. Verify store settings: order notification configuration, PKR 100 delivery unless deliberately changed, policies and contact details. No online payment/card collection is implemented.
4. Enable checkout for a controlled test. Submit a clearly identified test order, confirm it appears in the admin dashboard with the correct saved snapshots/totals, and verify Make accepts every saved item and the website displays a receipt without opening WhatsApp. Cancel the test order through admin to restore stock when finished.
5. Verify password recovery and storage behavior on the deployed host. Review safe hosting logs if anything fails. Do not log customer addresses, phone numbers, auth tokens or secret keys.
6. Once the owner approves the real content, policies and production checks, keep checkout enabled and set `STORE_LAUNCHED=true`, then redeploy to allow search-engine indexing.

The local live-test scripts intentionally create disposable data and toggle checkout; do **not** run those write exercises against an operating store. The read-only `scripts/integration.mjs` is suitable for checking backend setup without creating orders.

## 7. Custom domain, if wanted

Add the domain through Vercel and apply only the DNS records Vercel supplies. After HTTPS is verified, update `NEXT_PUBLIC_SITE_URL`, the Supabase Site URL and allowed callbacks, then redeploy and repeat recovery/checkout checks. The domain is optional; the assigned production URL can be used initially.

Official references: [Git repository deployment](https://vercel.com/docs/git), [environment variables](https://vercel.com/docs/environment-variables), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [request headers](https://vercel.com/docs/headers/request-headers).
