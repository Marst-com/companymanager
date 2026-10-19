import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { api } from '../api';
import { COLORS, colorOf, Avatar, run, toast } from '../lib.jsx';

export default function Settings({ cid, me, co, prof }) {
  const [name, setName] = useState(me.name), [color, setColor] = useState(colorOf(me)), [cn, setCn] = useState(''), [cname, setCname] = useState(co.name), [pts, setPts] = useState(co.checkinPoints ?? 10), [cos, setCos] = useState([]);
  const ids = (prof.companyIds || []).join(','), owner = me.role === 'owner';
  useEffect(() => { const m = {}; const us = ids.split(',').filter(Boolean).map(id => onSnapshot(doc(db, 'companies', id), d => { m[id] = { id, ...d.data() }; setCos(Object.values(m)); })); return () => us.forEach(f => f()); }, [ids]);
  useEffect(() => { setCname(co.name); setPts(co.checkinPoints ?? 10); }, [cid]);
  return <><h2>설정</h2>
    <h3>내 프로필</h3><form className="card" onSubmit={e => { e.preventDefault(); run(() => api('/api/settings/profile', 'POST', { name, color }), '저장했어요'); }}>
      <div className="inl"><Avatar m={{ name, color }} size={48} /><input value={name} onChange={e => setName(e.target.value)} required maxLength={30} /></div>
      <div className="chips">{COLORS.map(c => <label key={c} className={color === c ? 'on' : ''} style={{ background: c, borderColor: c }}><input type="radio" name="color" checked={color === c} onChange={() => setColor(c)} aria-label={'색상 ' + c} /><span className="sw" /></label>)}</div><button className="btn">저장</button></form>
    {owner && <><h3>회사</h3><div className="card"><p>회사 코드 <b className="code">{cid}</b> <button className="link" onClick={() => navigator.clipboard?.writeText(cid).then(() => toast('복사했어요'))}>복사</button><br /><small>직원이 로그인할 때 필요해요</small></p>
      <form className="inl wrap" onSubmit={e => { e.preventDefault(); run(() => api('/api/settings/company', 'POST', { companyId: cid, name: cname, checkinPoints: +pts }), '저장했어요'); }}>
        <input value={cname} onChange={e => setCname(e.target.value)} required maxLength={40} /><label className="lbl">출석 포인트 <input className="num" type="number" min="0" max="1000" value={pts} onChange={e => setPts(e.target.value)} /></label><button className="btn">저장</button></form></div>
      <h3>회사 추가 · 전환</h3><div className="card">{cos.length > 1 && <select value={cid} onChange={e => run(() => api('/api/settings/active', 'POST', { companyId: e.target.value }))}>{cos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        <form className="inl" onSubmit={e => { e.preventDefault(); run(() => api('/api/companies', 'POST', { name: cn }), () => { setCn(''); toast('새 회사로 전환했어요'); }); }}><input placeholder="새 회사 이름" value={cn} onChange={e => setCn(e.target.value)} required maxLength={40} /><button className="btn green">회사 추가</button></form></div></>}
    <button className="btn ghost" onClick={() => signOut(auth)}>로그아웃</button></>;
}
