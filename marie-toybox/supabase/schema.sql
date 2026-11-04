-- 마리의 장난감 상자: Supabase SQL Editor에서 전체 실행
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  nickname_normalized text generated always as (lower(nickname)) stored,
  password_hash text, -- Legacy field; passwords now live only in public.event_users
  points bigint not null default 0 check (points >= 0),
  tokens bigint not null default 0 check (tokens >= 0),
  created_at timestamptz not null default now()
);
create unique index if not exists user_profiles_nickname_normalized_uidx on public.user_profiles (nickname_normalized);

create table if not exists public.gacha_items (
  id uuid primary key default gen_random_uuid(),
  gacha_key text not null check (gacha_key in ('christmas-gift','toy-kingdom','sugar-shop','mouse-kingdom','winter-warmth','profile-frame')),
  name text not null,
  description text not null default '',
  image_url text not null default '',
  probability numeric(6,3) not null default 0 check (probability >= 0 and probability <= 100),
  rarity text not null default '일반',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists gacha_items_key_active_order_idx on public.gacha_items (gacha_key, is_active, sort_order);

create table if not exists public.user_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  item_id uuid not null references public.gacha_items(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  first_obtained_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists user_collections_user_idx on public.user_collections (user_id);

create table if not exists public.gacha_draws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  gacha_key text not null,
  item_id uuid not null references public.gacha_items(id),
  created_at timestamptz not null default now()
);

create index if not exists gacha_draws_user_created_idx on public.gacha_draws (user_id, created_at desc);

create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  amount_points bigint not null check (amount_points > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists topup_requests_status_created_idx on public.topup_requests (status, created_at desc);

-- Custom nickname/password sessions are verified by Next.js server routes.
-- All tables are accessed with the server-only service role key; do not expose it in the browser.
alter table public.user_profiles enable row level security;
alter table public.gacha_items enable row level security;
alter table public.user_collections enable row level security;
alter table public.gacha_draws enable row level security;
alter table public.topup_requests enable row level security;

create or replace function public.convert_points_to_tokens(p_user_id uuid, p_points bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_profile public.user_profiles%rowtype;
begin
  if p_points is null or p_points <= 0 or mod(p_points, 10) <> 0 then
    raise exception '포인트는 10P 단위로 교환할 수 있습니다.';
  end if;
  update public.user_profiles
     set points = points - p_points,
         tokens = tokens + (p_points / 10)
   where id = p_user_id and points >= p_points
   returning * into v_profile;
  if not found then raise exception '보유 포인트가 부족합니다.'; end if;
  return jsonb_build_object('points', v_profile.points, 'tokens', v_profile.tokens);
end;
$$;

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
  v_cursor numeric;
  v_item_id uuid;
  v_item jsonb;
  v_results jsonb := '[]'::jsonb;
  v_i integer;
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

  update public.user_profiles set tokens = tokens - p_count where id = p_user_id returning * into v_profile;
  for v_i in 1..p_count loop
    v_roll := random() * 100;
    v_cursor := 0;
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

    insert into public.user_collections(user_id, item_id, quantity)
    values (p_user_id, v_item_id, 1)
    on conflict (user_id, item_id) do update set quantity = public.user_collections.quantity + 1;
    insert into public.gacha_draws(user_id, gacha_key, item_id) values (p_user_id, p_gacha_key, v_item_id);
    select to_jsonb(i) into v_item from public.gacha_items i where i.id = v_item_id;
    v_results := v_results || jsonb_build_array(v_item);
    v_item_id := null;
  end loop;
  return jsonb_build_object('items', v_results, 'points', v_profile.points, 'tokens', v_profile.tokens);
end;
$$;

create or replace function public.approve_topup_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_request public.topup_requests%rowtype; v_profile public.user_profiles%rowtype;
begin
  select * into v_request from public.topup_requests where id = p_request_id for update;
  if not found then raise exception '충전 신청을 찾을 수 없습니다.'; end if;
  if v_request.status <> 'pending' then raise exception '이미 처리된 충전 신청입니다.'; end if;
  update public.user_profiles set points = points + v_request.amount_points
   where id = v_request.user_id returning * into v_profile;
  update public.topup_requests set status = 'approved', reviewed_at = now() where id = p_request_id;
  return jsonb_build_object('user_id', v_profile.id, 'points', v_profile.points);
end;
$$;

-- RPC functions are called only from trusted Next.js route handlers using service role.
revoke all on function public.convert_points_to_tokens(uuid, bigint) from public, anon, authenticated;
revoke all on function public.draw_toys(uuid, text, integer, date) from public, anon, authenticated;
revoke all on function public.approve_topup_request(uuid) from public, anon, authenticated;
grant execute on function public.convert_points_to_tokens(uuid, bigint) to service_role;
grant execute on function public.draw_toys(uuid, text, integer, date) to service_role;
grant execute on function public.approve_topup_request(uuid) to service_role;

-- Ensure the backend service role can perform the server-side queries above.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.user_profiles to service_role;
grant select, insert, update, delete on public.gacha_items to service_role;
grant select, insert, update, delete on public.user_collections to service_role;
grant select, insert, update, delete on public.gacha_draws to service_role;
grant select, insert, update, delete on public.topup_requests to service_role;
