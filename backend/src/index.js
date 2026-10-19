import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) }); // 루트 .env
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

admin.initializeApp({ credential: admin.credential.cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
}) });
const db = admin.firestore(), auth = admin.auth(), FV = admin.firestore.FieldValue;
const app = express();
const ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean); // 공백·끝 / 자동 제거
console.log('CORS 허용:', ORIGINS.join(', '));
app.use(cors({ origin: ORIGINS }));
app.get('/', (q, r) => r.send('maru ok')); // 서버 살아있는지 확인용
app.use(express.json({ limit: '20kb' }));

const E = (s, m) => Object.assign(new Error(m), { status: s });
const h = f => (q, r) => f(q, r).catch(e => {
  if (!e.status) console.error(e);
  r.status(e.status || 500).json({ error: e.status ? e.message : '서버 오류가 났어요' });
});
const str = (v, max = 60) => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw E(400, '입력을 확인해 주세요'); return v.trim(); };
const int = (v, min, max) => { if (!Number.isInteger(v) || v < min || v > max) throw E(400, '숫자를 확인해 주세요'); return v; };
const mem = async (q, c) => { const s = await db.doc(`companies/${str(c, 40)}/members/${q.uid}`).get(); if (!s.exists) throw E(403, '권한이 없어요'); return s.data(); };
const own = async (q, c) => { const m = await mem(q, c); if (m.role !== 'owner') throw E(403, '사장만 할 수 있어요'); return m; };

app.use('/api', async (q, r, n) => {
  try { q.uid = (await auth.verifyIdToken((q.headers.authorization || '').replace('Bearer ', ''))).uid; n(); }
  catch { r.status(401).json({ error: '로그인이 필요해요' }); }
});

// 회사 만들기 (사장 첫 가입 + 회사 추가 공용)
app.post('/api/companies', h(async (q, r) => {
  const name = str(q.body.name, 40), uref = db.doc('users/' + q.uid), us = await uref.get();
  if (us.exists && us.data().role !== 'owner') throw E(403, '사장만 회사를 만들 수 있어요');
  const uname = us.exists ? us.data().name : str(q.body.ownerName, 30);
  const cref = db.collection('companies').doc(), b = db.batch();
  b.set(cref, { name, ownerUid: q.uid, createdAt: FV.serverTimestamp() });
  b.set(cref.collection('members').doc(q.uid), { uid: q.uid, name: uname, role: 'owner', teamId: null, leader: false });
  b.set(cref.collection('wallets').doc(q.uid), { points: 0, streak: 0, lastCheckin: '' });
  b.set(uref, { name: uname, role: 'owner', activeCompanyId: cref.id, companyIds: FV.arrayUnion(cref.id) }, { merge: true });
  await b.commit(); r.json({ id: cref.id });
}));

// 직원 계정 만들기
app.post('/api/staff', h(async (q, r) => {
  const c = q.body.companyId; await own(q, c);
  const name = str(q.body.name, 30), un = str(q.body.username, 20).toLowerCase(), pw = str(q.body.password, 64);
  if (!/^[a-z0-9_]{3,20}$/.test(un)) throw E(400, '아이디는 영문 소문자·숫자·_ 3~20자예요');
  if (pw.length < 6) throw E(400, '비밀번호는 6자 이상이에요');
  let u;
  try { u = await auth.createUser({ email: `${un}.${c}@staff.maru.app`.toLowerCase(), password: pw, displayName: name }); }
  catch (e) { throw E(e.code === 'auth/email-already-exists' ? 409 : 400, e.code === 'auth/email-already-exists' ? '이미 있는 아이디예요' : '계정을 만들 수 없어요'); }
  const b = db.batch(), cr = db.doc('companies/' + c);
  b.set(db.doc('users/' + u.uid), { name, role: 'staff', activeCompanyId: c, companyIds: [c] });
  b.set(cr.collection('members').doc(u.uid), { uid: u.uid, name, role: 'staff', username: un, teamId: null, leader: false });
  b.set(cr.collection('wallets').doc(u.uid), { points: 0, streak: 0, lastCheckin: '' });
  await b.commit(); r.json({ uid: u.uid });
}));

