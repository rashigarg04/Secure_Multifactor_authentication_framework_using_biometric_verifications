import { env } from "../config/env.js";
import { HttpError } from "./httpError.js";

/** POST an image (and optional form fields) to the Python retina service. */
async function post(path, file, fields = {}) {
  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.mimetype }), "retina-image");
  for (const [name, value] of Object.entries(fields)) form.append(name, value);

  let res;
  try {
    res = await fetch(`${env.RETINA_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "X-Service-Key": env.RETINA_SERVICE_KEY },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(503, "The retina service is unavailable. Please try again later.");
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body;

  const detail = body.detail ?? {};
  if (res.status === 422) {
    // The image itself is the problem (blurry, not a retina...): safe to show the user.
    throw new HttpError(422, detail.message || "That image could not be used.", { code: detail.code });
  }
  if (res.status === 413) throw new HttpError(413, "Image is larger than 5 MB.");
  console.error("retina service error:", res.status, detail);
  throw new HttpError(502, "The retina service returned an error.");
}

/** Image -> { template_b64, preview_b64, quality } */
export const extractTemplate = (file) => post("/extract", file);

/** Probe image + stored template (Buffer) -> { score, quality } */
export const matchProbe = (file, template) =>
  post("/match", file, { template_b64: template.toString("base64") });
