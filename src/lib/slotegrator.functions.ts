import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildSignString, type SlotegratorGame } from "./slotegrator-shared";

async function hmacSha1Hex(key: string, message: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const listGames = createServerFn({ method: "GET" })
  .inputValidator((input: { page: number }) =>
    z.object({ page: z.number().int().min(1).max(10000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const merchantId = process.env["SLOTEGRATOR_MERCHANT_ID"];
    const merchantKey = process.env["SLOTEGRATOR_MERCHANT_KEY"];
    const apiUrl = process.env["SLOTEGRATOR_API_URL"];
    if (!merchantId || !merchantKey || !apiUrl) {
      return { ok: false as const, error: "config", games: [], pageCount: 0, total: 0 };
    }
    const params = { page: String(data.page) };
    const headers: Record<string, string> = {
      "X-Merchant-Id": merchantId,
      "X-Timestamp": String(Math.floor(Date.now() / 1000)),
      "X-Nonce": crypto.randomUUID().replace(/-/g, ""),
    };
    headers["X-Sign"] = await hmacSha1Hex(merchantKey, buildSignString({ ...params, ...headers }));
    try {
      const res = await fetch(`${apiUrl}/games?${new URLSearchParams(params)}`, {
        headers: { ...headers, Accept: "application/json" },
      });
      if (!res.ok) {
        console.error("Slotegrator /games failed", res.status);
        return { ok: false as const, error: `http_${res.status}`, games: [], pageCount: 0, total: 0 };
      }
      const body = (await res.json()) as {
        items?: SlotegratorGame[];
        _meta?: { pageCount?: number; totalCount?: number };
      };
      return {
        ok: true as const,
        error: null,
        games: body.items ?? [],
        pageCount: body._meta?.pageCount ?? Number(res.headers.get("X-Pagination-Page-Count") ?? 1),
        total: body._meta?.totalCount ?? Number(res.headers.get("X-Pagination-Total-Count") ?? 0),
      };
    } catch (e) {
      console.error("Slotegrator /games error", e);
      return { ok: false as const, error: "network", games: [], pageCount: 0, total: 0 };
    }
  });

export const initDemo = createServerFn({ method: "POST" })
  .inputValidator((input: { gameUuid: string; returnUrl: string; mobile: boolean }) =>
    z
      .object({
        gameUuid: z.string().min(1).max(100),
        returnUrl: z.string().url().max(500),
        mobile: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const merchantId = process.env["SLOTEGRATOR_MERCHANT_ID"];
    const merchantKey = process.env["SLOTEGRATOR_MERCHANT_KEY"];
    const apiUrl = process.env["SLOTEGRATOR_API_URL"];
    if (!merchantId || !merchantKey || !apiUrl) return { ok: false as const, url: null };
    const params = {
      game_uuid: data.gameUuid,
      device: data.mobile ? "mobile" : "desktop",
      return_url: data.returnUrl,
      language: "en",
    };
    const headers: Record<string, string> = {
      "X-Merchant-Id": merchantId,
      "X-Timestamp": String(Math.floor(Date.now() / 1000)),
      "X-Nonce": crypto.randomUUID().replace(/-/g, ""),
    };
    headers["X-Sign"] = await hmacSha1Hex(merchantKey, buildSignString({ ...params, ...headers }));
    try {
      const res = await fetch(`${apiUrl}/games/init-demo`, {
        method: "POST",
        headers: {
          ...headers,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
      });
      if (!res.ok) {
        console.error("Slotegrator init-demo failed", res.status);
        return { ok: false as const, url: null };
      }
      const body = (await res.json()) as { url?: string };
      return body.url ? { ok: true as const, url: body.url } : { ok: false as const, url: null };
    } catch (e) {
      console.error("Slotegrator init-demo error", e);
      return { ok: false as const, url: null };
    }
  });
