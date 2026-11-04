import { getSupabaseAdmin, requireUser, jsonError } from '@/lib/server';
import { GACHAS } from '@/lib/data';
export async function GET() {
  try {
    const userId = await requireUser();
    const supabase = getSupabaseAdmin();
    const [{ data: profile, error: profileError }, { data: items, error: itemError }] = await Promise.all([
      supabase.from('user_profiles').select('id,nickname,points,tokens').eq('id', userId).single(),
      supabase.from('gacha_items').select('gacha_key').eq('is_active', true),
    ]);
    if (profileError) throw profileError; if (itemError) throw itemError;
    const counts = Object.fromEntries(GACHAS.map(g => [g.key, items.filter(i => i.gacha_key === g.key).length]));
    return Response.json({ user: profile, gachas: GACHAS, counts, eventStartDate: process.env.EVENT_START_DATE || '2026-12-01' });
  } catch (error) { return jsonError(error.message || '정보를 불러오지 못했습니다.', 401); }
}
