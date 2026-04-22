import crypto from "crypto";

const SALT = "manuskripta_2024_v1";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + SALT).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
