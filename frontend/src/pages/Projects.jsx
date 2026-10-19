import { useState } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { api } from '../api';
import Chat, { dmPath } from '../components/Chat.jsx';
import { useCol, run, toast, Avatar } from '../lib.jsx';

const COLS = [['todo', '할 일'], ['doing', '진행 중'], ['done', '완료']];
function Board({ cid, team, members, me }) {
  const path = `companies/${cid}/teams/${team.id}/tasks`, tasks = useCol(path), [t, setT] = useState(''), [who, setWho] = useState('');
  const add = e => { e.preventDefault(); run(() => addDoc(collection(db, path), { title: t.trim(), status: 'todo', assignee: who, by: me.name, at: serverTimestamp() }), () => setT('')); };
  const mv = (k, d) => updateDoc(doc(db, path, k.id), { status: COLS[COLS.findIndex(c => c[0] === k.status) + d][0] }).catch(e => toast(e.message, 'err'));
  return <><form className="inl wrap" onSubmit={add}><input placeholder="할 일 추가" value={t} onChange={e => setT(e.target.value)} required maxLength={99} />
    <select value={who} onChange={e => setWho(e.target.value)}><option value="">담당자 없음</option>{team.memberUids.map(u => <option key={u} value={u}>{members.find(m => m.id === u)?.name}</option>)}</select><button className="btn">추가</button></form>
    <div className="board">{COLS.map(([s, l], ci) => <div key={s} className={'col ' + s}><h4>{l} <small>{tasks.filter(k => k.status === s).length}</small></h4>
      {tasks.filter(k => k.status === s).sort((a, b) => (a.at?.seconds || 9e9) - (b.at?.seconds || 9e9)).map(k => <div className="task" key={k.id}><p>{k.title}</p>
        <div className="inl">{k.assignee && <Avatar m={members.find(m => m.id === k.assignee)} size={22} />}<small>{members.find(m => m.id === k.assignee)?.name || '담당 없음'}</small>
          <span className="mv">{ci > 0 && <button aria-label="이전 단계" onClick={() => mv(k, -1)}>←</button>}{ci < 2 && <button aria-label="다음 단계" onClick={() => mv(k, 1)}>→</button>}<button aria-label="삭제" onClick={() => deleteDoc(doc(db, path, k.id))}>×</button></span></div></div>)}</div>)}</div></>;
}

export default function Projects({ cid, uid, me, members, teams }) {
  const [sel, setSel] = useState(me.teamId ? 'team:' + me.teamId : 'all'), [tab, setTab] = useState('chat'), [gh, setGh] = useState('');
  const [nt, setNt] = useState({ name: '', ids: [], lead: '' }), owner = me.role === 'owner';
  const free = members.filter(m => m.role === 'staff' && !m.teamId), [kind, id] = sel.split(':'), team = kind === 'team' && teams.find(t => t.id === id);
  const myTeams = owner ? teams : teams.filter(t => t.id === me.teamId), name = x => members.find(m => m.id === x)?.name;
  return <><h2>프로젝트</h2><div className="split">
    <div className="list"><button className={sel === 'all' ? 'on' : ''} onClick={() => setSel('all')}># 전체 단톡</button>
      <small>팀</small>{myTeams.map(t => <button key={t.id} className={sel === 'team:' + t.id ? 'on' : ''} onClick={() => { setSel('team:' + t.id); setTab('chat'); }}>{t.name}</button>)}{!myTeams.length && <p className="muted">속한 팀이 없어요.</p>}
      <small>DM</small>{members.filter(m => m.id !== uid).map(m => <button key={m.id} className={'dmb ' + (sel === 'dm:' + m.id ? 'on' : '')} onClick={() => setSel('dm:' + m.id)}><Avatar m={m} size={22} />{m.name}</button>)}</div>
    <div className="pane">
      {team && <><div className="card teamhead"><div><h3>{team.name}</h3><small>팀장 {name(team.leaderUid) || '미정'} · 팀원 {team.memberUids.map(name).join(', ')}</small></div>
        <div>{team.githubUrl ? <a className="gh" href={team.githubUrl} target="_blank" rel="noopener noreferrer">✓ 최종 GitHub 제출됨 ({team.githubBy})</a> : <small>최종 GitHub 링크 미제출</small>}
          <form className="inl" onSubmit={e => { e.preventDefault(); run(() => api(`/api/teams/${cid}/${team.id}/github`, 'POST', { url: gh }), () => { setGh(''); toast('제출했어요'); }); }}><input placeholder="https://github.com/..." value={gh} onChange={e => setGh(e.target.value)} required /><button className="btn sm">{team.githubUrl ? '다시 제출' : '제출'}</button></form></div></div>
        <div className="tabs">{[['chat', '팀 톡'], ['board', '할 일 보드'], ...(owner ? [['manage', '팀 관리']] : [])].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab === 'chat' && <Chat path={`companies/${cid}/teams/${team.id}/messages`} uid={uid} name={me.name} members={members} />}
        {tab === 'board' && <Board cid={cid} team={team} members={members} me={me} />}
        {tab === 'manage' && <div className="card"><h3 style={{ marginTop: 0 }}>팀장 변경</h3><select value={team.leaderUid} onChange={e => run(() => api(`/api/teams/${cid}/${team.id}/leader`, 'POST', { uid: e.target.value }), '팀장을 바꿨어요')}><option value="" disabled>선택</option>{team.memberUids.map(u => <option key={u} value={u}>{name(u)}</option>)}</select>
          <button className="btn danger" onClick={() => confirm('팀을 해체할까요? 팀원은 팀 없음 상태가 돼요.') && run(() => api(`/api/teams/${cid}/${team.id}`, 'DELETE'), () => { setSel('all'); toast('팀을 해체했어요'); })}>팀 해체</button></div>}</>}
      {sel === 'all' && <Chat path={`companies/${cid}/chat`} uid={uid} name={me.name} members={members} />}
      {kind === 'dm' && <Chat key={id} path={dmPath(cid, uid, id)} uid={uid} name={me.name} members={members} />}</div></div>
    {owner && <><h3>팀 만들기</h3><form className="card" onSubmit={e => { e.preventDefault(); run(() => api('/api/teams', 'POST', { companyId: cid, name: nt.name, memberUids: nt.ids, leaderUid: nt.lead }), () => { setNt({ name: '', ids: [], lead: '' }); toast('팀을 만들었어요'); }); }}>
      <input placeholder="팀 이름" value={nt.name} onChange={e => setNt({ ...nt, name: e.target.value })} required maxLength={30} />
      <div className="chips">{free.map(m => <label key={m.id} className={nt.ids.includes(m.id) ? 'on' : ''}><input type="checkbox" checked={nt.ids.includes(m.id)} onChange={e => setNt({ ...nt, ids: e.target.checked ? [...nt.ids, m.id] : nt.ids.filter(x => x !== m.id), lead: !e.target.checked && nt.lead === m.id ? '' : nt.lead })} />{m.name}</label>)}{!free.length && <p className="muted">팀이 없는 직원이 없어요.</p>}</div>
      <select value={nt.lead} onChange={e => setNt({ ...nt, lead: e.target.value })} required><option value="">팀장 선택</option>{nt.ids.map(i => <option key={i} value={i}>{name(i)}</option>)}</select><button className="btn">팀 만들기</button></form></>}</>;
}
