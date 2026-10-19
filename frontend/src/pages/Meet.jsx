import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { api } from '../api';
import { Room } from '../rtc';
import Chat, { dmPath } from '../components/Chat.jsx';
import { useCol, byNew, canJoin, fmtT, run, toast, Avatar } from '../lib.jsx';

export function Meetings({ cid, me, meetings, join }) {
  const [title, setTitle] = useState(''), live = meetings.filter(m => canJoin(m, me));
  const past = meetings.filter(m => !m.active && (me.role === 'owner' || m.type === 'all' || m.teamId === me.teamId)).sort(byNew).slice(0, 8);
  const start = type => run(async () => { const r = await api('/api/meetings', 'POST', { companyId: cid, type, title }); setTitle(''); join(r.id); });
  const dur = m => m.endedAt && m.createdAt ? Math.max(1, Math.round((m.endedAt.seconds - m.createdAt.seconds) / 60)) + '분' : '';
  return <><h2>회의</h2>
    {(me.role === 'owner' || me.leader) ? <div className="card inl wrap"><input placeholder="회의 제목 (예: 주간 회의)" value={title} onChange={e => setTitle(e.target.value)} maxLength={40} />
      {me.role === 'owner' && <button className="btn" onClick={() => start('all')}>전체 회의 열기</button>}{me.leader && <button className="btn green" onClick={() => start('team')}>팀 회의 열기</button>}</div>
      : <p className="muted">전체 회의는 사장, 팀 회의는 팀장이 열 수 있어요.</p>}
    <h3>열려 있는 회의</h3><div className="card">{live.map(m => <div className="row" key={m.id}><span><i className="dot" /> {m.title} <small>{m.type === 'all' ? '전체 회의' : '팀 회의'} · {m.hostName} · {fmtT(m.createdAt)} 시작</small></span><button className="btn sm green" onClick={() => join(m.id)}>참석하기</button></div>)}{!live.length && <p className="muted">열린 회의가 없어요.</p>}</div>
    {past.length > 0 && <><h3>지난 회의</h3><div className="card">{past.map(m => <div className="row" key={m.id}><span>{m.title} <small>{m.type === 'all' ? '전체' : '팀'} · {m.hostName}</small></span><small>{fmtT(m.createdAt)} {dur(m) && '· ' + dur(m)}</small></div>)}</div></>}</>;
}

