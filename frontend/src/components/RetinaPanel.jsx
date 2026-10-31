import { Eye, Loader2, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "../services/api.js";
import { retinaApi } from "../services/retina.js";
import { formatDateTime, timeAgo } from "../utils/format.js";
import Alert from "./Alert.jsx";

/**
 * Retina enrolment and status (prototype).
 * Works with retinal (fundus) photographs: a phone or webcam cannot scan a retina.
 */
export default function RetinaPanel({ status, onEnrolled, onRemove }) {
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // Show the chosen photo, and free the browser memory when it changes
  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function enrol(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await retinaApi.enroll(file, consent);
      setResult(data);
      setFile(null);
      setConsent(false);
      await onEnrolled?.(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!status.available) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
          <Eye className="h-5 w-5 text-slate-500" /> Retina verification
        </h2>
        <p className="text-sm text-slate-400">Not enabled on this server. Start the retina service and set RETINA_SERVICE_URL to turn it on.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <Eye className="h-5 w-5 text-emerald-400" /> Retina verification
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">Prototype</span>
      </h2>

      {status.enrolled ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            A retina is enrolled{status.enrolledAt && <> since {formatDateTime(status.enrolledAt)}</>}.{" "}
            {status.lastVerifiedAt ? `Last used ${timeAgo(status.lastVerifiedAt)}.` : "Not used to sign in yet."}
          </p>
          {result?.preview && (
            <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <img src={result.preview} alt="Extracted blood-vessel pattern" className="h-28 w-28 rounded-lg bg-black" />
              <div className="text-xs text-slate-400">
                <p className="mb-1 font-medium text-slate-200">Vessel pattern extracted</p>
                <p>Vessel density {(result.quality.vessel_density * 100).toFixed(1)}%</p>
                <p>Sharpness {result.quality.sharpness}</p>
                <p className="mt-1 text-slate-500">Only this pattern is kept, encrypted. Your photo is discarded.</p>
              </div>
            </div>
          )}
          <Alert type="success">{result ? "Retina enrolled. MFA is on." : ""}</Alert>
          <button onClick={onRemove} className="flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" /> Delete retina template
          </button>
        </div>
      ) : (
        <form onSubmit={enrol} className="space-y-4">
          <p className="text-sm text-slate-400">
            Upload a colour photograph of a retina (fundus image, JPEG or PNG, up to 5 MB, with its dark border). The server keeps only an
            encrypted blood-vessel pattern, not the photo.
          </p>

          <Alert type="warning">
            A phone or webcam cannot scan a retina; real retinal scanners are specialised devices. This prototype works on fundus photographs
            and cannot tell a live eye from a saved picture.
          </Alert>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-600 p-4 hover:border-emerald-500">
            <Upload className="h-5 w-5 text-emerald-400" />
            <span className="text-sm">{file ? file.name : "Choose a retinal photograph"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              aria-label="Retinal photograph"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError("");
              }}
            />
          </label>

          {preview && <img src={preview} alt="Selected retinal photograph" className="h-40 rounded-lg border border-slate-800 object-contain" />}

          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-emerald-500" />
            <span>
              I consent to storing an <strong>encrypted blood-vessel pattern</strong> from this photograph for sign-in. The photograph itself is not
              kept, and I can delete the pattern at any time from this page.
            </span>
          </label>

          <Alert type="error">{error}</Alert>

          <button
            disabled={busy || !file || !consent}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            {busy ? "Analysing blood vessels…" : "Enrol retina"}
          </button>
        </form>
      )}
    </section>
  );
}
