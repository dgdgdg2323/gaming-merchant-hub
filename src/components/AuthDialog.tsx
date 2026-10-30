import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { randomCredentials, usernameToEmail } from "@/hooks/use-player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function authErrorText(message: string) {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("database error")) return "এই নামটি আগেই নেওয়া হয়েছে।";
  if (m.includes("invalid login")) return "নাম বা পাসওয়ার্ড ভুল।";
  if (m.includes("pwned") || m.includes("weak") || m.includes("password"))
    return "পাসওয়ার্ডটি দুর্বল — অন্য একটি দিন (কমপক্ষে ৮ অক্ষর)।";
  return "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।";
}

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function register(u: string, p: string) {
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(u),
      password: p,
      options: { data: { username: u } },
    });
    if (error) throw error;
  }

  async function oneClick() {
    setBusy(true);
    try {
      const creds = randomCredentials();
      await register(creds.username, creds.password);
      setCreated(creds);
    } catch (e) {
      toast.error(authErrorText((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function submit(mode: "login" | "register") {
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) return toast.error("নাম ৩–২০ অক্ষরের হতে হবে (a-z, 0-9, _)।");
    if (password.length < 8) return toast.error("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।");
    setBusy(true);
    try {
      if (mode === "register") await register(u, password);
      else {
        const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(u), password });
        if (error) throw error;
      }
      toast.success(mode === "register" ? "অ্যাকাউন্ট তৈরি হয়েছে!" : "স্বাগতম!");
      onOpenChange(false);
    } catch (e) {
      toast.error(authErrorText((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setCreated(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-gold">Golden Reels</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              আপনার অ্যাকাউন্ট তৈরি হয়েছে এবং আপনি লগইন আছেন। নিচের নাম ও পাসওয়ার্ড অবশ্যই লিখে রাখুন —
              পরে আবার লগইন করতে এগুলো লাগবে।
            </p>
            <div className="space-y-2 rounded-lg border bg-muted p-4 font-mono text-sm">
              <p>নাম: {created.username}</p>
              <p>পাসওয়ার্ড: {created.password}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(`নাম: ${created.username}\nপাসওয়ার্ড: ${created.password}`);
                toast.success("কপি হয়েছে");
              }}
            >
              <Copy /> কপি করুন
            </Button>
            <Button variant="gold" className="w-full" onClick={() => onOpenChange(false)}>
              খেলা শুরু করুন
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="quick">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick">এক ক্লিকে</TabsTrigger>
              <TabsTrigger value="login">লগইন</TabsTrigger>
              <TabsTrigger value="register">রেজিস্টার</TabsTrigger>
            </TabsList>
            <TabsContent value="quick" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                এক ক্লিকেই অ্যাকাউন্ট — নাম ও পাসওয়ার্ড আমরা বানিয়ে দেব।
              </p>
              <Button variant="gold" className="w-full" size="lg" onClick={oneClick} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                এক ক্লিকে রেজিস্টার
              </Button>
            </TabsContent>
            {(["login", "register"] as const).map((mode) => (
              <TabsContent key={mode} value={mode} className="space-y-4 pt-4">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(mode);
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor={`${mode}-u`}>ইউজারনেম</Label>
                    <Input
                      id={`${mode}-u`}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${mode}-p`}>পাসওয়ার্ড</Label>
                    <Input
                      id={`${mode}-p`}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                  </div>
                  <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    {mode === "login" ? "লগইন" : "অ্যাকাউন্ট খুলুন"}
                  </Button>
                </form>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
