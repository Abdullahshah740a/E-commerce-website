-- Apply once after migrations 001-004. Existing orders are not sent automatically.
create table public.order_webhooks (
  order_id uuid primary key references public.orders(id) on delete cascade,
  event_id uuid not null unique default gen_random_uuid(),
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','delivered','failed')),
  attempts integer not null default 0,
  lease_token uuid,
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.order_webhooks enable row level security;
create policy admin_webhook_read on public.order_webhooks for select to authenticated using(public.is_admin());
grant select on public.order_webhooks to authenticated;
grant all on public.order_webhooks to service_role;

create function public.enqueue_order_webhook(p_order uuid) returns void language sql security definer set search_path=public as $$
  insert into public.order_webhooks(order_id,payload)
  select o.id, jsonb_build_object(
    'schema_version',1,'event','order.placed','money_unit','paisa',
    'order',to_jsonb(o)-'idempotency_key'-'request_hash'-'internal_notes'-'updated_at',
    'items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id)
  ) from public.orders o where o.id=p_order
  on conflict(order_id) do nothing;
$$;
revoke all on function public.enqueue_order_webhook(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_order_webhook(uuid) to service_role;

create function public.claim_order_webhook(p_order uuid) returns setof public.order_webhooks language sql security definer set search_path=public as $$
  update public.order_webhooks
  set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),locked_at=now(),last_error=null
  where order_id=p_order and status<>'delivered'
    and (status in ('pending','failed') or locked_at < now()-interval '2 minutes')
  returning *;
$$;
revoke all on function public.claim_order_webhook(uuid) from public,anon,authenticated;
grant execute on function public.claim_order_webhook(uuid) to service_role;

create or replace function public.place_order(p_key uuid,p_hash text,p_customer jsonb,p_items jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg jsonb; existing public.orders; o public.orders; x jsonb; v record; sub bigint:=0; shipping integer; price_now integer; rows_count integer; begin
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into existing from public.orders where idempotency_key=p_key;
 if found then
   if existing.request_hash<>p_hash then raise exception 'Idempotency conflict'; end if;
   perform public.enqueue_order_webhook(existing.id);
   return jsonb_build_object('order',to_jsonb(existing)-'idempotency_key'-'request_hash'-'internal_notes','items',(select jsonb_agg(to_jsonb(i)) from public.order_items i where i.order_id=existing.id));
 end if;
 select data into cfg from public.settings where id=true for share;
 if not coalesce((cfg->>'checkout_enabled')::boolean,false) or cfg->>'delivery_fee' is null or not coalesce((cfg->>'delivery_enabled')::boolean,false) then raise exception 'Store is not accepting orders yet'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid cart'; end if;
 -- Consistent lock ordering prevents deadlocks across carts.
 perform 1 from public.variants where id in (select (value->>'variant_id')::uuid from jsonb_array_elements(p_items)) order by id for update;
 perform 1 from public.products where id in(select product_id from public.variants where id in(select (value->>'variant_id')::uuid from jsonb_array_elements(p_items))) order by id for share;
 if (select count(distinct value->>'variant_id') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Duplicate cart variant'; end if;
 for x in select value from jsonb_array_elements(p_items) loop
   select v1.*,p.name,p.price base_price,p.sale_price,p.active product_active,p.category_id into v from public.variants v1 join public.products p on p.id=v1.product_id where v1.id=(x->>'variant_id')::uuid;
   if not found or not v.active or not v.product_active or (v.category_id is not null and not exists(select 1 from public.categories where id=v.category_id and active)) then raise exception 'An item is no longer available'; end if;
   if (x->>'quantity')::integer not between 1 and 99 or v.stock<(x->>'quantity')::integer then raise exception 'Stock changed. Review your cart'; end if;
   price_now=coalesce(v.price,v.sale_price,v.base_price);
   if price_now<>(x->>'expected_price')::integer then raise exception 'Price changed. Review your cart'; end if;
   sub=sub+price_now*(x->>'quantity')::integer;
 end loop;
 shipping=coalesce((cfg->'city_fees'->>lower(trim(p_customer->>'city')))::integer,(cfg->>'delivery_fee')::integer);
 if cfg->>'free_delivery_threshold' is not null and sub>=(cfg->>'free_delivery_threshold')::integer then shipping=0; end if;
 if shipping<0 or sub+shipping>2000000000 then raise exception 'Order amount exceeds supported limit'; end if;
 insert into public.orders(idempotency_key,request_hash,customer,subtotal,delivery_fee,total,currency) values(p_key,p_hash,p_customer,sub,shipping,sub+shipping,coalesce(cfg->>'currency','PKR')) returning * into o;
 for x in select value from jsonb_array_elements(p_items) loop
   select v1.*,p.name,p.price base_price,p.sale_price into v from public.variants v1 join public.products p on p.id=v1.product_id where v1.id=(x->>'variant_id')::uuid;
   price_now=coalesce(v.price,v.sale_price,v.base_price);
   update public.variants set stock=stock-(x->>'quantity')::integer where id=v.id;
   insert into public.order_items(order_id,product_id,variant_id,name,sku,variant,quantity,unit_price,line_total) values(o.id,v.product_id,v.id,v.name,v.sku,concat_ws(' / ',nullif(v.size,''),nullif(v.color,''),nullif(v.design,'')),(x->>'quantity')::integer,price_now,price_now*(x->>'quantity')::integer);
 end loop;
 perform public.enqueue_order_webhook(o.id);
 return jsonb_build_object('order',to_jsonb(o)-'idempotency_key'-'request_hash'-'internal_notes','items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id));
end $$;
