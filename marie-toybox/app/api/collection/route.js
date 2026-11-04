import { getSupabaseAdmin, requireUser, jsonError } from '@/lib/server';
import { GACHAS } from '@/lib/data';
export async function GET() {
  try {
    const userId = await requireUser();
    const supabase = getSupabaseAdmin();
    const [{ data: items, error: itemError }, { data: owned, error: ownedError }] = await Promise.all([
      supabase.from('gacha_items').select('id,gacha_key,name,description,image_url,rarity,sort_order').eq('is_active', true).order('sort_order').order('created_at'),
      supabase.from('user_collections').select('item_id,quantity,first_obtained_at').eq('user_id', userId),
    ]);
    if (itemError) throw itemError; if (ownedError) throw ownedError;
    const ownedMap = new Map(owned.map(row => [row.item_id, row]));
    const result = items.map(item => ({ ...item, collection: ownedMap.get(item.id) || null }));
    return Response.json({ items: result, gachas: GACHAS, collected: result.filter(i => i.collection).length, total: result.length });
  } catch (error) { return jsonError(error.message || '도감을 불러오지 못했습니다.'); }
}
