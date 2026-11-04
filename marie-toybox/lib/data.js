export const GACHAS = [
  { key: 'christmas-gift', name: '크리스마스 선물', subtitle: '마리에게 도착한 작은 선물들', day: 0, color: 'red', asset: '/assets/gacha/gacha-1.png' },
  { key: 'toy-kingdom', name: '장난감 왕국', subtitle: '용감한 병정과 장난감 친구들', day: 2, color: 'blue', asset: '/assets/gacha/gacha-2.png' },
  { key: 'sugar-shop', name: '설탕 요정의 과자점', subtitle: '달콤한 과자와 사탕의 세계', day: 4, color: 'pink', asset: '/assets/gacha/gacha-3.png' },
  { key: 'mouse-kingdom', name: '생쥐 왕국', subtitle: '작고 용감한 생쥐들의 보물', day: 6, color: 'green', asset: '/assets/gacha/gacha-4.png' },
  { key: 'winter-warmth', name: '마리의 방', subtitle: '포근한 겨울을 위한 소품들', day: 8, color: 'ivory', asset: '/assets/gacha/gacha-5.png' },
  { key: 'profile-frame', name: '프로필 테두리', subtitle: '나만의 프로필을 장식하는 액자', day: 10, color: 'purple', asset: '/assets/gacha/gacha-6.png' },
];

export function getUnlockDate(startDate, dayOffset) {
  const date = new Date(`${startDate}T00:00:00+09:00`);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

export function isGachaUnlocked(startDate, dayOffset) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const unlock = getUnlockDate(startDate, dayOffset);
  return today >= unlock;
}
