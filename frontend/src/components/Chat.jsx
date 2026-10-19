import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limitToLast, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Avatar, linkify, run, fmtT } from '../lib.jsx';

export const dmPath = (cid, a, b) => `companies/${cid}/dms/${[a, b].sort().join('_')}/messages`;
export default function Chat({ path, uid, name, members = [], height = 430 }) {
  const [msgs, setM] = useState([]), [t, setT] = useState(''), end = useRef();
  useEffect(() => onSnapshot(query(collection(db, path), orderBy('at'), limitToLast(100)), s => setM(s.docs.map(d => ({ id: d.id, ...d.data() })))), [path]);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [msgs]);
  const send = e => { e.preventDefault(); const x = t.trim(); if (!x) return; setT(''); run(() => addDoc(collection(db, path), { uid, name, text: x, at: serverTimestamp() })); };
  return <div className="chat" style={{ height }}><div className="msgs">
    {msgs.map((m, i) => { const mm = members.find(x => x.id === m.uid) || { name: m.name }, same = msgs[i - 1]?.uid === m.uid;
      return <div key={m.id} className={'msg' + (m.uid === uid ? ' mine' : '') + (same ? ' same' : '')}>{m.uid !== uid && !same && <Avatar m={mm} size={30} />}<div>{!same && <b>{m.name} <small>{fmtT(m.at)}</small></b>}<p>{linkify(m.text)}</p></div></div>; })}
    {!msgs.length && <p className="muted center">첫 메시지를 보내 보세요 👋 링크는 붙여 넣으면 바로 눌러볼 수 있어요.</p>}<div ref={end} /></div>
    <form onSubmit={send}><input value={t} onChange={e => setT(e.target.value)} placeholder="메시지 입력" maxLength={2000} /><button className="btn">보내기</button></form></div>;
}
