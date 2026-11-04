# 마리의 장난감 상자

호두까기 인형과 크리스마스의 동화풍 가챠 수집 사이트입니다. Next.js 15 App Router와 Supabase를 사용합니다.

## 들어 있는 기능

- 기존 gift 사이트와 공통 닉네임(로그인 ID) + 비밀번호 회원가입 / 로그인
- 기존 gift 사이트의 scrypt 계정과 이전 Mari 프로토타입의 bcrypt 계정을 모두 검증 (새 계정은 공통 scrypt 형식 사용)
- 두 사이트 중 어느 쪽에서 가입해도 공통 `event_users`에 저장되어 양쪽 사이트에서 로그인 가능
- 포인트 충전 신청 및 관리자 승인
- 10P → 1T 토큰 교환
- 6개 가챠, 이벤트 시작일 기준 2일 간격 자동 해금
- 1회 / 10회 뽑기, Supabase RPC 안에서 토큰 차감과 확률 추첨을 트랜잭션 처리
- 상품별 등장 확률, 이름, 등급, 설명, 이미지 URL 관리
- 확률 합계가 정확히 100%가 아니면 해당 가챠 뽑기 차단
- 메인 장난감 상자 이미지를 누르면 열리는 도감, 미수집 물품은 물음표 표시
- 아이디/닉네임 변경 시 공통 `event_users`에 반영되고, 회원 프로필 UUID는 유지되어 기존 토큰·포인트·도감 유지
- 관리자 비밀번호 로그인, 상품 관리, 충전 승인/거절
- 데스크톱 / 모바일 반응형 레이아웃

## 1. 공통 Supabase 회원 계정 준비 (중요)

이 사이트는 기존 `크리스마스 선물 만들기 대작전`과 회원 계정을 공유합니다. **새 Supabase 프로젝트를 만들지 말고, 기존 gift 사이트가 사용 중인 바로 그 Supabase 프로젝트**를 사용해야 합니다.

1. 기존 Supabase 프로젝트에서 백업을 먼저 만듭니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행해 마리의 가챠/도감 테이블을 준비합니다.
3. `supabase/check-shared-auth-conflicts.sql`을 실행하고 두 조회 결과가 모두 0행인지 확인합니다. 중복 아이디가 나오면 마이그레이션을 실행하지 마세요.
4. 조회 결과가 비어 있으면 `supabase/shared-auth-migration.sql` 전체를 같은 프로젝트에서 실행합니다. 이 작업은 기존 `event_users` 계정에 안정적인 UUID를 부여하고, 마리 프로필을 연결합니다.
5. 마이그레이션이 성공한 뒤 두 Vercel 프로젝트의 `NEXT_PUBLIC_SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`(또는 `SUPABASE_SERVICE_ROLE_KEY`)가 **동일한 Supabase 프로젝트의 값**인지 확인합니다.
6. **Project Settings → API**에서 아래 값을 확인합니다.
   - Project URL
   - `service_role` 키 (비밀 키입니다. 공개하거나 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다.)

현재 스키마는 Next.js 서버 라우트에서만 service-role 키를 사용합니다. 브라우저에 service-role 키를 보내지 마세요.

### 공통 계정 동작 방식

- `public.event_users`가 유일한 로그인 ID/비밀번호 저장소입니다. 비밀번호 원문은 저장하지 않습니다.
- `public.user_profiles.account_id`가 `event_users.id`를 참조하며, 포인트·토큰·도감은 기존 프로필 UUID에 연결된 채 유지됩니다.
- gift 사이트와 마리 사이트의 세션 쿠키는 도메인이 다르므로 각 사이트에서 한 번씩 로그인해야 합니다. 다만 아이디와 비밀번호는 같습니다.
- 기존 gift 계정의 scrypt 비밀번호 해시는 그대로 유지합니다. 이전 Mari 프로토타입 계정은 bcrypt 해시를 공통 계정 테이블로 복사해 양쪽에서 검증합니다.
- `shared-auth-migration.sql`은 기존 두 사용자 테이블에 같은 아이디가 있으면 임의로 합치지 않고 중단합니다. 이 경우 SQL 오류 메시지를 보내 주면 해당 계정을 안전하게 대조할 수 있습니다.

