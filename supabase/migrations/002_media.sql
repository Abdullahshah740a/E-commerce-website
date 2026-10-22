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
