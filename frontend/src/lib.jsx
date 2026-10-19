import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const useCol = path => {
  const [a, setA] = useState([]);
  useEffect(() => { setA([]); return path ? onSnapshot(collection(db, path), s => setA(s.docs.map(d => ({ id: d.id, ...d.data() })))) : undefined; }, [path]);
  return a;
};
export const byNew = (a, b) => (b.at?.seconds ?? b.createdAt?.seconds ?? 1e12) - (a.at?.seconds ?? a.createdAt?.seconds ?? 1e12);
export const canJoin = (m, me) => m.active && (me.role === 'owner' || m.type === 'all' || m.teamId === me.teamId);
export const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export const fmtT = ts => ts?.toDate ? ts.toDate().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
export const linkify = t => t.split(/(https?:\/\/[^\s]+)/g).map((p, i) => i % 2 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a> : p);

const L = new Set();
export const toast = (msg, type = 'ok') => L.forEach(f => f({ msg, type }));
export const run = async (fn, ok) => { try { const r = await fn(); if (typeof ok === 'string') toast(ok); else ok?.(r); } catch (e) { toast(e.message, 'err'); } };
export function Toaster() {
  const [a, setA] = useState([]);
  useEffect(() => { const f = t => { setA(x => [...x, t]); setTimeout(() => setA(x => x.filter(y => y !== t)), 3500); }; L.add(f); return () => L.delete(f); }, []);
  return <div className="toasts" role="status" aria-live="polite">{a.map((t, i) => <div key={i} className={'toast ' + t.type}>{t.msg}</div>)}</div>;
}

export const COLORS = ['#5b3df5', '#1fa971', '#f2a900', '#e0528a', '#2b8cf0', '#8a5cf5'];
export const colorOf = m => m?.color || COLORS[[...(m?.name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
export const Avatar = ({ m, size = 36 }) => <span className="av" style={{ width: size, height: size, background: colorOf(m), fontSize: size * 0.42 }}>{(m?.name || '?')[0]}</span>;

const P = { home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', points: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4', shop: 'M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0', projects: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', meet: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3', settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4' };
export const Icon = ({ n }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n]} /></svg>;