## 2. 로컬 실행

프로젝트 폴더에서:

```bash
npm install
cp .env.example .env.local
```

`.env.local` 값을 채웁니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVICE_ROLE_KEY  # Gift 사이트와 동일한 비밀 키
SESSION_SECRET=32자_이상의_무작위_긴_문자열을_입력하세요
ADMIN_PASSWORD=관리자용_강력한_암호
EVENT_START_DATE=2026-12-01
```

그 다음 실행합니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 3. Vercel 배포

GitHub에 프로젝트 폴더의 파일을 업로드하고 Vercel에서 해당 저장소를 Import 합니다.

- Framework Preset: Next.js
- Root Directory: `mari-toybox` 폴더를 저장소 최상위에 올렸다면 기본값 `./`
- Build Command: `next build`
- Install Command: `npm install`

Vercel 프로젝트의 **Settings → Environment Variables**에 `.env.local`과 동일한 변수 5개를 등록하고 Production / Preview 환경을 선택한 뒤 Redeploy 합니다.

## 4. 가챠 해금 일정

`EVENT_START_DATE`는 첫 번째 가챠가 열리는 한국 날짜입니다. 기본값은 `2026-12-01`입니다.

| 순서 | 가챠 | 이벤트 시작일 기준 |
|---|---|---:|
| 1 | 크리스마스 선물 | 0일 |
| 2 | 장난감 왕국 | 2일 |
| 3 | 설탕 요정의 과자점 | 4일 |
| 4 | 생쥐 왕국 | 6일 |
| 5 | 따뜻한 겨울 나기 | 8일 |
| 6 | 프로필 테두리 | 10일 |

시작일을 바꿀 때는 Vercel 환경변수의 날짜를 수정하고 다시 배포합니다.

## 5. 관리자 사용 방법

사이트 상단의 톱니바퀴 아이콘을 누르고 `ADMIN_PASSWORD`에 설정한 암호를 입력합니다.

- 상품 등록: 가챠 종류, 상품명, 확률, 등급, 이미지 URL을 입력합니다.
- 확률 수정: 상품 목록에서 이름·이미지 URL·확률을 편집하고 저장합니다.
- 각 가챠의 활성 상품 확률 합계가 100%가 되어야 이용자가 뽑을 수 있습니다.
- 이미지 URL에는 `public`에 넣은 이미지의 경로(`/assets/items/toy.png`) 또는 외부 HTTPS 이미지 URL을 넣을 수 있습니다.
- 충전 신청은 승인 또는 거절할 수 있습니다.

현재 프로젝트에는 기본 상품 데이터를 일부러 넣지 않았습니다. 운영자가 실제 아이템과 확률을 정한 뒤 등록하면 됩니다.

## 중요: 결제와 운영 보안

- **실제 카드/간편결제는 아직 연결되어 있지 않습니다.** 현재 포인트 충전은 신청을 접수하고 관리자가 승인하는 운영 방식입니다. 실제 유료 포인트를 판매하려면 토스페이먼츠·PortOne 등 결제대행사 연동, 결제 검증 웹훅, 환불/분쟁 대응을 추가해야 합니다.
- 관리자 비밀번호와 `SESSION_SECRET`은 충분히 길고 추측하기 어려운 값으로 설정하세요.
- 공개 이벤트를 시작하기 전에는 로그인/회원가입 rate limit, 비밀번호 재설정·계정 복구 정책, 이용약관/개인정보 처리방침, 결제 연동 검증을 추가로 점검하세요.
- 이 구현은 기본 운영 흐름을 갖춘 시작 버전이며, 실제 서비스 오픈 전에는 Supabase 백업·로그·악용 방지 정책을 점검해야 합니다.

## 이미지 에셋

`public/assets/mari-room.png`와 `public/assets/gacha/gacha-1.png` ~ `gacha-6.png`는 동화풍 일러스트에서 오브젝트를 분리해 알파 채널이 있는 PNG로 정리한 파일입니다. 개별 머신 6종은 같은 프레임과 비율로 구성했습니다.
