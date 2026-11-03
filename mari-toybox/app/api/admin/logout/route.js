import { clearAdminSession } from '@/lib/server';
export async function POST() { await clearAdminSession(); return Response.json({ ok: true }); }
