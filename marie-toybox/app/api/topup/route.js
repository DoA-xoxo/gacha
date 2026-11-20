import { jsonError } from '@/lib/server';

export async function POST() {
  return jsonError('포인트 충전 신청은 종료되었습니다. 공통 관리자에게 문의해 주세요.', 410);
}