app.post('/api/points', h(async (q, r) => {
  const { companyId: c, uid } = q.body; await own(q, c);
  const n = int(q.body.amount, -1e6, 1e6), why = (typeof q.body.reason === 'string' && q.body.reason.trim().slice(0, 40)) || (n > 0 ? '사장 지급' : '사장 회수'), w = db.doc(`companies/${c}/wallets/${str(uid, 128)}`);
  await db.runTransaction(async t => {
    const s = await t.get(w); if (!s.exists) throw E(404, '직원을 찾을 수 없어요');
    const p = s.data().points + n; if (p < 0) throw E(400, '포인트가 0보다 작아질 수 없어요');
    t.update(w, { points: p }); t.set(w.collection('ledger').doc(), { n, why, at: FV.serverTimestamp() });
  });
  r.json({ ok: 1 });
}));

app.post('/api/items', h(async (q, r) => {
  const c = q.body.companyId; await own(q, c);
  await db.collection(`companies/${c}/items`).add({ name: str(q.body.name, 40), price: int(q.body.price, 1, 1e7), stock: int(q.body.stock, 0, 1e5), emoji: (typeof q.body.emoji === 'string' && q.body.emoji.slice(0, 4)) || '🎁', desc: (typeof q.body.desc === 'string' && q.body.desc.trim().slice(0, 80)) || '', createdAt: FV.serverTimestamp() });
  r.json({ ok: 1 });
}));
app.delete('/api/items/:c/:i', h(async (q, r) => { await own(q, q.params.c); await db.doc(`companies/${q.params.c}/items/${q.params.i}`).delete(); r.json({ ok: 1 }); }));

app.post('/api/buy', h(async (q, r) => {
  const { companyId: c, itemId } = q.body, m = await mem(q, c);
  const ir = db.doc(`companies/${c}/items/${str(itemId, 40)}`), w = db.doc(`companies/${c}/wallets/${q.uid}`);
  await db.runTransaction(async t => {
    const [i, ws] = await Promise.all([t.get(ir), t.get(w)]);
    if (!i.exists) throw E(404, '없는 상품이에요');
    const it = i.data(), pt = ws.data().points;
    if (it.stock < 1) throw E(400, '품절이에요');
    if (pt < it.price) throw E(400, '포인트가 부족해요');
    t.update(w, { points: pt - it.price }); t.update(ir, { stock: it.stock - 1 }); t.set(w.collection('ledger').doc(), { n: -it.price, why: `${it.name} 구매`, at: FV.serverTimestamp() });
    t.set(db.collection(`companies/${c}/orders`).doc(), { uid: q.uid, name: m.name, item: it.name, emoji: it.emoji || '🎁', price: it.price, done: false, at: FV.serverTimestamp() });
  });
  r.json({ ok: 1 });
}));

app.post('/api/teams', h(async (q, r) => {
  const c = q.body.companyId; await own(q, c);
  const name = str(q.body.name, 30), ids = [...new Set(q.body.memberUids || [])], lead = q.body.leaderUid;
  if (!ids.length || !ids.includes(lead)) throw E(400, '팀원과 팀장을 확인해 주세요');
  const ms = await Promise.all(ids.map(u => db.doc(`companies/${c}/members/${str(u, 128)}`).get()));
  if (ms.some(s => !s.exists || s.data().role === 'owner')) throw E(400, '직원만 팀에 넣을 수 있어요');
  if (ms.some(s => s.data().teamId)) throw E(400, '이미 다른 팀에 있는 직원이 있어요');
  const tr = db.collection(`companies/${c}/teams`).doc(), b = db.batch();
  b.set(tr, { name, leaderUid: lead, memberUids: ids, githubUrl: '', createdAt: FV.serverTimestamp() });
  ms.forEach(s => b.update(s.ref, { teamId: tr.id, leader: s.id === lead }));
  await b.commit(); r.json({ id: tr.id });
}));

app.post('/api/teams/:c/:t/github', h(async (q, r) => {
  const { c, t } = q.params, m = await mem(q, c);
  if (m.role !== 'owner' && m.teamId !== t) throw E(403, '팀원만 올릴 수 있어요');
  let u; try { u = new URL(str(q.body.url, 200)); } catch { throw E(400, '링크 형식이 아니에요'); }
  if (u.protocol !== 'https:' || u.hostname !== 'github.com') throw E(400, 'github.com 링크만 올릴 수 있어요');
  await db.doc(`companies/${c}/teams/${t}`).update({ githubUrl: u.href, githubBy: m.name }); r.json({ ok: 1 });
}));

