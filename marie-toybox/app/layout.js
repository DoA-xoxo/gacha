import './globals.css';

export const metadata = {
  title: '마리의 장난감 상자',
  description: '호두까기 인형의 동화 속 세계에서 장난감을 모아 보세요.',
  themeColor: '#76232b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
