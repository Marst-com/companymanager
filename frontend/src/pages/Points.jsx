import { useState } from 'react';
import { api } from '../api';
import { useCol, byNew, fmtT, run, Avatar } from '../lib.jsx';

export default function Points({ cid, uid, me, members }) {
  const owner = me.role === 'owner', ledger = useCol(owner ? null : `companies/${cid}/wallets/${uid}/ledger`).sort(byNew);
  const wallets = useCol(owner ? `companies/${cid}/wallets` : null), staff = members.filter(m => m.role === 'staff');
  const [g, setG] = useState({}), [why, setWhy] = useState(''), [all, setAll] = useState(''), [s, setS] = useState({ name: '', username: '', password: '' });
  const grant = (uid2, amount) => run(() => api('/api/points', 'POST', { companyId: cid, uid: uid2, amount, reason: why }), () => setG(x => ({ ...x, [uid2]: '' })));
  const total = wallets.reduce((a, w) => a + (staff.some(m => m.id === w.id) ? w.points : 0), 0);
  return <><h2>포인트</h2>
    {!owner && <><div className="card pt"><small>내 포인트</small><b>{me.points.toLocaleString()} P</b><span className="streak">🔥 {me.streak}일 연속 출석</span></div>
      <h3>포인트 내역</h3><div className="card">{ledger.slice(0, 30).map(l => <div className="row" key={l.id}><span>{l.why}<small> · {fmtT(l.at)}</small></span><b className={l.n > 0 ? 'plus' : 'minus'}>{l.n > 0 ? '+' : ''}{l.n} P</b></div>)}{!ledger.length && <p className="muted">아직 내역이 없어요. 홈에서 출석하면 첫 포인트를 받아요!</p>}</div></>}
    {owner && <><div className="stats"><div className="stat y"><b>{total.toLocaleString()}</b><small>직원 보유 포인트 합계</small></div><div className="stat p"><b>{staff.length}</b><small>직원</small></div></div>
      <h3>포인트 지급</h3><div className="card"><div className="inl wrap"><input placeholder="사유 (선택, 예: 프로젝트 완료)" value={why} onChange={e => setWhy(e.target.value)} maxLength={40} />
        <input type="number" min="1" placeholder="전체에게 지급할 P" value={all} onChange={e => setAll(e.target.value)} /><button className="btn green" disabled={!all || !staff.length} onClick={() => confirm(`직원 ${staff.length}명 모두에게 ${all}P를 지급할까요?`) && run(() => api('/api/points/all', 'POST', { companyId: cid, amount: +all, reason: why }), () => setAll(''))}>전체 지급</button></div>
        {staff.map(m => <div className="row" key={m.id}><span className="who3"><Avatar m={m} size={32} /> <span>{m.name} <small>@{m.username}{m.leader ? ' · 팀장' : ''}</small></span></span><b>{(wallets.find(w => w.id === m.id)?.points ?? 0).toLocaleString()} P</b>
          <span className="inl">{[10, 50, 100].map(n => <button key={n} className="chip" onClick={() => grant(m.id, n)}>+{n}</button>)}
            <input type="number" className="num" placeholder="직접(음수=회수)" value={g[m.id] || ''} onChange={e => setG({ ...g, [m.id]: e.target.value })} /><button className="btn sm" disabled={!g[m.id]} onClick={() => grant(m.id, parseInt(g[m.id], 10))}>적용</button>
            <button className="link" onClick={() => { const pw = prompt(`${m.name}님의 새 비밀번호 (6자 이상)`); if (pw) run(() => api(`/api/staff/${cid}/${m.id}/password`, 'POST', { password: pw }), '비밀번호를 바꿨어요'); }}>비번</button>
            <button className="link" onClick={() => confirm(`${m.name}님 계정을 삭제할까요? 되돌릴 수 없어요.`) && run(() => api(`/api/staff/${cid}/${m.id}`, 'DELETE'), '삭제했어요')}>삭제</button></span></div>)}
        {!staff.length && <p className="muted">아직 직원이 없어요. 아래에서 계정을 만들어 주세요.</p>}</div>
      <h3>직원 계정 만들기</h3><form className="card inl wrap" onSubmit={e => { e.preventDefault(); run(() => api('/api/staff', 'POST', { companyId: cid, ...s }), () => { setS({ name: '', username: '', password: '' }); alert(`계정을 만들었어요.\n직원에게 회사 코드(설정에서 확인)와 아이디·비밀번호를 알려 주세요.`); }); }}>
        <input placeholder="이름" value={s.name} onChange={e => setS({ ...s, name: e.target.value })} required maxLength={30} /><input placeholder="아이디 (영문·숫자)" value={s.username} onChange={e => setS({ ...s, username: e.target.value })} required />
        <input placeholder="비밀번호 (6자 이상)" type="password" value={s.password} onChange={e => setS({ ...s, password: e.target.value })} required minLength={6} /><button className="btn">계정 만들기</button></form></>}</>;
}
