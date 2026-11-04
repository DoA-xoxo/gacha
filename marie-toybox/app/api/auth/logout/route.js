import { clearUserSession } from '@/lib/server';
export async function POST() { await clearUserSession(); return Response.json({ ok: true }); }
