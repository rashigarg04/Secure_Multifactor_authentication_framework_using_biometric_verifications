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
};