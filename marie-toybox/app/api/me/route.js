import { getSupabaseAdmin, getUserId, jsonError } from '@/lib/server';
export async function GET() {
  try {
    const id = await getUserId();
    if (!id) return Response.json({ user: null });
    const { data, error } = await getSupabaseAdmin().from('user_profiles').select('id,nickname,points,tokens,created_at').eq('id', id).single();
    if (error) throw error;
    return Response.json({ user: data });
  } catch (error) { return jsonError(error.message, 500); }
}
