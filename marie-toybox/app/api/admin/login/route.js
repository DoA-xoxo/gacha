import { createAdminSession, safeEqual, jsonError } from '@/lib/server';
export async function POST(request) {
  try {
    const { password } = await request.json();
    if (!process.env.ADMIN_PASSWORD) return jsonError('ADMIN_PASSWORD 환경변수를 설정해 주세요.', 500);
    if (!safeEqual(password, process.env.ADMIN_PASSWORD)) return jsonError('관리자 암호가 올바르지 않습니다.', 401);
    await createAdminSession();
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error.message || '관리자 로그인에 실패했습니다.', 500); }
}
