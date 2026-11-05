
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const name = searchParams.get('name') || 'toy';

    if (!imageUrl) {
      return Response.json({ error: '이미지 주소가 없어요.' }, { status: 400 });
    }

    const url = new URL(imageUrl);

    // Vercel Blob 주소만 허용
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.public.blob.vercel-storage.com')
    ) {
      return Response.json({ error: '허용되지 않은 이미지 주소예요.' }, { status: 400 });
    }

    const response = await fetch(url);

    if (!response.ok) {
      return Response.json({ error: '이미지를 가져오지 못했어요.' }, { status: 404 });
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.startsWith('image/')) {
      return Response.json({ error: '이미지 파일이 아니에요.' }, { status: 400 });
    }

    const safeName = name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'toy';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="toy.png"; filename*=UTF-8''${encodeURIComponent(safeName)}.png`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || '다운로드에 실패했어요.' },
      { status: 500 }
    );
  }
}
