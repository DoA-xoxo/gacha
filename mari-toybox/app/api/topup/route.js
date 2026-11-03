import { getSupabaseAdmin, requireUser, jsonError } from '@/lib/server';
export async function POST(request) {
  try {
    const userId = await requireUser();
    const { points } = await request.json();
    const amount = Number(points);
    if (!Number.isSafeInteger(amount) || amount < 10 || amount > 10000000) return jsonError('충전 신청 포인트는 10P~10,000,000P 사이로 입력해 주세요.');
    const { data, error } = await getSupabaseAdmin().from('topup_requests').insert({ user_id: userId, amount_points: amount }).select('id,amount_points,status,created_at').single();
    if (error) throw error;
    return Response.json({ request: data, message: '충전 신청이 접수되었습니다. 관리자 승인 후 포인트가 반영됩니다.' });
  } catch (error) { return jsonError(error.message || '충전 신청에 실패했습니다.'); }
}
