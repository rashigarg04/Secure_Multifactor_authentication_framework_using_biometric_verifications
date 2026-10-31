import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().default(""),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .refine((v) => v !== "change-me", "JWT_SECRET is still the placeholder value"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  MFA_PENDING_EXPIRES_IN: z.string().default("5m"),

  RP_ID: z.string().min(1, "RP_ID is required (e.g. localhost)"),
  RP_NAME: z.string().default("Secure MFA Framework"),
  ORIGIN: z.url("ORIGIN must be a full URL, e.g. http://localhost:5173"),

  CLIENT_URL: z.url("CLIENT_URL must be a full URL"),

  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  // Set to 1 when running behind a reverse proxy / load balancer (Nginx, Render, Heroku...)
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // Retina verification (optional). Leave RETINA_SERVICE_URL empty to switch it off.
  RETINA_SERVICE_URL: z.string().default(""),
  RETINA_SERVICE_KEY: z.string().default(""),
  // 64 hex characters = 32 bytes, used to encrypt stored retina templates (AES-256-GCM)
  RETINA_TEMPLATE_KEY: z.string().default(""),
  RETINA_THRESHOLD: z.coerce.number().min(0.2).max(0.95).default(0.5),
}).superRefine((v, ctx) => {
  if (!v.RETINA_SERVICE_URL) return;
  if (v.RETINA_SERVICE_KEY.length < 16) {
    ctx.addIssue({ code: "custom", path: ["RETINA_SERVICE_KEY"], message: "must be at least 16 characters when retina is enabled" });
  }
  if (!/^[0-9a-fA-F]{64}$/.test(v.RETINA_TEMPLATE_KEY)) {
    ctx.addIssue({ code: "custom", path: ["RETINA_TEMPLATE_KEY"], message: "must be 64 hex characters when retina is enabled" });
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("\n❌ Invalid environment configuration (server/.env):");
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  console.error("\nTip: copy .env.example to .env and set JWT_SECRET.\n");
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  retinaEnabled: Boolean(parsed.data.RETINA_SERVICE_URL),
};
