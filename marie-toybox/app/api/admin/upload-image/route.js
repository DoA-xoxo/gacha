
import { put } from '@vercel/blob';
import { requireAdmin, jsonError } from '@/lib/server';

export async function POST(request) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return jsonError('PNG 파일을 선택해 주세요.');
    }

    if (file.type !== 'image/png') {
      return jsonError('PNG 파일만 업로드할 수 있어요.');
    }

    if (file.size > 4 * 1024 * 1024) {
      return jsonError('이미지는 4MB 이하로 업로드해 주세요.');
    }

    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .slice(-80) || 'toy.png';

    const blob = await put(
      `gacha-items/${Date.now()}-${safeName}`,
      file,
      {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'image/png',
      }
    );

    return Response.json({ url: blob.url });
  } catch (error) {
    return jsonError(error.message || '이미지 업로드에 실패했어요.');
  }
}