const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
export function RoomView({ cid, mid, uid, me, members, onLeave }) {
  const [meet, setMeet] = useState(null), [peers, setPeers] = useState([]), [muted, setMuted] = useState(false), [hand, setHand] = useState(false), [sharing, setSharing] = useState(false), [screenOn, setScreenOn] = useState(false);
  const [tab, setTab] = useState('room'), [dm, setDm] = useState(''), [err, setErr] = useState(''), [speak, setSpeak] = useState({}), [now, setNow] = useState(Date.now());
  const room = useRef(), vid = useRef(), auds = useRef({}), mons = useRef({}), ctx = useRef();
  useEffect(() => onSnapshot(doc(db, `companies/${cid}/meetings/${mid}`), s => setMeet(s.data())), [cid, mid]);
  useEffect(() => {
    const monitor = (id, st) => { try { ctx.current ||= new AudioContext(); const an = ctx.current.createAnalyser(); an.fftSize = 256; ctx.current.createMediaStreamSource(st).connect(an); mons.current[id] = { an, buf: new Uint8Array(an.frequencyBinCount) }; } catch { /* 분석 불가 시 표시만 생략 */ } };
    const r = new Room(cid, mid, uid, me.name, {
      peers: setPeers, shareEnded: () => { setSharing(false); setScreenOn(false); if (vid.current) vid.current.srcObject = null; },
      drop: id => { auds.current[id]?.pause(); delete auds.current[id]; delete mons.current[id]; },
      track: (id, t, st) => {
        if (t.kind === 'audio') { const a = auds.current[id] || (auds.current[id] = new Audio()); a.srcObject = st; a.play().catch(() => {}); monitor(id, st); }
        else { const show = () => { if (vid.current) vid.current.srcObject = st; setScreenOn(true); }; if (!t.muted) show(); t.onunmute = show; t.onmute = () => { if (vid.current) vid.current.srcObject = null; setScreenOn(false); }; }
      } });
    room.current = r; r.join().then(() => monitor(uid, r.mic)).catch(x => setErr(x.name === 'NotAllowedError' ? '마이크 권한을 허용해 주세요' : x.message));
    const iv = setInterval(() => {
      const s = {}; for (const [id, m] of Object.entries(mons.current)) { m.an.getByteFrequencyData(m.buf); s[id] = m.buf.reduce((a, b) => a + b, 0) / m.buf.length > 18; }
      setSpeak(o => JSON.stringify(o) === JSON.stringify(s) ? o : s); setNow(Date.now());
    }, 300);
    return () => { clearInterval(iv); r.leave(); ctx.current?.close(); };
  }, [cid, mid, uid]);
  useEffect(() => { if (meet && !meet.active) { toast('회의가 끝났어요'); onLeave(); } if (meet && meet.presenterUid !== uid && sharing) { room.current.share(false); setSharing(false); setScreenOn(false); } }, [meet]);
  const canShare = meet?.presenterUid === uid, isOwner = me.role === 'owner', nm = id => members.find(m => m.id === id)?.name || '';
  const toggleShare = () => run(async () => { await room.current.share(!sharing); const on = !sharing; setSharing(on); setScreenOn(on); if (vid.current) vid.current.srcObject = on ? room.current.screen : null; });
  if (!meet) return null;
  const el = meet.createdAt ? Math.max(0, Math.floor((now - meet.createdAt.seconds * 1000) / 1000)) : 0;
  return <><div className="rhead"><div><h2>{meet.title}</h2><small>{meet.type === 'all' ? '전체 회의' : '팀 회의'} · ⏱ {mmss(el)} · 화면 공유 권한: {nm(meet.presenterUid) || '사장'}</small></div>
    <div className="inl wrap"><button className={'btn ' + (muted ? 'danger' : 'ghost')} onClick={() => { room.current.setMuted(!muted); room.current.setState({ muted: !muted }); setMuted(!muted); }}>{muted ? '🔇 음소거 중' : '🎙 마이크 켜짐'}</button>
      <button className={'btn ' + (hand ? '' : 'ghost')} onClick={() => { room.current.setState({ hand: !hand }); setHand(!hand); }}>✋ 손들기</button>
      {canShare && <button className="btn green" onClick={toggleShare}>{sharing ? '공유 중지' : '🖥 화면 공유'}</button>}
      <button className="btn ghost" onClick={onLeave}>나가기</button>
      {(isOwner || meet.hostUid === uid) && <button className="btn danger" onClick={() => confirm('모두를 내보내고 회의를 끝낼까요?') && run(() => api(`/api/meetings/${cid}/${mid}/end`))}>회의 끝내기</button>}</div></div>
    {err && <p className="err">{err}</p>}
    <div className="tabs"><button className={tab === 'room' ? 'on' : ''} onClick={() => setTab('room')}>회의</button><button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>회의 채팅</button><button className={tab === 'dm' ? 'on' : ''} onClick={() => setTab('dm')}>1:1 채팅</button></div>
    <div className={tab === 'room' ? '' : 'hide'}>
      <div className={'stage' + (screenOn ? '' : ' empty')}><video ref={vid} autoPlay playsInline muted className="screen" />{!screenOn && <p className="muted">공유 중인 화면이 없어요</p>}</div>
      <h3>참가자 {peers.length}명</h3><div className="tiles">{peers.map(p => { const mm = members.find(m => m.id === p.uid) || { name: p.name };
        return <div key={p.uid} className={'tile' + (speak[p.uid] && !p.muted ? ' sp' : '')}><Avatar m={mm} size={56} /><b>{p.name}{p.uid === uid && ' (나)'}</b>
          <span className="tags">{mm.role === 'owner' && <em className="tag p">사장</em>}{p.uid === meet.presenterUid && <em className="tag y">발표 권한</em>}{p.muted && <em className="tag">음소거</em>}{p.hand && <em className="tag g">✋ 손듦</em>}</span>
          {isOwner && p.uid !== meet.presenterUid && <button className="btn sm ghost" onClick={() => run(() => api(`/api/meetings/${cid}/${mid}/presenter`, 'POST', { uid: p.uid }), `${p.name}님에게 화면 공유 권한을 줬어요`)}>화면 공유 권한</button>}</div>; })}</div></div>
    {tab === 'chat' && <Chat path={`companies/${cid}/meetings/${mid}/messages`} uid={uid} name={me.name} members={members} />}
    {tab === 'dm' && <><select value={dm} onChange={e => setDm(e.target.value)}><option value="">대화할 사람 선택</option>{peers.filter(p => p.uid !== uid).map(p => <option key={p.uid} value={p.uid}>{p.name}</option>)}</select>{dm && <Chat key={dm} path={dmPath(cid, uid, dm)} uid={uid} name={me.name} members={members} />}</>}</>;
}
