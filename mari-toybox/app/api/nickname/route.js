import { getSupabaseAdmin, requireUser, jsonError } from '@/lib/server';

export async function PATCH(request) {
  try {
    const profileId = await requireUser();
    const supabase = getSupabaseAdmin();
    const { nickname } = await request.json();
    const name = String(nickname || '').trim();
    if (!name || name.length > 20 || !/^[a-zA-Z0-9가-힣_-]+$/.test(name)) {
      return jsonError('아이디는 한글, 영문, 숫자, _ 또는 -로 1~20자 입력해 주세요.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles').select('id,account_id,nickname,points,tokens')
      .eq('id', profileId).single();
    if (profileError || !profile?.account_id) return jsonError('공통 계정 연결을 찾을 수 없습니다. 데이터베이스 이전을 확인해 주세요.', 409);
    if (name === profile.nickname) return jsonError('현재 아이디와 같습니다.');

    const { data: duplicate, error: duplicateError } = await supabase
      .from('event_users').select('id').eq('nickname_normalized', name.toLocaleLowerCase()).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate && duplicate.id !== profile.account_id) return jsonError('이미 사용 중인 아이디입니다.', 409);

    const { data: stateRow, error: stateError } = await supabase
      .from('event_state').select('state').eq('id', 1).maybeSingle();
    if (stateError) throw stateError;

    let ranks = null;
    if (stateRow?.state) {
      ranks = {
        human: [...(stateRow.state.ranks?.human || [])],
        soldier: [...(stateRow.state.ranks?.soldier || [])],
        mouse: [...(stateRow.state.ranks?.mouse || [])],
      };
      for (const team of Object.keys(ranks)) {
        ranks[team] = ranks[team].map(item => item.name === profile.nickname ? { ...item, name } : item);
      }
    }

    const { error: updateAccountError } = await supabase
      .from('event_users').update({ nickname: name }).eq('id', profile.account_id);
    if (updateAccountError) {
      if (updateAccountError.code === '23505') return jsonError('이미 사용 중인 아이디입니다.', 409);
      throw updateAccountError;
    }

    const { data: updatedLogs, error: logsError } = await supabase
      .from('event_action_logs').update({ nickname: name }).eq('nickname', profile.nickname).select('id');
    if (logsError) {
      await supabase.from('event_users').update({ nickname: profile.nickname }).eq('id', profile.account_id);
      throw logsError;
    }

    if (stateRow?.state) {
      const { error: stateSaveError } = await supabase
        .from('event_state').update({ state: { ...stateRow.state, ranks } }).eq('id', 1);
      if (stateSaveError) {
        const ids = (updatedLogs || []).map(row => row.id);
        if (ids.length) await supabase.from('event_action_logs').update({ nickname: profile.nickname }).in('id', ids);
        await supabase.from('event_users').update({ nickname: profile.nickname }).eq('id', profile.account_id);
        throw stateSaveError;
      }
    }

    const { data: updatedProfile, error: reloadError } = await supabase
      .from('user_profiles').select('id,nickname,points,tokens').eq('id', profileId).single();
    if (reloadError) throw reloadError;
    return Response.json({ user: updatedProfile });
  } catch (error) {
    console.error('Shared nickname update failed:', error);
    return jsonError(error.message || '아이디 변경에 실패했습니다.');
  }
}
