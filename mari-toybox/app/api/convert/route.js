import { getSupabaseAdmin, requireUser, jsonError } from '@/lib/server';
export async function POST(request) {
  try {
    const userId = await requireUser();
    const { points } = await request.json();
    const amount = Number(points);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount % 10 !== 0) return jsonError('10포인트 단위로 입력해 주세요.');
    const { data, error } = await getSupabaseAdmin().rpc('convert_points_to_tokens', { p_user_id: userId, p_points: amount });
    if (error) throw error;
    return Response.json(data);
  } catch (error) { return jsonError(error.message || '교환에 실패했습니다.'); }
}
