export const AGENCY_META = {
  daily: { name: '用户日报', tone: '' },
  midnight: { name: '深夜头条', tone: 'red' },
  biography: { name: '未来传记社', tone: 'sepia' },
};

export const COLUMN_ORDER = ['快讯', '深度', '专栏', '传记', '专访', '档案', '更正'];

export function agencyName(id) {
  return AGENCY_META[id]?.name || id;
}

export function agencyTone(id) {
  return AGENCY_META[id]?.tone || '';
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`;
}

export function excerpt(text, n = 72) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}……` : t;
}
