import { getSupabaseAdmin, createUserSession, jsonError } from '@/lib/server';
import { verifySharedPassword } from '@/lib/shared-password';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { nickname, password } = await request.json();
    const name = String(nickname || '').trim();
    if (!name || typeof password !== 'string' || password.length > 128) {
      return jsonError('아이디와 비밀번호를 입력해 주세요.');
    }

    const supabase = getSupabaseAdmin();
    const { data: account, error: accountError } = await supabase
      .from('event_users')
      .select('id,nickname,password_hash')
      .eq('nickname_normalized', name.toLocaleLowerCase())
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account || !(await verifySharedPassword(password, account.password_hash))) {
      return jsonError('아이디 또는 비밀번호가 올바르지 않습니다.', 401);
    }

    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id,nickname,points,tokens')
      .eq('account_id', account.id)
      .maybeSingle();
    if (profileError) throw profileError;

    if (!profile) {
      const inserted = await supabase.from('user_profiles')
        .insert({ account_id: account.id, nickname: account.nickname })
        .select('id,nickname,points,tokens').single();
      profile = inserted.data;
      if (inserted.error) throw inserted.error;
    }

    await createUserSession(profile);
    return Response.json({ user: profile });
  } catch (error) {
    console.error('Mari login failed:', error);
    return jsonError(error.message || '로그인에 실패했습니다.', 500);
  }
}
