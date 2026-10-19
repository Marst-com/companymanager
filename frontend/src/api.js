import { auth } from './firebase';
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').trim().replace(/\/+$/, ''); // 끝의 / 자동 제거
export const staffEmail = (code, un) => `${un.trim()}.${code.trim()}@staff.maru.app`.toLowerCase();
export async function api(path, method = 'POST', body) {
  const token = await auth.currentUser.getIdToken();
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || '요청에 실패했어요');
  return j;
}
