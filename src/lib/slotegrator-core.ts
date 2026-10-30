// Server-only helpers. Read secrets from process.env inside functions; never import from components.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildSignString, hmacSha1Hex } from "./slotegrator-shared";

export function slotegratorConfig() {
  const merchantId = process.env["SLOTEGRATOR_MERCHANT_ID"];
  const merchantKey = process.env["SLOTEGRATOR_MERCHANT_KEY"];
  const apiUrl = process.env["SLOTEGRATOR_API_URL"]?.replace(/\/+$/, "");
  const currency = process.env["SLOTEGRATOR_CURRENCY"] || "USD";
  if (!merchantId || !merchantKey || !apiUrl) return null;
  return { merchantId, merchantKey, apiUrl, currency };
}

export async function signedHeaders(
  cfg: { merchantId: string; merchantKey: string },
  params: Record<string, string>,
) {
  const headers: Record<string, string> = {
    "X-Merchant-Id": cfg.merchantId,
    "X-Timestamp": String(Math.floor(Date.now() / 1000)),
    "X-Nonce": crypto.randomUUID().replace(/-/g, ""),
  };
  headers["X-Sign"] = await hmacSha1Hex(cfg.merchantKey, buildSignString({ ...params, ...headers }));
  return headers;
}

/** Signed call to Slotegrator. Returns status + parsed body (or text). */
export async function slotegratorRequest(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string> = {},
) {
  const cfg = slotegratorConfig();
  if (!cfg) return { ok: false, status: 0, body: { error: "config_missing" } as unknown };
  const headers = await signedHeaders(cfg, params);
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(
      method === "GET" ? `${cfg.apiUrl}${path}${qs ? `?${qs}` : ""}` : `${cfg.apiUrl}${path}`,
      {
        method,
        headers: {
          ...headers,
          Accept: "application/json",
          ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: method === "POST" ? qs : undefined,
      },
    );
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 500);
    }
    return { ok: res.ok, status: res.status, body, headers: res.headers };
  } catch (e) {
    return { ok: false, status: 0, body: { error: "network", message: String(e) } as unknown };
  }
}

/** Publishable-key client for calling secret-protected wallet functions from the server. */
export function walletDb() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Database settings missing");
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export function walletSecret() {
  const s = process.env["WALLET_RPC_SECRET"];
  if (!s) throw new Error("WALLET_RPC_SECRET missing");
  return s;
}
