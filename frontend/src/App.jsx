import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useCol, canJoin, Toaster, Avatar, Icon } from './lib.jsx';
import { Intro, Login } from './pages/Landing.jsx';
import Home from './pages/Home.jsx';
import Points from './pages/Points.jsx';
import Shop from './pages/Shop.jsx';
import Projects from './pages/Projects.jsx';
import { Meetings, RoomView } from './pages/Meet.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const [user, setUser] = useState(undefined), [prof, setProf] = useState(null), [view, setView] = useState('intro');
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); if (!u) { setProf(null); setView('intro'); } }), []);
  useEffect(() => user ? onSnapshot(doc(db, 'users', user.uid), s => setProf(s.exists() ? s.data() : null)) : undefined, [user]);
  let body;
  if (user === undefined || (user && !prof)) body = <div className="boot">불러오는 중…</div>;
  else if (!user) body = view === 'intro' ? <Intro go={setView} /> : <Login mode={view} go={setView} />;
  else body = <Shell user={user} prof={prof} />;
  return <>{body}<Toaster /></>;
}

const NAV = [['home', '홈'], ['points', '포인트'], ['shop', '상점'], ['projects', '프로젝트'], ['meet', '회의'], ['settings', '설정']];
function Shell({ user, prof }) {
  const cid = prof.activeCompanyId, uid = user.uid;
  const [page, setPage] = useState('home'), [room, setRoom] = useState(null);
  const [me, setMe] = useState(null), [co, setCo] = useState(null), [w, setW] = useState({});
  useEffect(() => {
    setMe(null); setRoom(null);
    const u = [onSnapshot(doc(db, `companies/${cid}/members/${uid}`), s => setMe(s.data())), onSnapshot(doc(db, 'companies', cid), s => setCo(s.data())),
      onSnapshot(doc(db, `companies/${cid}/wallets/${uid}`), s => setW(s.data() || {}))];
    return () => u.forEach(f => f());
  }, [cid, uid]);
  const members = useCol(`companies/${cid}/members`), teams = useCol(`companies/${cid}/teams`), meetings = useCol(`companies/${cid}/meetings`);
  if (!me || !co) return <div className="boot">불러오는 중…</div>;
  const mine = { ...me, points: w.points ?? 0, streak: w.streak ?? 0, lastCheckin: w.lastCheckin || '' };
  const X = { cid, uid, me: mine, co, members, teams, meetings, prof, go: setPage, join: id => { setRoom(id); setPage('meet'); } };
  const live = meetings.filter(m => canJoin(m, me)).length;
  return <div className="shell">
    <aside><b className="logo">마루</b><small className="co">{co.name}</small>
      <nav aria-label="메인 메뉴">{NAV.map(([k, l]) => <button key={k} className={page === k ? 'on' : ''} onClick={() => setPage(k)}><Icon n={k} /><span>{l}</span>{k === 'meet' && live > 0 && <i className="badge">{live}</i>}</button>)}</nav>
      <div className="who"><Avatar m={me} size={34} /><div><b>{me.name}</b><span>{me.role === 'owner' ? '사장' : me.leader ? '팀장' : '직원'}</span></div></div></aside>
    <main>
      {page === 'home' && <Home {...X} />}{page === 'points' && <Points {...X} />}{page === 'shop' && <Shop {...X} />}
      {page === 'projects' && <Projects {...X} />}{page === 'settings' && <Settings {...X} />}
      {page === 'meet' && !room && <Meetings {...X} />}
      {room && <div className={page === 'meet' ? '' : 'hide'}><RoomView key={room} {...X} mid={room} onLeave={() => setRoom(null)} /></div>}
      {room && page !== 'meet' && <button className="pill" onClick={() => setPage('meet')}>🎙 회의 중 · 돌아가기</button>}
    </main></div>;
}
