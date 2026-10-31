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

/* ---------- tiny assert helper ---------- */
let failed = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "  ✅" : "  ❌"} ${name}${cond ? "" : "  " + extra}`);
  if (!cond) failed++;
}

const email = `test-${Date.now()}@example.com`;
const password = "correct-horse-battery-staple";
const c = new Client();
const authn = new SoftAuthenticator();

console.log("\n1. Password registration + session");
let r = await c.call("POST", "/auth/register", { email, username: "tester", password });
check("register -> 201", r.status === 201, JSON.stringify(r.data));
const userId = r.data.user?.id;
r = await c.call("GET", "/auth/me");
check("/me works with session cookie", r.status === 200 && r.data.user.email === email);
r = await c.call("POST", "/auth/register", { email, username: "tester", password });
check("duplicate email -> 409", r.status === 409);
r = await c.call("POST", "/auth/register", { email: "x@y.com", username: "ab", password: "short" });
check("weak input -> 400", r.status === 400);

console.log("\n2. Biometric (WebAuthn) registration");
r = await c.call("POST", "/auth/generate-registration-options", { attachment: "platform" });
check("registration options issued", r.status === 200 && r.data.challenge, JSON.stringify(r.data));
const regOptions = r.data;
const userHandle = regOptions.user.id;
const attestation = authn.create(regOptions);
r = await c.call("POST", "/auth/verify-registration", { response: attestation, deviceName: "Soft Windows Hello" });
check("verify-registration -> 201", r.status === 201 && r.data.verified, JSON.stringify(r.data));
check("MFA auto-enabled with first device", r.data.mfaEnabled === true);
r = await c.call("POST", "/auth/verify-registration", { response: attestation });
check("replaying the registration is rejected", r.status === 400);
r = await c.call("POST", "/auth/generate-registration-options", {});
r = await c.call("POST", "/auth/verify-registration", { response: authn.create(r.data) });
check("registering the same authenticator twice -> 409", r.status === 409, JSON.stringify(r.data));

console.log("\n3. Password login now requires the biometric step");
await c.call("POST", "/auth/logout");
r = await c.call("GET", "/auth/me");
check("logged out -> /me 401", r.status === 401);
r = await c.call("POST", "/auth/login", { email, password });
check("password OK -> mfaRequired", r.status === 200 && r.data.mfaRequired === true, JSON.stringify(r.data));
r = await c.call("GET", "/auth/me");
check("pending state is NOT a full session", r.status === 401);
r = await c.call("POST", "/auth/generate-authentication-options", { mode: "mfa" });
check("mfa auth options issued", r.status === 200 && r.data.allowCredentials?.length === 1, JSON.stringify(r.data));
const mfaOptions = r.data;
const assertion = authn.get(mfaOptions);
r = await c.call("POST", "/auth/verify-authentication", { response: assertion });
check("verify-authentication -> session", r.status === 200 && r.data.session?.method === "password+biometric", JSON.stringify(r.data));
r = await c.call("GET", "/auth/me");
check("/me works after biometric step", r.status === 200 && r.data.session.method === "password+biometric");
r = await c.call("POST", "/auth/verify-authentication", { response: assertion });
check("replaying the same assertion is rejected", r.status === 400);

console.log("\n4. Biometric-only sign-in");
await c.call("POST", "/auth/logout");
r = await c.call("POST", "/auth/generate-authentication-options", { mode: "quick", email });
let a = authn.get(r.data);
r = await c.call("POST", "/auth/verify-authentication", { response: a });
check("quick login by email -> biometric session", r.status === 200 && r.data.session?.method === "biometric", JSON.stringify(r.data));
await c.call("POST", "/auth/logout");
r = await c.call("POST", "/auth/generate-authentication-options", { mode: "discoverable" });
check("discoverable options have no allowCredentials", !r.data.allowCredentials?.length);
a = authn.get(r.data, userHandle);
r = await c.call("POST", "/auth/verify-authentication", { response: a });
check("passkey (no email) login works", r.status === 200 && r.data.verified, JSON.stringify(r.data));
await c.call("POST", "/auth/logout");

r = await c.call("POST", "/auth/generate-authentication-options", { mode: "quick", email: "nobody@example.com" });
check("unknown email gets decoy options (no enumeration)", r.status === 200 && r.data.allowCredentials?.length === 1);
r = await c.call("POST", "/auth/verify-authentication", { response: authn.get(r.data) });
check("decoy ceremony fails generically", r.status === 401 && r.data.error === "Biometric verification failed");

r = await c.call("POST", "/auth/generate-authentication-options", { mode: "quick", email });
r = await c.call("POST", "/auth/verify-authentication", { response: authn.get(r.data, null, { uv: false }) });
check("assertion WITHOUT user verification rejected", r.status === 401, JSON.stringify(r.data));

r = await c.call("POST", "/auth/generate-authentication-options", { mode: "mfa" });
check("mfa options without password step -> 401", r.status === 401);

console.log("\n5. Dashboard APIs");
r = await c.call("POST", "/auth/generate-authentication-options", { mode: "quick", email });
r = await c.call("POST", "/auth/verify-authentication", { response: authn.get(r.data) });
const deviceId = b64u(authn.credId);
r = await c.call("GET", "/devices");
check("list devices", r.status === 200 && r.data.devices.length === 1 && r.data.devices[0].lastUsedAt, JSON.stringify(r.data));
r = await c.call("PATCH", `/devices/${deviceId}`, { name: "Work laptop" });
check("rename device", r.status === 200 && r.data.device.name === "Work laptop");
r = await c.call("PATCH", "/mfa", { enabled: false });
check("disable MFA without password -> 403", r.status === 403);
r = await c.call("PATCH", "/mfa", { enabled: false, password });
check("disable MFA with password", r.status === 200 && r.data.mfaEnabled === false);
r = await c.call("PATCH", "/mfa", { enabled: true });
check("re-enable MFA (device exists)", r.status === 200 && r.data.mfaEnabled === true);
r = await c.call("GET", "/logs?limit=50");
const events = r.data.logs?.map((l) => l.event) ?? [];
check("audit log has key events", ["register_success", "biometric_register_success", "biometric_login_success", "mfa_disabled", "mfa_enabled"].every((e) => events.includes(e)), events.join(","));
check("audit log has failures + stats", events.includes("biometric_login_failed") && r.data.stats.failed30d > 0);
r = await c.call("DELETE", `/devices/${deviceId}`, { password: "wrong-password-123" });
check("remove device with wrong password -> 403", r.status === 403);

console.log("\n6. Risk scoring + lockout");
const other = new Client();
other.ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/130.0";
r = await other.call("POST", "/auth/login", { email, password });
check("login from new browser/OS on MFA account -> mfa step", r.data.mfaRequired === true);
check("risk flags the new browser/OS", r.data.risk.reasons.some((x) => /new browser/i.test(x)), JSON.stringify(r.data.risk));

const victim = new Client();
const email2 = `lock-${Date.now()}@example.com`;
await victim.call("POST", "/auth/register", { email: email2, username: "locktest", password });
await victim.call("POST", "/auth/logout");
let last;
for (let i = 0; i < 5; i++) last = await victim.call("POST", "/auth/login", { email: email2, password: "wrong-wrong-wrong" });
check("5th wrong password locks the account (423)", last.status === 423, JSON.stringify(last.data));
r = await victim.call("POST", "/auth/login", { email: email2, password });
check("correct password still refused while locked", r.status === 423);

console.log("\n7. Remove device + cookies");
r = await c.call("DELETE", `/devices/${deviceId}`, { password });
check("remove last device (correct password) -> MFA auto-off", r.status === 200 && r.data.mfaEnabled === false, JSON.stringify(r.data));
r = await c.call("PATCH", "/mfa", { enabled: true });
check("cannot enable MFA with no devices", r.status === 400);

console.log(failed ? `\n❌ ${failed} check(s) failed\n` : "\n🎉 All backend checks passed\n");
process.exit(failed ? 1 : 0);
