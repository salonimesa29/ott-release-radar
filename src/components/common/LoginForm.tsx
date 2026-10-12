"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "password" | "magic">(null);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
    setBusy(null);
    if (error) return setMessage({ kind: "error", text: error.message });
    if (mode === "signup" && !data.session) {
      return setMessage({ kind: "info", text: "Check your inbox to confirm your email, then sign in." });
    }
    router.replace(next);
    router.refresh();
  }

  async function magicLink() {
    if (!email) return setMessage({ kind: "error", text: "Enter your email first." });
    setBusy("magic");
    setMessage(null);
    const { error } = await createBrowserSupabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setBusy(null);
    setMessage(error ? { kind: "error", text: error.message } : { kind: "info", text: "Magic link sent. Open it on this device." });
  }

  return (
    <div className="mt-8">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="w-full">
          <TabsTrigger value="signin" className="flex-1">Sign in</TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">Create account</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          {mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>
        {message && (
          <p role="status" className={message.kind === "error" ? "text-sm text-skip" : "text-sm text-cyan"}>
            {message.text}
          </p>
        )}
        <Button type="submit" disabled={!!busy} className="h-11 w-full text-sm">
          {busy === "password" && <Loader2 className="animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" onClick={magicLink} disabled={!!busy} className="h-11 w-full">
        {busy === "magic" ? <Loader2 className="animate-spin" /> : <Mail />}
        Email me a magic link
      </Button>
    </div>
  );
}
