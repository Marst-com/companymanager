import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { api } from '../api';
import { useCol, byNew, canJoin, todayKST, fmtT, run, toast, Avatar } from '../lib.jsx';

export default function Home({ cid, me, co, members, teams, meetings, go, join }) {
  const owner = me.role === 'owner', team = teams.find(t => t.id === me.teamId);
  const ann = useCol(`companies/${cid}/announcements`).sort(byNew).slice(0, 4);
  const tasks = useCol(team ? `companies/${cid}/teams/${team.id}/tasks` : null);
  const orders = useCol(owner ? `companies/${cid}/orders` : null);
  const live = meetings.filter(m => canJoin(m, me)), [a, setA] = useState({ title: '', body: '' });
  const done = me.lastCheckin === todayKST(), hour = new Date().getHours(), greet = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '수고한 하루예요';
  const checkin = () => run(() => api('/api/checkin', 'POST', { companyId: cid }), r => toast(`출석 완료! +${r.n}P${r.bonus ? ' (7일 보너스 🎉)' : ''} · ${r.streak}일 연속`));
  const post = e => { e.preventDefault(); run(() => addDoc(collection(db, `companies/${cid}/announcements`), { ...a, by: me.name, at: serverTimestamp() }), () => { setA({ title: '', body: '' }); toast('공지를 올렸어요'); }); };
  return <><h2>{greet}, {me.name}님</h2>
    {owner ? <div className="stats">{[['직원', members.filter(m => m.role === 'staff').length, 'p'], ['팀', teams.length, 'g'], ['지급 대기 주문', orders.filter(o => !o.done).length, 'y'], ['열린 회의', live.length, 'g']].map(([l, v, c]) => <div key={l} className={'stat ' + c}><b>{v}</b><small>{l}</small></div>)}</div>
      : <div className="grid2"><div className="card pt"><small>내 포인트</small><b>{me.points.toLocaleString()} P</b><span className="streak">🔥 {me.streak}일 연속 출석</span>
        <button className="btn" disabled={done} onClick={checkin}>{done ? '오늘 출석 완료 ✓' : `출석하고 +${co.checkinPoints ?? 10}P 받기`}</button></div>
        <div className="card"><h3>내 팀</h3>{team ? <><div className="row"><b>{team.name}</b><small>팀장 {members.find(m => m.id === team.leaderUid)?.name || '미정'}</small></div>
          <div className="row"><span>할 일 진행</span><b>{tasks.filter(t => t.status === 'done').length} / {tasks.length}</b></div>
          <div className="row"><span>최종 GitHub</span>{team.githubUrl ? <a href={team.githubUrl} target="_blank" rel="noopener noreferrer">제출 완료 ✓</a> : <button className="btn sm" onClick={() => go('projects')}>제출하러 가기</button>}</div></> : <p className="muted">아직 팀이 없어요. 사장님이 팀을 만들어 주면 여기에 표시돼요.</p>}</div></div>}
    <div className="grid2"><div className="card"><h3>진행 중인 회의</h3>{live.map(m => <div className="row" key={m.id}><span><i className="dot" /> {m.title} <small>{m.type === 'all' ? '전체' : '팀'} · {m.hostName}</small></span><button className="btn sm green" onClick={() => join(m.id)}>회의 참석하기</button></div>)}{!live.length && <p className="muted">지금 열린 회의가 없어요.</p>}</div>
      <div className="card"><h3>공지</h3>{ann.map(x => <div className="note" key={x.id}><b>{x.title}</b><p>{x.body}</p><small>{x.by} · {fmtT(x.at)}</small></div>)}{!ann.length && <p className="muted">공지가 없어요.</p>}
        {owner && <form className="ann" onSubmit={post}><input placeholder="공지 제목" value={a.title} onChange={e => setA({ ...a, title: e.target.value })} required maxLength={79} /><input placeholder="내용" value={a.body} onChange={e => setA({ ...a, body: e.target.value })} required maxLength={999} /><button className="btn sm">공지 올리기</button></form>}</div></div>
    <h3>바로가기</h3><div className="shorts">{[['points', '포인트 확인', 'y'], ['shop', '상점 가기', 'g'], ['projects', '팀 톡 · 할 일', 'p'], ['meet', '회의 목록', 'y']].map(([k, l, c]) => <button key={k} className={'short ' + c} onClick={() => go(k)}>{l}</button>)}</div></>;
}
