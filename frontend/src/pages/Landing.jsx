import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { api, staffEmail } from '../api';

export function Intro({ go }) {
  const feats = [['포인트·출석', '사장이 포인트를 주고, 직원은 매일 출석 체크로 연속 보너스를 받아요.', 'y'], ['상점', '사장이 직접 상품을 등록하고, 주문이 들어오면 지급 처리까지 한눈에.', 'g'], ['팀 프로젝트', '팀 톡, 할 일 보드, 링크 공유, 최종 GitHub 제출까지 한 화면에서.', 'p'],
    ['음성 회의', '전체 회의·팀 회의, 회의 채팅과 1:1 채팅, 손들기와 말하는 사람 표시.', 'y'], ['화면 공유', '사장 또는 사장이 지목한 한 명만 공유. 우리 팀 화면은 안전하게.', 'g'], ['공지·DM', '전사 공지와 단톡, 개인 DM으로 흩어진 대화를 모아요.', 'p']];
  return <div className="intro">
    <header><b className="logo">마루</b><div><button className="btn ghost" onClick={() => go('staff')}>직원 로그인</button><button className="btn" onClick={() => go('owner')}>사장 로그인</button></div></header>
    <section className="hero"><div><span className="eyebrow">사장과 직원을 위한 업무 공간</span><h1>팀의 하루를<br />한곳에서.</h1>
      <p>포인트를 주고, 상점에서 쓰고, 팀 프로젝트를 이야기하고, 음성 회의까지. 하나의 사이드바에서 전부 해결해요.</p>
      <div className="inl"><button className="btn big" onClick={() => go('signup')}>회사 만들기 · 무료</button><button className="btn big ghost" onClick={() => go('staff')}>직원으로 들어가기</button></div></div>
      <div className="mock"><div className="mcard live"><i /> <span><b>전체 회의</b> 진행 중</span><button className="btn sm green">참석하기</button></div>
        <div className="mcard pts"><small>내 포인트 · 🔥 6일 연속</small><b>1,250 P</b></div><div className="mcard shop"><span>☕ 커피 쿠폰</span><b>300 P</b></div>
        <div className="mcard git"><span>팀 알파 · 할 일 3/8</span><a>github.com/alpha/app</a></div></div></section>
    <section className="steps">{[['1', '사장이 회사를 만들고'], ['2', '직원 계정과 팀을 만들면'], ['3', '바로 같이 일할 수 있어요']].map(([n, t]) => <div key={n}><b>{n}</b><span>{t}</span></div>)}</section>
    <h2 className="sec">필요한 건 다 들어있어요</h2>
    <section className="feats">{feats.map(([t, d, c]) => <div key={t} className={'feat ' + c}><h3>{t}</h3><p>{d}</p></div>)}</section>
    <section className="roles"><div className="role"><h3>사장은</h3><ul><li>포인트 지급·회수, 전체 지급</li><li>상품 등록과 주문 지급 처리</li><li>팀·팀장 구성, 공지, 전체 회의</li><li>화면 공유 발표자 지정</li></ul></div>
      <div className="role alt"><h3>직원은</h3><ul><li>출석 체크로 포인트 적립</li><li>상점에서 상품 구매</li><li>팀 톡·할 일 보드·GitHub 제출</li><li>회의 참석, 팀장은 팀 회의 개설</li></ul></div></section>
    <footer><b className="logo">마루</b><small>© 마루. 팀의 하루를 한곳에서.</small></footer></div>;
}

export function Login({ mode, go }) {
  const [tab, setTab] = useState(mode), [f, setF] = useState({}), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (tab === 'staff') await signInWithEmailAndPassword(auth, staffEmail(f.code || '', f.un || ''), f.pw || '');
      else if (tab === 'owner') await signInWithEmailAndPassword(auth, f.email || '', f.pw || '');
      else {
        await createUserWithEmailAndPassword(auth, f.email || '', f.pw || '');
        try { await api('/api/companies', 'POST', { name: f.company, ownerName: f.name }); } catch (x) { await auth.currentUser.delete(); throw x; }
      }
    } catch (x) { setErr(x.code === 'auth/email-already-in-use' ? '이미 가입된 이메일이에요' : x.code?.startsWith('auth/') ? '아이디 또는 비밀번호를 확인해 주세요' : x.message); }
    setBusy(false);
  };
  return <div className="login"><form className="panel" onSubmit={submit}>
    <b className="logo" onClick={() => go('intro')}>마루</b>
    <div className="tabs">{[['staff', '직원 로그인'], ['owner', '사장 로그인'], ['signup', '사장 가입']].map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setErr(''); }}>{l}</button>)}</div>
    {tab === 'staff' && <><input placeholder="회사 코드 (사장에게 받은 코드)" value={f.code || ''} onChange={set('code')} required /><input placeholder="아이디" value={f.un || ''} onChange={set('un')} required autoComplete="username" /></>}
    {tab === 'signup' && <><input placeholder="내 이름" value={f.name || ''} onChange={set('name')} required maxLength={30} /><input placeholder="회사 이름" value={f.company || ''} onChange={set('company')} required maxLength={40} /></>}
    {tab !== 'staff' && <input type="email" placeholder="이메일" value={f.email || ''} onChange={set('email')} required autoComplete="email" />}
    <input type="password" placeholder="비밀번호 (6자 이상)" value={f.pw || ''} onChange={set('pw')} required minLength={6} autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} />
    {err && <p className="err">{err}</p>}
    <button className="btn big" disabled={busy}>{busy ? '잠시만요…' : tab === 'signup' ? '가입하고 시작하기' : '로그인'}</button>
    <button type="button" className="link" onClick={() => go('intro')}>← 소개 페이지로</button>
  </form></div>;
}
