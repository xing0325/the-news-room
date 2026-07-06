'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { fmtDate } from '../lib/world';

const NAV = [
  { href: '/', label: '当期' },
  { href: '/archive/', label: '往期' },
  { href: '/desk/', label: '输入台' },
  { href: '/newsroom/', label: '编辑部' },
];

export default function Masthead({ edition }) {
  const path = usePathname();
  return (
    <header className="masthead">
      <div className="ears">
        <span>{edition ? `第 ${edition.no} 期 · ${edition.label}` : 'daily bulletin'}</span>
        <span>印数：1 份</span>
      </div>
      <h1><Link href="/">the news room</Link></h1>
      <div className="motto">一个只报道你的世界</div>
      <div className="rule-double" />
      <div className="dateline">
        <span>{edition ? fmtDate(edition.published_at) : fmtDate(new Date().toISOString())}</span>
        <span><b>本报只对一位读者发行</b></span>
      </div>
      <div className="rule" />
      <nav className="nav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? 'on' : ''}>{n.label}</Link>
        ))}
      </nav>
      <div className="rule-heavy" />
    </header>
  );
}
