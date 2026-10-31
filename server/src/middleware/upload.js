import multer from "multer";
import { HttpError } from "../utils/httpError.js";

const ALLOWED = new Set(["image/jpeg", "image/png"]);

// Images are kept in memory only, sent to the retina service, and never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4 },
  fileFilter(_req, file, cb) {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(new HttpError(415, "Only JPEG or PNG images are accepted."));
  },
});

/** Expects one file in the form field "image" (available as req.file). */
export const retinaUpload = upload.single("image");
