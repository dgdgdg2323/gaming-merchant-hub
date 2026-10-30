import { createFileRoute } from "@tanstack/react-router";
import { safeEqual } from "@/lib/slotegrator-shared";
import { slotegratorConfig, slotegratorRequest, walletDb } from "@/lib/slotegrator-core";

// GET /api/public/health → {"ok":true}
// Full check (used by deploy.sh): send header "x-admin-code: <ADMIN_SETUP_CODE>".
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = request.headers.get("x-admin-code") ?? "";
        const expected = process.env["ADMIN_SETUP_CODE"] ?? "";
        if (!expected || !safeEqual(code, expected)) {
          return Response.json({ ok: true, time: new Date().toISOString() });
        }

        const env = {
          SLOTEGRATOR: !!slotegratorConfig(),
          WALLET_RPC_SECRET: !!process.env["WALLET_RPC_SECRET"],
          DATABASE: !!(process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]),
        };

        let database = "fail";
        try {
          const { data, error } = await walletDb().rpc("wallet_balance", {
            p_secret: process.env["WALLET_RPC_SECRET"] ?? "",
            p_player: "00000000-0000-0000-0000-000000000000",
          });
          database = error ? `fail: ${error.message}` : (data as { error?: string })?.error === "PLAYER_NOT_FOUND" ? "ok" : "unexpected";
        } catch (e) {
          database = `fail: ${String(e)}`;
        }

        let serverIp = "unknown";
        try {
          serverIp = (await (await fetch("https://api.ipify.org")).text()).trim();
        } catch {
          /* ignore */
        }

        const games = await slotegratorRequest("GET", "/games", { page: "1" });
        const gamesCount = games.ok ? ((games.body as { items?: unknown[] }).items?.length ?? 0) : 0;

        return Response.json({
          ok: env.SLOTEGRATOR && env.WALLET_RPC_SECRET && database === "ok" && games.ok,
          env,
          database,
          serverIp,
          slotegrator: {
            status: games.status,
            ok: games.ok,
            gamesOnFirstPage: gamesCount,
            hint: games.ok
              ? "Slotegrator API works"
              : games.status === 406 || games.status === 403
                ? `Slotegrator is blocking this server. Ask them to whitelist IP ${serverIp}`
                : "Slotegrator not reachable — check API URL / credentials",
          },
        });
      },
    },
  },
});
