import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
    head: () => ({ meta: [{ title: "Reset Kata Sandi — Soal HOTS AI" }] }),
    component: ResetPasswordPage,
});

function ResetPasswordPage () {
    const searchParams = useSearch({ from: "/reset-password" });
    const [step, setStep] = useState<"email" | "reset">("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if redirected from Supabase with token
        supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY")
            {
                setStep("reset");
            }
        });
    }, []);

    async function requestReset (e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + "/reset-password",
        });
        setLoading(false);
        if (error) return toast.error(error.message);
        toast.success("Link reset kata sandi telah dikirim ke email Anda");
        setEmail("");
    }

    async function updatePassword (e: React.FormEvent) {
        e.preventDefault();
        if (password !== passwordConfirm)
        {
            return toast.error("Kata sandi tidak cocok");
        }
        if (password.length < 8)
        {
            return toast.error("Kata sandi harus minimal 8 karakter");
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        setLoading(false);
        if (error) return toast.error(error.message);
        toast.success("Kata sandi berhasil direset");
        window.location.href = "/auth";
    }

    return (
        <div className="min-h-screen grid place-items-center bg-background px-4">
            <div className="w-full max-w-md">
                <Link to="/" className="flex items-center gap-2 justify-center mb-6">
                    <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                        <Brain className="size-5" />
                    </div>
                    <span className="font-semibold">Soal HOTS AI</span>
                </Link>
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                    <h1 className="text-2xl font-bold mb-4">Reset Kata Sandi</h1>

                    {step === "email" ? (
                        <form onSubmit={requestReset} className="space-y-3">
                            <p className="text-sm text-muted-foreground mb-4">
                                Masukkan email Anda untuk menerima link reset kata sandi.
                            </p>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nama@example.com"
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                Kirim Link Reset
                            </Button>
                            <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground block text-center mt-4">
                                Kembali ke Login
                            </Link>
                        </form>
                    ) : (
                        <form onSubmit={updatePassword} className="space-y-3">
                            <p className="text-sm text-muted-foreground mb-4">
                                Masukkan kata sandi baru Anda.
                            </p>
                            <div>
                                <Label htmlFor="password">Kata Sandi Baru</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 8 karakter"
                                />
                            </div>
                            <div>
                                <Label htmlFor="confirm">Konfirmasi Kata Sandi</Label>
                                <Input
                                    id="confirm"
                                    type="password"
                                    required
                                    minLength={8}
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    placeholder="Ulangi kata sandi"
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                Reset Kata Sandi
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
