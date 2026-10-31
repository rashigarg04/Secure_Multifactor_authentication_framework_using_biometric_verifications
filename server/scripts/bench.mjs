/**
 * End-to-end smoke test for the backend. No browser needed:
 * a software authenticator (ES256) plays the role of Windows Hello / Touch ID.
 *
 * Run (server must be running):  node scripts/smoke-test.mjs
 */
import crypto from "node:crypto";

const API = process.env.API_URL || "http://localhost:4000/api";
const ORIGIN = process.env.ORIGIN || "http://localhost:5173";
const RP_ID = process.env.RP_ID || "localhost";

/* ---------- tiny CBOR encoder (just what an attestation object needs) ---------- */
function head(major, n) {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) return Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
  throw new Error("too big");
}
function cbor(v) {
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v]);
  if (typeof v === "string") {
    const b = Buffer.from(v);
    return Buffer.concat([head(3, b.length), b]);
  }
  if (typeof v === "number") return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (v instanceof Map)
    return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  if (typeof v === "object")
    return cbor(new Map(Object.entries(v)));
  throw new Error("unsupported");
}
const b64u = (b) => Buffer.from(b).toString("base64url");
const sha256 = (b) => crypto.createHash("sha256").update(b).digest();

/* ---------- software authenticator ---------- */
class SoftAuthenticator {
  constructor() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = privateKey;
    this.jwk = publicKey.export({ format: "jwk" });
    this.credId = crypto.randomBytes(32);
    this.counter = 0;
  }
  clientData(type, challenge) {
    return Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }));
  }
  create(options) {
    const cose = cbor(
      new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(this.jwk.x, "base64url")], [-3, Buffer.from(this.jwk.y, "base64url")]])
    );
    const credLen = Buffer.alloc(2);
    credLen.writeUInt16BE(this.credId.length);
    const authData = Buffer.concat([
      sha256(RP_ID), Buffer.from([0x45]), Buffer.alloc(4), // UP + UV + AT, counter 0
      Buffer.alloc(16), credLen, this.credId, cose,
    ]);
    const attestationObject = cbor({ fmt: "none", attStmt: new Map(), authData });
    return {
      id: b64u(this.credId), rawId: b64u(this.credId), type: "public-key",
      response: {
        clientDataJSON: b64u(this.clientData("webauthn.create", options.challenge)),
        attestationObject: b64u(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {}, authenticatorAttachment: "platform",
    };
  }
  get(options, userHandle, { uv = true } = {}) {
    this.counter += 1;
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.counter);
    const authData = Buffer.concat([sha256(RP_ID), Buffer.from([uv ? 0x05 : 0x01]), counter]);
    const clientDataJSON = this.clientData("webauthn.get", options.challenge);
    const signature = crypto.sign("sha256", Buffer.concat([authData, sha256(clientDataJSON)]), this.privateKey);
    return {
      id: b64u(this.credId), rawId: b64u(this.credId), type: "public-key",
      response: {
        clientDataJSON: b64u(clientDataJSON), authenticatorData: b64u(authData),
        signature: b64u(signature), ...(userHandle ? { userHandle } : {}),
      },
      clientExtensionResults: {}, authenticatorAttachment: "platform",
    };
  }
}

/* ---------- HTTP client with a cookie jar ---------- */
class Client {
  jar = new Map();
  async call(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "),
        "User-Agent": this.ua || "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split("; ");
      const [k, v] = pair.split("=");
      const expired = attrs.some((a) => /^Expires=.*1970/i.test(a)) || v === "";
      expired ? this.jar.delete(k) : this.jar.set(k, v);
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }
}


const N = 30;
const stats = (a) => { const s=[...a].sort((x,y)=>x-y); const q=(p)=>s[Math.min(s.length-1,Math.floor(p*s.length))]; return {n:s.length, mean:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1), p50:+q(.5).toFixed(1), p95:+q(.95).toFixed(1), min:+s[0].toFixed(1), max:+s[s.length-1].toFixed(1)}; };
const time = async (fn) => { const t=performance.now(); const r=await fn(); return [performance.now()-t, r]; };
const out = {};
const c = new Client();
const email = `bench-${Date.now()}@example.com`, password = "correct-horse-battery-staple";

let arr=[]; for (let i=0;i<N;i++) arr.push((await time(()=>c.call("GET","/health")))[0]); out["GET /health"]=stats(arr);
let t,r;
[t,r]=await time(()=>c.call("POST","/auth/register",{email,username:"bench",password})); out["POST /auth/register (bcrypt hash, 1 sample)"]={n:1,mean:+t.toFixed(1)};
arr=[]; for (let i=0;i<N;i++) arr.push((await time(()=>c.call("GET","/auth/me")))[0]); out["GET /auth/me (JWT + DB lookup)"]=stats(arr);
arr=[]; for (let i=0;i<10;i++) { const [tt]=await time(()=>c.call("POST","/auth/login",{email,password})); arr.push(tt);} out["POST /auth/login (bcrypt compare + risk score)"]=stats(arr);
const authn = new SoftAuthenticator();
let g=[],v=[];
r=await c.call("POST","/auth/generate-registration-options",{attachment:"platform"});
const reg=authn.create(r.data); [t]=await time(()=>c.call("POST","/auth/verify-registration",{response:reg,deviceName:"bench"})); out["POST /auth/verify-registration (1 sample)"]={n:1,mean:+t.toFixed(1)};
for (let i=0;i<N;i++){ const [tg,ro]=await time(()=>c.call("POST","/auth/generate-authentication-options",{mode:"quick",email})); g.push(tg); const a=authn.get(ro.data); const [tv,rv]=await time(()=>c.call("POST","/auth/verify-authentication",{response:a})); v.push(tv); if(rv.status!==200) throw new Error("verify failed "+JSON.stringify(rv.data)); }
out["POST /auth/generate-authentication-options"]=stats(g);
out["POST /auth/verify-authentication (signature check + session)"]=stats(v);
arr=[]; for (let i=0;i<N;i++) arr.push((await time(()=>c.call("GET","/logs?limit=50")))[0]); out["GET /logs?limit=50"]=stats(arr);
// concurrency: 50 parallel /auth/me
const t0=performance.now(); await Promise.all(Array.from({length:50},()=>c.call("GET","/auth/me"))); const dt=performance.now()-t0; out["50 parallel GET /auth/me"]={totalMs:+dt.toFixed(0), reqPerSec:+(50/(dt/1000)).toFixed(0)};
console.log(JSON.stringify(out,null,1));
