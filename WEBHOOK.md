# Order confirmation → Make

At the owner's explicit request, the supplied Make URL is now the default in the server-only `src/lib/order-webhooks.ts` module. Checkout and delivery use this same default when `ORDER_WEBHOOK_URL` is missing or blank, including on Vercel. The URL is therefore present in repository source, but is not sent to the browser. `ORDER_WEBHOOK_URL` remains an optional server-only override; never use a `NEXT_PUBLIC_` prefix. No Discord integration is implemented; the owner manages downstream Make/Discord processing.

## Customer flow

The customer clicks **Confirm order**. A PostgreSQL transaction checks current prices and stock, saves the pending/unpaid COD order and its item snapshots, reduces stock, and queues one immutable notification. The website immediately returns a receipt and clears the cart. It opens no WhatsApp page and requires no message to be sent by the customer.

The order remains `pending_confirmation` until the owner confirms it in Admin → Orders. A placed order is not a paid or dispatched order.

## Make payload

POST JSON includes:

- `event_id`: stable UUID for this notification. Retries use the same value, also supplied in the `Idempotency-Key` header.
- `event: "order.placed"`, `schema_version: 1`.
- `order`: saved ID/reference, date, customer name/phone/address/area/city/province/instructions/notes, payment method/status, order status, currency and exact saved totals.
- `items`: every saved product/variant name, SKU, quantity, unit price and line total.
- `money_unit: "paisa"`: integer amounts in `order` and `items` are paisa.
- `totals`: subtotal, delivery, discount and total converted to **rupees**, with currency and unit labels.
- `summary`: a complete readable text summary, suitable for the owner's manual Discord forwarding.

Internal admin notes, authentication tokens, checkout hashes, idempotency secrets and the webhook URL are not included in the payload or customer receipt.

## Delivery and recovery

Next.js `after()` sends the queued payload after returning the receipt. A successful HTTP 2xx marks it delivered. Each checkout notification gets up to three attempts, each with an eight-second timeout. A database lease prevents concurrent workers from sending the same notification at once. Successful deliveries are skipped on customer retries.

Failed notifications remain in the database. Admin → Orders → an order shows **Make order notification**, its status/attempts and a retry button. An interrupted worker's lease becomes reclaimable after two minutes. There is no external scheduler to configure for this initial flow; retries beyond the immediate attempts are manual through admin. Review failed notifications before dispatching orders.

Delivery is at least once: if Make accepts a request but its response is lost, a retry may reach Make again. Downstream processing should deduplicate using `event_id` if duplicate messages matter. HTTP acceptance confirms Make received the notification; it does not confirm downstream Discord execution.

The queue is protected by RLS. Only administrators can view its status/payload; only the server can claim/send jobs. Redirects are rejected and the configured endpoint must use HTTPS on `hook.eu1.make.com`. Errors never store the response body or endpoint.

## Setup and verification

Migration `005_order_webhooks.sql` follows the four existing migrations. It removes WhatsApp as an ordering requirement and atomically queues new orders. It does not send historical orders automatically. The owner confirmed applying it to the configured Supabase project. Never rerun `setup.sql` on this project.

`node scripts/live-webhook.mjs ADMIN_EMAIL` sends one clearly fictional QA order to the configured Make endpoint, verifies receipt, delivery and idempotent replay, then cancels/deletes only its own test records. It leaves business settings and demo products alone. Do not run write integration exercises against an operating store without a controlled test window.

Live verification: Make accepted the two-item QA payload on the first delivery attempt. An identical checkout replay reused the reference and left the delivery attempt count unchanged. The QA records were removed.
