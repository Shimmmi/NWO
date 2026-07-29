import type { SessionPayload } from "./auth-constants";

function base64UrlDecode(token: string): string {
  const padded =
    token + "=".repeat((4 - (token.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "hex"))
    .join("");
}

/** Edge-compatible session verification (middleware). */
export async function verifySessionEdge(
  token: string
): Promise<SessionPayload | null> {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret) return null;
  try {
    const decoded = base64UrlDecode(token);
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;
    const data = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const raw = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(data)
    );
    const expected = bytesToHex(raw);
    if (sig.length !== expected.length) return null;
    let mismatch = 0;
    for (let i = 0; i < sig.length; i++) {
      mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (mismatch !== 0) return null;
    const payload = JSON.parse(data) as SessionPayload & { exp: number };
    if (payload.exp < Date.now()) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      nickname: payload.nickname,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
