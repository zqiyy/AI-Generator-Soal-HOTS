import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Brain, LayoutDashboard, Library, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

function AppShell () {
  const nav = useNavigate();
  async function signOut () {
    await supabase.auth.signOut();
    toast.success("Berhasil keluar");
    nav({ to: "/auth" });
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Brain className="size-4" />
            </div>
            <span className="font-semibold tracking-tight">Soal HOTS AI</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm"><LayoutDashboard className="size-4 mr-2" />Generator</Button>
            </Link>
            <Link to="/library">
              <Button variant="ghost" size="sm"><Library className="size-4 mr-2" />Bank Soal</Button>
            </Link>
            <Link to="/profile">
              <Button variant="ghost" size="sm"><Settings className="size-4 mr-2" />Profil</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4 mr-2" />Keluar</Button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}