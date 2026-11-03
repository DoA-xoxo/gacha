import { getSupabaseAdmin, requireUser, jsonError } from '@/lib/server';
export async function POST(request) {
  try {
    const userId = await requireUser();
    const { gachaKey, count } = await request.json();
    const startDate = process.env.EVENT_START_DATE || '2026-12-01';
    const { data, error } = await getSupabaseAdmin().rpc('draw_toys', {
      p_user_id: userId, p_gacha_key: String(gachaKey), p_count: Number(count), p_event_start_date: startDate,
    });
    if (error) throw error;
    return Response.json(data);
  } catch (error) { return jsonError(error.message || '뽑기에 실패했습니다.'); }
}