app.post('/api/meetings', h(async (q, r) => {
  const { companyId: c, type } = q.body, m = await mem(q, c), title = (typeof q.body.title === 'string' && q.body.title.trim().slice(0, 40)) || '회의';
  let teamId = null;
  if (type === 'all') { if (m.role !== 'owner') throw E(403, '전체 회의는 사장만 열 수 있어요'); }
  else if (type === 'team') { if (!m.leader || !m.teamId) throw E(403, '팀 회의는 팀장만 열 수 있어요'); teamId = m.teamId; }
  else throw E(400, '회의 종류를 확인해 주세요');
  const co = (await db.doc('companies/' + c).get()).data();
  const ref = await db.collection(`companies/${c}/meetings`).add({ type, teamId, title, hostUid: q.uid, hostName: m.name, presenterUid: co.ownerUid, active: true, createdAt: FV.serverTimestamp() });
  r.json({ id: ref.id });
}));
app.post('/api/meetings/:c/:i/end', h(async (q, r) => {
  const m = await mem(q, q.params.c), ref = db.doc(`companies/${q.params.c}/meetings/${q.params.i}`), s = await ref.get();
  if (!s.exists) throw E(404, '회의를 찾을 수 없어요');
  if (m.role !== 'owner' && s.data().hostUid !== q.uid) throw E(403, '회의를 연 사람만 끝낼 수 있어요');
  await ref.update({ active: false, endedAt: FV.serverTimestamp() }); r.json({ ok: 1 });
}));
// 화면 공유 발표자 지정: 사장 본인 또는 사장이 지목한 1명
app.post('/api/meetings/:c/:i/presenter', h(async (q, r) => {
  await own(q, q.params.c); const u = str(q.body.uid, 128);
  if (!(await db.doc(`companies/${q.params.c}/members/${u}`).get()).exists) throw E(404, '멤버를 찾을 수 없어요');
  await db.doc(`companies/${q.params.c}/meetings/${q.params.i}`).update({ presenterUid: u }); r.json({ ok: 1 });
}));

const COLORS = ['#5b3df5', '#1fa971', '#f2a900', '#e0528a', '#2b8cf0', '#8a5cf5'];
app.post('/api/settings/profile', h(async (q, r) => {
  const name = str(q.body.name, 30), color = COLORS.includes(q.body.color) ? q.body.color : COLORS[0];
  const us = await db.doc('users/' + q.uid).get(), b = db.batch();
  b.update(us.ref, { name, color });
  for (const c of us.data().companyIds || []) b.update(db.doc(`companies/${c}/members/${q.uid}`), { name, color });
  await b.commit(); r.json({ ok: 1 });
}));
app.post('/api/settings/active', h(async (q, r) => {
  const c = str(q.body.companyId, 40), us = await db.doc('users/' + q.uid).get();
  if (!(us.data().companyIds || []).includes(c)) throw E(403, '내 회사가 아니에요');
  await us.ref.update({ activeCompanyId: c }); r.json({ ok: 1 });
}));

