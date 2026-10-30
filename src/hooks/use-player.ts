import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export function usePlayer(userId: string | undefined) {
  return useQuery({
    queryKey: ["player", userId],
    enabled: !!userId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("username, balance").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      return {
        username: profile?.username ?? "",
        balance: Number(profile?.balance ?? 0),
        isAdmin: !!roles?.some((r) => r.role === "admin"),
      };
    },
  });
}

/** Usernames become a hidden sign-in address; players never see or need it. */
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@players.goldenreels.app`;

export function randomCredentials() {
  const n = Math.floor(100000 + Math.random() * 900000);
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const password = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return { username: `player${n}`, password };
}
