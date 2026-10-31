/**
 * End-to-end test of the retina module: Node API + Python retina service + MongoDB.
 * Start all three first, then:   node scripts/retina-smoke-test.mjs
 * Sample images come from:       python make_test_images.py ../server/scripts/retina-samples
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.API_URL || "http://localhost:4000/api";
const DIR = process.env.SAMPLES || path.join(path.dirname(fileURLToPath(import.meta.url)), "retina-samples");
const img = (name) => new Blob([fs.readFileSync(path.join(DIR, name))], { type: "image/jpeg" });

class Client {
  jar = new Map();
  async call(method, url, { json, file, headers = {} } = {}) {
    let body;
    if (json) { body = JSON.stringify(json); headers["Content-Type"] = "application/json"; }
    if (file) {
      body = new FormData();
      body.append("image", file.blob, file.name || "eye.jpg");
      if (file.consent) body.append("consent", "true");
    }
    const res = await fetch(API + url, {
      method, body,
      headers: { Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "), ...headers },
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split("; "); const [k, v] = pair.split("=");
      (attrs.some((a) => /^Expires=.*1970/i.test(a)) || v === "") ? this.jar.delete(k) : this.jar.set(k, v);
    }
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
}

let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "  ✅" : "  ❌"} ${name}${ok ? "" : "  " + extra}`); if (!ok) failed++; };
const email = `retina-${Date.now()}@example.com`, password = "correct-horse-battery-staple";
const c = new Client();
let r;

console.log("\n1. Account and status");
r = await c.call("POST", "/auth/register", { json: { email, username: "retinatest", password } });
check("register", r.status === 201, JSON.stringify(r.data));
r = await c.call("GET", "/retina");
check("retina feature available, nothing enrolled", r.status === 200 && r.data.available === true && r.data.enrolled === false, JSON.stringify(r.data));

console.log("\n2. Enrolment gates");
r = await c.call("POST", "/retina/enroll", { file: { blob: img("not_a_retina.jpg"), consent: true } });
check("a photo that is not a retina is refused (422)", r.status === 422, JSON.stringify(r.data));
r = await c.call("POST", "/retina/enroll", { file: { blob: img("blurry_eye.jpg"), consent: true } });
check("a blurry retina is refused (422)", r.status === 422, JSON.stringify(r.data));
r = await c.call("POST", "/retina/enroll", { file: { blob: new Blob(["GIF89a"], { type: "image/gif" }), consent: true } });
check("a GIF is refused (415)", r.status === 415, JSON.stringify(r.data));
r = await c.call("POST", "/retina/enroll", { file: { blob: new Blob([Buffer.alloc(5.2 * 1024 * 1024)], { type: "image/jpeg" }), consent: true } });
check("an over-size file is refused (413)", r.status === 413, JSON.stringify(r.data));
r = await c.call("POST", "/retina/enroll", {});
check("no file is refused (400)", r.status === 400);
r = await c.call("POST", "/retina/enroll", { file: { blob: img("enrol_eye.jpg") } });
check("a good retina WITHOUT consent is refused (400)", r.status === 400 && /consent/i.test(r.data.error), JSON.stringify(r.data));
r = await c.call("GET", "/retina");
check("failed enrolments leave nothing stored", r.data.enrolled === false);

console.log("\n3. Enrol a real retina");
r = await c.call("POST", "/retina/enroll", { file: { blob: img("enrol_eye.jpg"), consent: true } });
check("enrol -> 201 with MFA switched on", r.status === 201 && r.data.enrolled && r.data.mfaEnabled, JSON.stringify(r.data).slice(0, 200));
check("response carries a vessel-pattern preview and quality figures", r.data.preview?.startsWith("data:image/png;base64,") && r.data.quality?.vessel_density > 0);
r = await c.call("POST", "/retina/enroll", { file: { blob: img("enrol_eye.jpg"), consent: true } });
check("enrolling twice is refused (409)", r.status === 409);
r = await c.call("GET", "/auth/me");
check("user now reports retinaEnrolled", r.data.user?.retinaEnrolled === true && r.data.user?.mfaEnabled === true);

console.log("\n4. Password + retina sign-in");
await c.call("POST", "/auth/logout");
r = await c.call("POST", "/retina/verify", { file: { blob: img("same_eye_recaptured.jpg") } });
check("verify without the password step -> 401", r.status === 401);
r = await c.call("POST", "/auth/login", { json: { email, password } });
check("password OK -> retina step required", r.data.mfaRequired === true && r.data.methods?.retina === true && r.data.methods?.webauthn === false, JSON.stringify(r.data));
r = await c.call("GET", "/auth/me");
check("pending state is not a full session", r.status === 401);
r = await c.call("POST", "/retina/verify", { file: { blob: img("different_eye.jpg") } });
check("a DIFFERENT eye is rejected (401)", r.status === 401 && r.data.error === "Retina verification failed", JSON.stringify(r.data));
const wrongScore = r.data.score;
r = await c.call("POST", "/retina/verify", { file: { blob: img("not_a_retina.jpg") } });
check("a non-retina photo is rejected (422) and does not count as a guess", r.status === 422);
r = await c.call("POST", "/retina/verify", { file: { blob: img("same_eye_recaptured.jpg") } });
check("the SAME eye, photographed again, is accepted", r.status === 200 && r.data.session?.method === "password+retina", JSON.stringify(r.data));
console.log(`     (scores: same eye ${r.data.score}, different eye ${wrongScore}, threshold ${r.data.threshold})`);
r = await c.call("GET", "/auth/me");
check("full session after retina step", r.status === 200 && r.data.session.method === "password+retina");

console.log("\n5. Lockout on repeated wrong eyes");
await c.call("POST", "/auth/logout");
await c.call("POST", "/auth/login", { json: { email, password } });
let last;
for (let i = 0; i < 5; i++) last = await c.call("POST", "/retina/verify", { file: { blob: img("different_eye.jpg") } });
check("5 wrong eyes lock the account (423)", last.status === 423, JSON.stringify(last.data));
r = await c.call("POST", "/auth/login", { json: { email, password } });
check("correct password is refused while locked", r.status === 423);

console.log("\n6. Dashboard rules (fresh account)");
const d = new Client();
const email2 = `retina2-${Date.now()}@example.com`;
await d.call("POST", "/auth/register", { json: { email: email2, username: "retinatest2", password } });
await d.call("POST", "/retina/enroll", { file: { blob: img("enrol_eye.jpg"), consent: true } });
r = await d.call("DELETE", "/retina", { json: { password: "wrong-password-123" } });
check("remove retina with the wrong password -> 403", r.status === 403);
r = await d.call("PATCH", "/mfa", { json: { enabled: false, password } });
check("MFA can be switched off with the password", r.status === 200 && r.data.mfaEnabled === false);
r = await d.call("PATCH", "/mfa", { json: { enabled: true } });
check("MFA can be switched on again (retina counts as a factor)", r.status === 200 && r.data.mfaEnabled === true);
r = await d.call("DELETE", "/retina", { json: { password } });
check("remove retina with the right password", r.status === 200 && r.data.mfaEnabled === false, JSON.stringify(r.data));
r = await d.call("GET", "/retina");
check("template is gone", r.data.enrolled === false);
r = await d.call("POST", "/auth/logout"); r = await d.call("POST", "/auth/login", { json: { email: email2, password } });
check("password-only sign-in works again", r.data.mfaRequired === false);
r = await d.call("GET", "/logs?limit=50");
const events = r.data.logs.map((l) => l.event);
check("audit log has the retina events", ["retina_enroll_success", "retina_removed", "mfa_disabled", "mfa_enabled"].every((e) => events.includes(e)), events.join(","));
r = await c.call("POST", "/auth/login", { json: { email, password } }); // locked account, to read its log we need a session: skip

console.log(failed ? `\n❌ ${failed} check(s) failed\n` : "\n🎉 All retina checks passed\n");
process.exit(failed ? 1 : 0);
