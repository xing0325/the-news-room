import './globals.css';

export const metadata = {
  title: 'the news room',
  description: '一个只报道你的新闻世界',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
