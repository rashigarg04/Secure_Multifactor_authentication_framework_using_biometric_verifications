import { api } from "./api.js";

const multipart = { headers: { "Content-Type": "multipart/form-data" } };

function asForm(file, extra = {}) {
  const form = new FormData();
  form.append("image", file); // the backend reads the field called "image"
  for (const [key, value] of Object.entries(extra)) form.append(key, String(value));
  return form;
}

export const retinaApi = {
  status: () => api.get("/retina").then((r) => r.data),
  enroll: (file, consent) => api.post("/retina/enroll", asForm(file, { consent }), multipart).then((r) => r.data),
  verify: (file) => api.post("/retina/verify", asForm(file), multipart).then((r) => r.data),
  remove: (password) => api.delete("/retina", { data: { password } }).then((r) => r.data),
};
