import { useState } from 'react';
import { api } from '../api';
import { useCol, byNew, fmtT, run, toast } from '../lib.jsx';

const EMOJI = ['🎁', '☕', '🍕', '🎫', '🎮', '📚', '🏖️', '🎧', '🍰', '🧧'];
export default function Shop({ cid, uid, me }) {
  const owner = me.role === 'owner', items = useCol(`companies/${cid}/items`).sort((a, b) => a.price - b.price);
  const orders = useCol(`companies/${cid}/orders`).filter(o => owner || o.uid === uid).sort(byNew);
  const [n, setN] = useState({ name: '', price: '', stock: '', emoji: '🎁', desc: '' }), [q, setQ] = useState('');
  const shown = items.filter(i => i.name.includes(q));
  return <><div className="rhead"><h2>상점</h2><p className="muted">보유 포인트 <b>{me.points.toLocaleString()} P</b></p></div>
    {items.length > 4 && <input className="search" placeholder="상품 검색" value={q} onChange={e => setQ(e.target.value)} />}
    <div className="items">{shown.map(i => <div className="card item" key={i.id}><span className="em">{i.emoji || '🎁'}</span><h3>{i.name}</h3>{i.desc && <small>{i.desc}</small>}<b>{i.price.toLocaleString()} P</b><small>재고 {i.stock}개</small>
      {!owner && <button className="btn sm green" disabled={i.stock < 1 || me.points < i.price} onClick={() => confirm(`${i.name}을(를) ${i.price}P에 살까요?`) && run(() => api('/api/buy', 'POST', { companyId: cid, itemId: i.id }), () => toast('구매했어요! 사장님이 확인하면 지급돼요'))}>{i.stock < 1 ? '품절' : me.points < i.price ? `${i.price - me.points}P 부족` : '구매하기'}</button>}
      {owner && <button className="link" onClick={() => confirm('삭제할까요?') && run(() => api(`/api/items/${cid}/${i.id}`, 'DELETE'), '삭제했어요')}>삭제</button>}</div>)}
      {!items.length && <p className="muted">등록된 상품이 없어요.{owner && ' 아래에서 첫 상품을 등록해 보세요.'}</p>}</div>
    {owner && <><h3>상품 등록</h3><form className="card" onSubmit={e => { e.preventDefault(); run(() => api('/api/items', 'POST', { companyId: cid, name: n.name, price: +n.price, stock: +n.stock, emoji: n.emoji, desc: n.desc }), () => { setN({ name: '', price: '', stock: '', emoji: '🎁', desc: '' }); toast('등록했어요'); }); }}>
      <div className="chips">{EMOJI.map(x => <label key={x} className={n.emoji === x ? 'on' : ''}><input type="radio" name="em" checked={n.emoji === x} onChange={() => setN({ ...n, emoji: x })} />{x}</label>)}</div>
      <div className="inl wrap"><input placeholder="상품 이름" value={n.name} onChange={e => setN({ ...n, name: e.target.value })} required maxLength={40} /><input type="number" min="1" placeholder="가격(P)" value={n.price} onChange={e => setN({ ...n, price: e.target.value })} required /><input type="number" min="0" placeholder="재고" value={n.stock} onChange={e => setN({ ...n, stock: e.target.value })} required /></div>
      <input placeholder="한 줄 설명 (선택)" value={n.desc} onChange={e => setN({ ...n, desc: e.target.value })} maxLength={80} /><button className="btn">등록</button></form></>}
    <h3>{owner ? '주문 관리' : '내 구매 내역'}</h3><div className="card">{orders.map(o => <div className="row" key={o.id}><span>{o.emoji || '🎁'} {owner && o.name + ' · '}{o.item} <small>{fmtT(o.at)}</small></span>
      <span className="inl"><b>-{o.price} P</b>{o.done ? <em className="tag g">지급 완료</em> : owner ? <button className="btn sm green" onClick={() => run(() => api(`/api/orders/${cid}/${o.id}/done`), '지급 처리했어요')}>지급 완료</button> : <em className="tag y">지급 대기</em>}</span></div>)}{!orders.length && <p className="muted">내역이 없어요.</p>}</div></>;
}