// ===== 추가 기능 =====
const todayKST = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
app.post('/api/checkin', h(async (q, r) => {
  const c = q.body.companyId, m = await mem(q, c);
  if (m.role === 'owner') throw E(403, '직원만 출석할 수 있어요');
  const co = (await db.doc('companies/' + c).get()).data(), base = co.checkinPoints ?? 10;
  const w = db.doc(`companies/${c}/wallets/${q.uid}`), today = todayKST(), yest = todayKST(new Date(Date.now() - 864e5));
  let out;
  await db.runTransaction(async t => {
    const d = (await t.get(w)).data();
    if (d.lastCheckin === today) throw E(400, '오늘은 이미 출석했어요');
    const streak = d.lastCheckin === yest ? (d.streak || 0) + 1 : 1, bonus = streak % 7 === 0 ? 50 : 0, n = base + bonus;
    t.update(w, { points: d.points + n, streak, lastCheckin: today });
    t.set(w.collection('ledger').doc(), { n, why: bonus ? `출석 ${streak}일 연속 보너스` : '출석', at: FV.serverTimestamp() });
    out = { n, streak, bonus };
  });
  r.json(out);
}));
app.post('/api/points/all', h(async (q, r) => {
  const c = q.body.companyId; await own(q, c);
  const n = int(q.body.amount, 1, 1e6), why = (typeof q.body.reason === 'string' && q.body.reason.trim().slice(0, 40)) || '전체 지급';
  const ms = (await db.collection(`companies/${c}/members`).where('role', '==', 'staff').get()).docs;
  for (let i = 0; i < ms.length; i += 200) {
    const b = db.batch();
    ms.slice(i, i + 200).forEach(s => { const w = db.doc(`companies/${c}/wallets/${s.id}`); b.update(w, { points: FV.increment(n) }); b.set(w.collection('ledger').doc(), { n, why, at: FV.serverTimestamp() }); });
    await b.commit();
  }
  r.json({ count: ms.length });
}));
app.post('/api/orders/:c/:i/done', h(async (q, r) => { await own(q, q.params.c); await db.doc(`companies/${q.params.c}/orders/${q.params.i}`).update({ done: true }); r.json({ ok: 1 }); }));
app.delete('/api/staff/:c/:u', h(async (q, r) => {
  const { c, u } = q.params; await own(q, c);
  const ms = await db.doc(`companies/${c}/members/${u}`).get();
  if (!ms.exists || ms.data().role !== 'staff') throw E(404, '직원을 찾을 수 없어요');
  const b = db.batch(); b.delete(ms.ref); b.delete(db.doc(`companies/${c}/wallets/${u}`));
  const tid = ms.data().teamId;
  if (tid) { const tr = db.doc(`companies/${c}/teams/${tid}`), ts = await tr.get(); if (ts.exists) b.update(tr, { memberUids: FV.arrayRemove(u), ...(ts.data().leaderUid === u ? { leaderUid: '' } : {}) }); }
  await b.commit(); await auth.deleteUser(u).catch(() => {}); await db.doc('users/' + u).delete(); r.json({ ok: 1 });
}));
app.post('/api/staff/:c/:u/password', h(async (q, r) => {
  const { c, u } = q.params; await own(q, c); const pw = str(q.body.password, 64);
  if (pw.length < 6) throw E(400, '비밀번호는 6자 이상이에요');
  const ms = await db.doc(`companies/${c}/members/${u}`).get();
  if (!ms.exists || ms.data().role !== 'staff') throw E(404, '직원을 찾을 수 없어요');
  await auth.updateUser(u, { password: pw }); r.json({ ok: 1 });
}));
app.post('/api/teams/:c/:t/leader', h(async (q, r) => {
  const { c, t } = q.params; await own(q, c); const u = str(q.body.uid, 128), tr = db.doc(`companies/${c}/teams/${t}`), ts = await tr.get();
  if (!ts.exists || !ts.data().memberUids.includes(u)) throw E(400, '팀원만 팀장이 될 수 있어요');
  const b = db.batch(); b.update(tr, { leaderUid: u });
  ts.data().memberUids.forEach(m => b.update(db.doc(`companies/${c}/members/${m}`), { leader: m === u })); await b.commit(); r.json({ ok: 1 });
}));
app.delete('/api/teams/:c/:t', h(async (q, r) => {
  const { c, t } = q.params; await own(q, c); const tr = db.doc(`companies/${c}/teams/${t}`), ts = await tr.get();
  if (!ts.exists) throw E(404, '팀이 없어요');
  const b = db.batch(); ts.data().memberUids.forEach(m => b.update(db.doc(`companies/${c}/members/${m}`), { teamId: null, leader: false })); b.delete(tr); await b.commit(); r.json({ ok: 1 });
}));
app.post('/api/settings/company', h(async (q, r) => {
  const c = q.body.companyId; await own(q, c);
  await db.doc('companies/' + c).update({ name: str(q.body.name, 40), checkinPoints: int(q.body.checkinPoints, 0, 1000) }); r.json({ ok: 1 });
}));

app.listen(process.env.PORT || 4000, () => console.log('maru server on', process.env.PORT || 4000));
