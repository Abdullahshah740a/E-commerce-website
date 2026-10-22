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
