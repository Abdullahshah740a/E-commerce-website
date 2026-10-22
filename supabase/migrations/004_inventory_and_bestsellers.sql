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

