import { getSupabaseAdmin, requireAdmin, jsonError } from '@/lib/server';
const allowed = new Set(['christmas-gift','toy-kingdom','sugar-shop','mouse-kingdom','winter-warmth','profile-frame']);
function validate(body) {
  const gacha_key = String(body.gacha_key || '');
  const name = String(body.name || '').trim();
  const probability = Number(body.probability);
  if (!allowed.has(gacha_key)) throw new Error('올바른 가챠 종류를 선택해 주세요.');
  if (!name || name.length > 60) throw new Error('상품명은 1~60자로 입력해 주세요.');
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) throw new Error('확률은 0~100 사이로 입력해 주세요.');
  return {
    gacha_key, name, description: String(body.description || '').slice(0, 300),
    image_url: String(body.image_url || '').trim(), probability,
    rarity: String(body.rarity || '일반').slice(0, 20), sort_order: Number(body.sort_order || 0),
    is_active: body.is_active !== false,
  };
}
export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await getSupabaseAdmin().from('gacha_items').select('*').order('gacha_key').order('sort_order').order('created_at');
    if (error) throw error;
    return Response.json({ items: data });
  } catch (error) { return jsonError(error.message, 401); }
}
export async function POST(request) {
  try {
    await requireAdmin();
    const payload = validate(await request.json());
    const { data, error } = await getSupabaseAdmin().from('gacha_items').insert(payload).select('*').single();
    if (error) throw error;
    return Response.json({ item: data });
  } catch (error) { return jsonError(error.message); }
}
export async function PATCH(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    if (!body.id) return jsonError('상품 ID가 필요합니다.');
    const payload = validate(body);
    const { data, error } = await getSupabaseAdmin().from('gacha_items').update(payload).eq('id', body.id).select('*').single();
    if (error) throw error;
    return Response.json({ item: data });
  } catch (error) { return jsonError(error.message); }
}
export async function DELETE(request) {
  try {
    await requireAdmin();

    const { id } = await request.json();

    if (!id) return jsonError('상품 ID가 필요합니다.');

    const supabase = getSupabaseAdmin();

    // 1. 해당 상품의 기존 뽑기 기록 삭제
    const { error: drawsError } = await supabase
      .from('gacha_draws')
      .delete()
      .eq('item_id', id);

    if (drawsError) throw drawsError;

    // 2. 상품 삭제 (도감 기록은 CASCADE로 자동 삭제)
    const { error: itemError } = await supabase
      .from('gacha_items')
      .delete()
      .eq('id', id);

    if (itemError) throw itemError;

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error.message);
  }
}
