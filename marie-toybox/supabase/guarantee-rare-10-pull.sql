-- 10연차에서 레어/에픽/시크릿 중 최소 1개 보장
-- 레어 이상 활성 상품이 없으면 토큰 차감 전에 요청을 중단합니다.

create or replace function public.draw_toys(
  p_user_id uuid,
  p_gacha_key text,
  p_count integer,
  p_event_start_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlock_day integer;
  v_elapsed integer;
  v_profile public.user_profiles%rowtype;
  v_total numeric;
  v_roll numeric;
  v_item_id uuid;
  v_item jsonb;
  v_results jsonb := '[]'::jsonb;
  v_picked_ids uuid[] := array[]::uuid[];
  v_i integer;
  v_has_high_rarity boolean := false;
  v_high_total numeric;
begin
  if p_count not in (1, 10) then raise exception '1회 또는 10회 뽑기만 가능합니다.'; end if;
  v_unlock_day := case p_gacha_key
    when 'christmas-gift' then 0 when 'toy-kingdom' then 2 when 'sugar-shop' then 4
    when 'mouse-kingdom' then 6 when 'winter-warmth' then 8 when 'profile-frame' then 10
    else null end;
  if v_unlock_day is null then raise exception '존재하지 않는 가챠입니다.'; end if;
  v_elapsed := (timezone('Asia/Seoul', now())::date - p_event_start_date);
  if v_elapsed < v_unlock_day then raise exception '아직 해금되지 않은 가챠입니다.'; end if;

  select * into v_profile from public.user_profiles where id = p_user_id for update;
  if not found then raise exception '회원 정보를 찾을 수 없습니다.'; end if;
  if v_profile.tokens < p_count then raise exception '토큰이 부족합니다.'; end if;

  select coalesce(sum(probability),0) into v_total
    from public.gacha_items where gacha_key = p_gacha_key and is_active = true;
  if abs(v_total - 100) > 0.01 then
    raise exception '관리자 설정 확률 합계는 100%%여야 합니다. 현재 합계: %', v_total;
  end if;
  if not exists (select 1 from public.gacha_items where gacha_key = p_gacha_key and is_active = true and probability > 0) then
    raise exception '등록된 상품이 없습니다.';
  end if;

  if p_count = 10 then
    select coalesce(sum(probability), 0) into v_high_total
      from public.gacha_items
      where gacha_key = p_gacha_key and is_active = true
        and probability > 0 and rarity in ('레어', '에픽', '시크릿');
    if v_high_total <= 0 then
      raise exception '레어 이상 상품이 등록되어 있지 않아 10연차를 진행할 수 없습니다.';
    end if;
  end if;

  update public.user_profiles set tokens = tokens - p_count where id = p_user_id returning * into v_profile;

  for v_i in 1..p_count loop
    v_roll := random() * 100;
    select picked.id into v_item_id
    from (
      select id, sum(probability) over (order by sort_order, created_at, id) as cumulative_probability
      from public.gacha_items
      where gacha_key = p_gacha_key and is_active = true and probability > 0
    ) as picked
    where picked.cumulative_probability >= v_roll
    order by picked.cumulative_probability
    limit 1;

    if v_item_id is null then
      select id into v_item_id from public.gacha_items
       where gacha_key = p_gacha_key and is_active = true and probability > 0
       order by sort_order desc, created_at desc limit 1;
    end if;

    v_picked_ids := array_append(v_picked_ids, v_item_id);
    v_item_id := null;
  end loop;

  if p_count = 10 then
    select exists (
      select 1 from unnest(v_picked_ids) as picked(picked_id)
      join public.gacha_items i on i.id = picked.picked_id
      where i.rarity in ('레어', '에픽', '시크릿')
    ) into v_has_high_rarity;

    if not v_has_high_rarity then
      v_roll := random() * v_high_total;
      select picked.id into v_item_id
      from (
        select id, sum(probability) over (order by sort_order, created_at, id) as cumulative_probability
        from public.gacha_items
        where gacha_key = p_gacha_key and is_active = true
          and probability > 0 and rarity in ('레어', '에픽', '시크릿')
      ) as picked
      where picked.cumulative_probability >= v_roll
      order by picked.cumulative_probability
      limit 1;

      if v_item_id is null then
        select id into v_item_id from public.gacha_items
        where gacha_key = p_gacha_key and is_active = true
          and probability > 0 and rarity in ('레어', '에픽', '시크릿')
        order by sort_order desc, created_at desc limit 1;
      end if;

      v_picked_ids[10] := v_item_id;
    end if;
  end if;

  for v_i in 1..p_count loop
    v_item_id := v_picked_ids[v_i];
    insert into public.user_collections(user_id, item_id, quantity)
    values (p_user_id, v_item_id, 1)
    on conflict (user_id, item_id) do update set quantity = public.user_collections.quantity + 1;
    insert into public.gacha_draws(user_id, gacha_key, item_id) values (p_user_id, p_gacha_key, v_item_id);
    select to_jsonb(i) into v_item from public.gacha_items i where i.id = v_item_id;
    v_results := v_results || jsonb_build_array(v_item);
  end loop;

  return jsonb_build_object('items', v_results, 'points', v_profile.points, 'tokens', v_profile.tokens);
end;
$$;

revoke all on function public.draw_toys(uuid, text, integer, date) from public, anon, authenticated;
grant execute on function public.draw_toys(uuid, text, integer, date) to service_role;
