-- Fresh installations only. Run once in Supabase SQL Editor.
-- Do not run this bundle if any store migration has already been applied.
begin;

-- 001_store.sql
-- Run once in Supabase SQL Editor. No development products are inserted.
create extension if not exists pgcrypto;
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;
create table public.categories(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100), slug text unique not null, description text not null default '', image_url text, position integer not null default 0, active boolean not null default true);
create table public.products(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, sku text unique not null, category_id uuid references public.categories(id), short_description text not null default '', description text not null default '', price integer not null check(price>=0), sale_price integer check(sale_price>=0 and sale_price<price), active boolean not null default false, featured boolean not null default false, tags text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.variants(id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, sku text unique not null, size text not null default '', color text not null default '', design text not null default '', price integer check(price>=0), stock integer not null default 0 check(stock>=0), active boolean not null default true);
create table public.product_media(id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, storage_key text unique, url text not null, type text not null check(type in ('image','video')), position integer not null default 0, is_primary boolean not null default false);
create unique index one_primary_media on public.product_media(product_id) where is_primary;
create table public.settings(id boolean primary key default true check(id), data jsonb not null default '{}'::jsonb);
insert into public.settings(data) values ('{"business_name":"Your textile store","description":"Comfort for every corner of home.","currency":"PKR","country":"Pakistan","whatsapp":"","delivery_fee":null,"free_delivery_threshold":null,"city_fees":{},"delivery_enabled":true,"checkout_enabled":false,"hero_title":"Make yourself at home.","hero_text":"Thoughtfully chosen textiles. Everyday comfort. Discover pieces for the spaces you love.","promotion":"Sofa covers, bedding & everyday home essentials","policies":"Store policies will be published before orders open."}');
create table public.orders(id uuid primary key default gen_random_uuid(), reference text unique not null default ('ORD-'||upper(encode(gen_random_bytes(6),'hex'))), idempotency_key uuid unique not null, request_hash text not null, customer jsonb not null, subtotal integer not null check(subtotal>=0), delivery_fee integer not null check(delivery_fee>=0), discount integer not null default 0 check(discount>=0), total integer not null check(total=subtotal+delivery_fee-discount), currency text not null default 'PKR', payment_method text not null default 'cod' check(payment_method='cod'), payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded')), status text not null default 'pending_confirmation' check(status in ('pending_confirmation','confirmed','preparing','dispatched','delivered','cancelled')), internal_notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.order_items(id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid references public.products(id) on delete set null, variant_id uuid references public.variants(id) on delete set null, name text not null, sku text not null, variant text not null, quantity integer not null check(quantity between 1 and 99), unit_price integer not null check(unit_price>=0), line_total integer not null check(line_total=quantity*unit_price));
create index product_category on public.products(category_id,active,created_at desc);
create index variant_product on public.variants(product_id);
create index media_product on public.product_media(product_id,position);
create index order_status on public.orders(status,created_at desc);
create index order_items_order on public.order_items(order_id);
create table public.request_limits(key text primary key, count integer not null, expires_at timestamptz not null);
create function public.touch_updated() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
create trigger products_updated before update on public.products for each row execute function public.touch_updated();
create trigger orders_updated before update on public.orders for each row execute function public.touch_updated();
alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.product_media enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.request_limits enable row level security;
create policy admin_self on public.admins for select to authenticated using(user_id=auth.uid());
create policy category_public on public.categories for select using(active or public.is_admin());
create policy product_public on public.products for select using(public.is_admin() or (active and (category_id is null or exists(select 1 from public.categories c where c.id=category_id and c.active))));
create policy variant_public on public.variants for select using(public.is_admin() or (active and exists(select 1 from public.products p where p.id=product_id)));
create policy media_public on public.product_media for select using(exists(select 1 from public.products p where p.id=product_id));
create policy settings_public on public.settings for select using(true);
create policy category_admin on public.categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy product_admin on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy variant_admin on public.variants for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy media_admin on public.product_media for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy settings_admin on public.settings for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy orders_admin_read on public.orders for select to authenticated using(public.is_admin());
create policy items_admin_read on public.order_items for select to authenticated using(public.is_admin());
-- No direct order writes, even for admins: status/inventory changes must be atomic.
create function public.take_rate_limit(p_key text) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; begin
 delete from public.request_limits where expires_at<now();
 insert into public.request_limits values(p_key,1,now()+interval '15 minutes') on conflict(key) do update set count=request_limits.count+1 returning count into n;
 return n<=8;
end $$;
create function public.place_order(p_key uuid,p_hash text,p_customer jsonb,p_items jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg jsonb; existing public.orders; o public.orders; x jsonb; v record; sub bigint:=0; shipping integer; price_now integer; rows_count integer; begin
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into existing from public.orders where idempotency_key=p_key;
 if found then
   if existing.request_hash<>p_hash then raise exception 'Idempotency conflict'; end if;
   return jsonb_build_object('order',to_jsonb(existing)-'idempotency_key'-'request_hash'-'internal_notes','items',(select jsonb_agg(to_jsonb(i)) from public.order_items i where i.order_id=existing.id));
 end if;
 select data into cfg from public.settings where id=true for share;
 if not coalesce((cfg->>'checkout_enabled')::boolean,false) or cfg->>'delivery_fee' is null or coalesce(cfg->>'whatsapp','') !~ '^[1-9][0-9]{7,14}$' or not coalesce((cfg->>'delivery_enabled')::boolean,false) then raise exception 'Store is not accepting orders yet'; end if;
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
 return jsonb_build_object('order',to_jsonb(o)-'idempotency_key'-'request_hash'-'internal_notes','items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id));
end $$;
create function public.update_order(p_id uuid,p_status text,p_payment text,p_notes text) returns void language plpgsql security definer set search_path=public as $$
declare o public.orders; begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'Order not found'; end if;
 if p_status not in ('pending_confirmation','confirmed','preparing','dispatched','delivered','cancelled') or p_payment not in ('unpaid','paid','refunded') or length(p_notes)>5000 then raise exception 'Invalid update'; end if;
 if o.status='cancelled' and p_status<>'cancelled' then raise exception 'Cancelled orders cannot be reopened. Create a new order'; end if;
 if o.status='delivered' and p_status<>'delivered' then raise exception 'Delivered orders cannot be reopened or cancelled'; end if;
 if p_status='cancelled' and o.status<>'cancelled' then
   perform 1 from public.variants where id in(select variant_id from public.order_items where order_id=p_id) order by id for update;
   update public.variants v set stock=v.stock+i.quantity from public.order_items i where i.order_id=p_id and i.variant_id=v.id;
 end if;
 update public.orders set status=p_status,payment_status=p_payment,internal_notes=p_notes where id=p_id;
end $$;
-- Atomic product/variant save. Retired variants are disabled, preserving history.
create function public.save_product(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid; x jsonb; vid uuid; ids uuid[]:='{}'; begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 pid=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 insert into public.products(id,name,slug,sku,category_id,short_description,description,price,sale_price,active,featured,tags) values(pid,p->>'name',p->>'slug',p->>'sku',nullif(p->>'category_id','')::uuid,p->>'short_description',p->>'description',(p->>'price')::integer,(p->>'sale_price')::integer,(p->>'active')::boolean,(p->>'featured')::boolean,array(select jsonb_array_elements_text(p->'tags')))
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,sku=excluded.sku,category_id=excluded.category_id,short_description=excluded.short_description,description=excluded.description,price=excluded.price,sale_price=excluded.sale_price,active=excluded.active,featured=excluded.featured,tags=excluded.tags;
 for x in select value from jsonb_array_elements(p->'variants') loop
  vid=coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()); ids=array_append(ids,vid);
  if exists(select 1 from public.variants where id=vid and product_id<>pid) then raise exception 'Invalid variant'; end if;
  insert into public.variants(id,product_id,sku,size,color,design,price,stock,active) values(vid,pid,x->>'sku',x->>'size',x->>'color',x->>'design',(x->>'price')::integer,(x->>'stock')::integer,(x->>'active')::boolean) on conflict(id) do update set sku=excluded.sku,size=excluded.size,color=excluded.color,design=excluded.design,price=excluded.price,stock=excluded.stock,active=excluded.active;
 end loop;
 update public.variants set active=false where product_id=pid and not(id=any(ids));
 return pid;
end $$;
revoke all on function public.place_order(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.place_order(uuid,text,jsonb,jsonb) to service_role;
revoke all on function public.take_rate_limit(text) from public,anon,authenticated;
grant execute on function public.take_rate_limit(text) to service_role;
revoke all on function public.update_order(uuid,text,text,text) from public,anon;
grant execute on function public.update_order(uuid,text,text,text) to authenticated;
revoke all on function public.save_product(jsonb) from public,anon;
grant execute on function public.save_product(jsonb) to authenticated;
insert into public.categories(name,slug,position) values ('Sofa Covers','sofa-covers',1),('Bedsheets','bedsheets',2),('Pillow Covers','pillow-covers',3),('Cushion Covers','cushion-covers',4),('Bedding Sets','bedding-sets',5),('Other Home Textiles','other-home-textiles',6);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-media','product-media',true,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
create policy public_media_read on storage.objects for select using(bucket_id='product-media');
create policy admin_media_insert on storage.objects for insert to authenticated with check(bucket_id='product-media' and public.is_admin());
create policy admin_media_delete on storage.objects for delete to authenticated using(bucket_id='product-media' and public.is_admin());


-- 002_media.sql
create function public.reorder_media(p_product uuid,p_ids uuid[],p_primary uuid) returns void language plpgsql security definer set search_path=public as $$
declare mid uuid; n integer:=0; begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 perform 1 from public.products where id=p_product for update;
 if (select count(*) from public.product_media where product_id=p_product)<>cardinality(p_ids) or (select count(distinct unnest) from unnest(p_ids))<>cardinality(p_ids) or exists(select 1 from unnest(p_ids) mid where not exists(select 1 from public.product_media m where m.id=mid and m.product_id=p_product)) then raise exception 'Media changed. Refresh and retry'; end if;
 if p_primary is not null and not exists(select 1 from public.product_media where id=p_primary and product_id=p_product and type='image') then raise exception 'Invalid primary image'; end if;
 update public.product_media set is_primary=false where product_id=p_product;
 foreach mid in array p_ids loop
 update public.product_media set position=n,is_primary=(id=p_primary) where id=mid; n=n+1;
 end loop;
end $$;
revoke all on function public.reorder_media(uuid,uuid[],uuid) from public,anon;
grant execute on function public.reorder_media(uuid,uuid[],uuid) to authenticated;


-- 003_catalog_safety.sql
-- Database-side filtering and pagination, including variant-specific prices.
create function public.search_catalog(p_query text default '',p_category uuid default null,p_size text default '',p_color text default '',p_min integer default null,p_max integer default null,p_sort text default 'newest',p_page integer default 1,p_featured boolean default false) returns jsonb language sql stable security invoker set search_path=public as $$
with eligible as (
 select p.*, (select min(coalesce(v.price,p.sale_price,p.price)) from public.variants v where v.product_id=p.id and v.active) lowest_price
 from public.products p where p.active and (not p_featured or p.featured)
 and (p_category is null or p.category_id=p_category)
 and (p_query='' or p.name ilike '%'||p_query||'%' or p.short_description ilike '%'||p_query||'%' or p.sku ilike '%'||p_query||'%' or exists(select 1 from unnest(p.tags) tag where tag ilike '%'||p_query||'%'))
 and exists(select 1 from public.variants v where v.product_id=p.id and v.active
 and (p_size='' or lower(v.size)=lower(p_size)) and (p_color='' or lower(v.color)=lower(p_color))
 and (p_min is null or coalesce(v.price,p.sale_price,p.price)>=p_min) and (p_max is null or coalesce(v.price,p.sale_price,p.price)<=p_max))
), paged as (
 select * from eligible order by
 case when p_sort='price-asc' then lowest_price end asc,
 case when p_sort='price-desc' then lowest_price end desc,
 case when p_sort='name' then name end asc,
 created_at desc,id
 limit 12 offset (greatest(1,least(p_page,10000))-1)*12
)
select jsonb_build_object('count',(select count(*) from eligible),'products',coalesce((select jsonb_agg(to_jsonb(p)-'lowest_price'||jsonb_build_object('variants',coalesce((select jsonb_agg(to_jsonb(v)) from public.variants v where v.product_id=p.id),'[]'::jsonb),'product_media',coalesce((select jsonb_agg(to_jsonb(m) order by m.position) from public.product_media m where m.product_id=p.id),'[]'::jsonb))) from paged p),'[]'::jsonb));
$$;
grant execute on function public.search_catalog(text,uuid,text,text,integer,integer,text,integer,boolean) to anon,authenticated;
create function public.protect_product_history() returns trigger language plpgsql set search_path=public as $$ begin
 if exists(select 1 from public.order_items where product_id=old.id) then raise exception 'Archive products with order history instead'; end if;
 return old;
end $$;
create trigger keep_ordered_products before delete on public.products for each row execute function public.protect_product_history();


-- 004_inventory_and_bestsellers.sql
-- Protect stock against stale admin forms.
create or replace function public.save_product(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare pid uuid; x jsonb; vid uuid; ids uuid[]:='{}'; begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 pid=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 perform 1 from public.variants where id in(select nullif(value->>'id','')::uuid from jsonb_array_elements(p->'variants')) order by id for update;
 insert into public.products(id,name,slug,sku,category_id,short_description,description,price,sale_price,active,featured,tags) values(pid,p->>'name',p->>'slug',p->>'sku',nullif(p->>'category_id','')::uuid,p->>'short_description',p->>'description',(p->>'price')::integer,(p->>'sale_price')::integer,(p->>'active')::boolean,(p->>'featured')::boolean,array(select jsonb_array_elements_text(p->'tags')))
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,sku=excluded.sku,category_id=excluded.category_id,short_description=excluded.short_description,description=excluded.description,price=excluded.price,sale_price=excluded.sale_price,active=excluded.active,featured=excluded.featured,tags=excluded.tags;
 for x in select value from jsonb_array_elements(p->'variants') loop
  vid=coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()); ids=array_append(ids,vid);
  if exists(select 1 from public.variants where id=vid and product_id<>pid) then raise exception 'Invalid variant'; end if;
  if exists(select 1 from public.variants where id=vid and (x->>'expected_stock' is null or stock<>(x->>'expected_stock')::integer)) then raise exception 'Inventory changed. Refresh the editor before saving'; end if;
  insert into public.variants(id,product_id,sku,size,color,design,price,stock,active) values(vid,pid,x->>'sku',x->>'size',x->>'color',x->>'design',(x->>'price')::integer,(x->>'stock')::integer,(x->>'active')::boolean) on conflict(id) do update set sku=excluded.sku,size=excluded.size,color=excluded.color,design=excluded.design,price=excluded.price,stock=excluded.stock,active=excluded.active;
 end loop;
 update public.variants set active=false where product_id=pid and not(id=any(ids));
 return pid;
end $$;
-- Return only current active products, without customer data or sales volumes.
create function public.best_sellers() returns jsonb language sql stable security definer set search_path=public as $$
 with ranked as (
 select p.id,sum(i.quantity) units from public.products p
 join public.order_items i on i.product_id=p.id join public.orders o on o.id=i.order_id
 where p.active and o.status='delivered' and (p.category_id is null or exists(select 1 from public.categories c where c.id=p.category_id and c.active))
 group by p.id order by units desc,p.id limit 4
 ) select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('variants',coalesce((select jsonb_agg(to_jsonb(v)) from public.variants v where v.product_id=p.id and v.active),'[]'::jsonb),'product_media',coalesce((select jsonb_agg(to_jsonb(m) order by m.position) from public.product_media m where m.product_id=p.id),'[]'::jsonb)) order by r.units desc,p.id),'[]'::jsonb) from ranked r join public.products p on p.id=r.id;
$$;
grant execute on function public.best_sellers() to anon,authenticated;

-- Moving media must also work before a primary image is selected.
create or replace function public.reorder_media(p_product uuid,p_ids uuid[],p_primary uuid) returns void language plpgsql security definer set search_path=public as $$
declare mid uuid; n integer:=0; begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 perform 1 from public.products where id=p_product for update;
 if (select count(*) from public.product_media where product_id=p_product)<>cardinality(p_ids) or (select count(distinct unnest) from unnest(p_ids))<>cardinality(p_ids) or exists(select 1 from unnest(p_ids) entries(media_id) where not exists(select 1 from public.product_media m where m.id=entries.media_id and m.product_id=p_product)) then raise exception 'Media changed. Refresh and retry'; end if;
 if p_primary is not null and not exists(select 1 from public.product_media where id=p_primary and product_id=p_product and type='image') then raise exception 'Invalid primary image'; end if;
 update public.product_media set is_primary=false where product_id=p_product;
 foreach mid in array p_ids loop
 update public.product_media set position=n,is_primary=coalesce(id=p_primary,false) where id=mid; n=n+1;
 end loop;
end $$;



-- 005_order_webhooks.sql
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

commit;
