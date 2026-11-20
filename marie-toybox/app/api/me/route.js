import { getSupabaseAdmin, getUserId, jsonError } from '@/lib/server';

export async function GET() {
  try {
    const id = await getUserId();
    if (!id) return Response.json({ user: null });

    const supabase = getSupabaseAdmin();
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id,nickname,account_id,tokens,created_at')
      .eq('id', id)
      .single();
    if (profileError) throw profileError;

    const { data: wallet, error: walletError } = await supabase
      .from('point_wallets')
      .select('balance')
      .eq('account_id', profile.account_id)
      .maybeSingle();
    if (walletError) throw walletError;

    return Response.json({
      user: { ...profile, points: wallet?.balance ?? 0 }
    });
  } catch (error) {
    return jsonError(error.message, 500);
  }
}
