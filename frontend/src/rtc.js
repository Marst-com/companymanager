// Firestore 시그널링 + WebRTC 메시. 음성은 전원 연결, 화면은 발표자 1명만 송출.
import { collection, doc, setDoc, deleteDoc, addDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
const e = import.meta.env;
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...(e.VITE_TURN_URL ? [{ urls: e.VITE_TURN_URL, username: e.VITE_TURN_USER, credential: e.VITE_TURN_PASS }] : [])] };

export class Room {
  constructor(cid, mid, uid, name, cb) {
    Object.assign(this, { uid, name, cb, pcs: {}, unsubs: [], screen: null, mic: null, base: `companies/${cid}/meetings/${mid}` });
  }
  async join() {
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const peers = collection(db, this.base, 'peers');
    await setDoc(doc(peers, this.uid), { name: this.name, at: serverTimestamp() });
    let first = true;
    this.unsubs.push(onSnapshot(peers, s => {
      this.cb.peers(s.docs.map(d => ({ uid: d.id, ...d.data() })));
      s.docChanges().forEach(c => {
        if (c.doc.id === this.uid) return;
        if (c.type === 'removed') this.drop(c.doc.id);
        else if (c.type === 'added' && first) this.offer(c.doc.id); // 먼저 와 있던 사람에게 내가 offer
      });
      first = false;
    }));
    this.unsubs.push(onSnapshot(query(collection(db, this.base, 'signals'), where('to', '==', this.uid)), s =>
      s.docChanges().forEach(c => { if (c.type === 'added') { deleteDoc(c.doc.ref); this.onSignal(c.doc.data()).catch(console.warn); } })));
  }
  send(to, p) { return addDoc(collection(db, this.base, 'signals'), { from: this.uid, to, ...p }); }
  mk(id) {
    if (this.pcs[id]) return this.pcs[id];
    const pc = new RTCPeerConnection(ICE); pc.cands = []; this.pcs[id] = pc;
    this.mic.getTracks().forEach(t => pc.addTrack(t, this.mic));
    pc.vt = pc.addTransceiver('video', { direction: 'recvonly' });
    pc.onicecandidate = ev => ev.candidate && this.send(id, { k: 'ice', v: ev.candidate.toJSON() });
    pc.ontrack = ev => this.cb.track(id, ev.track, ev.streams[0]);
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') pc.restartIce?.(); };
    this.applyScreen(pc);
    return pc;
  }
  applyScreen(pc) {
    const t = this.screen?.getVideoTracks()[0] || null;
    pc.vt.sender.replaceTrack(t).catch(() => {});
    pc.vt.direction = t ? 'sendonly' : 'recvonly';
  }
  async offer(id) {
    const pc = this.mk(id);
    await pc.setLocalDescription(await pc.createOffer());
    await this.send(id, { k: 'sdp', v: pc.localDescription.toJSON() });
  }
  async onSignal(d) {
    const id = d.from, pc = this.mk(id);
    if (d.k === 'sdp') {
      if (d.v.type === 'offer') {
        if (pc.signalingState !== 'stable') { if (this.uid < id) return; await pc.setLocalDescription({ type: 'rollback' }); }
        await pc.setRemoteDescription(d.v);
        this.applyScreen(pc);
        await pc.setLocalDescription(await pc.createAnswer());
        await this.send(id, { k: 'sdp', v: pc.localDescription.toJSON() });
      } else await pc.setRemoteDescription(d.v);
      for (const c of pc.cands.splice(0)) await pc.addIceCandidate(c).catch(() => {});
    } else if (pc.remoteDescription) await pc.addIceCandidate(d.v).catch(() => {});
    else pc.cands.push(d.v);
  }
  async share(on) {
    if (on) {
      this.screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: { max: 1280 } } });
      this.screen.getVideoTracks()[0].onended = () => { this.share(false); this.cb.shareEnded?.(); };
    } else { this.screen?.getTracks().forEach(t => t.stop()); this.screen = null; }
    for (const [id, pc] of Object.entries(this.pcs)) {
      this.applyScreen(pc); await this.offer(id);
      if (on) { const p = pc.vt.sender.getParameters(); p.encodings = [{ ...(p.encodings?.[0] || {}), maxBitrate: +e.VITE_SHARE_KBPS * 1000 || 1000000 }]; pc.vt.sender.setParameters(p).catch(() => {}); }
    }
  }
  setState(p) { return setDoc(doc(db, this.base, 'peers', this.uid), p, { merge: true }); }
  setMuted(m) { this.mic?.getAudioTracks().forEach(t => (t.enabled = !m)); }
  drop(id) { this.pcs[id]?.close(); delete this.pcs[id]; this.cb.drop(id); }
  leave() {
    this.unsubs.forEach(f => f()); Object.keys(this.pcs).forEach(id => this.drop(id));
    this.mic?.getTracks().forEach(t => t.stop()); this.screen?.getTracks().forEach(t => t.stop());
    deleteDoc(doc(db, this.base, 'peers', this.uid)).catch(() => {});
  }
}
