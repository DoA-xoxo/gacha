import { getSupabaseAdmin, requireAdmin, jsonError } from '@/lib/server';
export async function GET() {
  try {
    await requireAdmin();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('topup_requests').select('id,user_id,amount_points,status,created_at,reviewed_at').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    const ids = [...new Set(data.map(row => row.user_id))];
    const { data: profiles, error: profileError } = ids.length ? await supabase.from('user_profiles').select('id,nickname').in('id', ids) : { data: [], error: null };
    if (profileError) throw profileError;
    const names = new Map(profiles.map(p => [p.id, p.nickname]));
    return Response.json({ requests: data.map(row => ({ ...row, nickname: names.get(row.user_id) || '알 수 없음' })) });
  } catch (error) { return jsonError(error.message, 401); }
}
export async function PATCH(request) {
  try {
    await requireAdmin();
    const { id, status } = await request.json();
    if (!id || !['approved','rejected'].includes(status)) return jsonError('처리할 충전 신청을 확인해 주세요.');
    const supabase = getSupabaseAdmin();
    if (status === 'approved') {
      const { data, error } = await supabase.rpc('approve_topup_request', { p_request_id: id });
      if (error) throw error;
      return Response.json({ ok: true, result: data });
    }
    const { data, error } = await supabase.from('topup_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending').select('id').single();
    if (error) throw error;
    return Response.json({ ok: true, result: data });
  } catch (error) { return jsonError(error.message); }
}
