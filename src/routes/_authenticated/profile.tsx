import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/profile")({
    head: () => ({ meta: [{ title: "Edit Profil — Soal HOTS AI" }] }),
    component: ProfilePage,
});

function ProfilePage () {
    const nav = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [school, setSchool] = useState("");
    const [subject, setSubject] = useState("");

    useEffect(() => {
        async function loadProfile () {
            setLoading(true);
            try
            {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user)
                {
                    nav({ to: "/auth" });
                    return;
                }

                setEmail(user.email || "");
                setFullName(user.user_metadata?.full_name || "");

                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name, school, subject")
                    .eq("id", user.id)
                    .single();

                if (profile)
                {
                    setFullName(profile.full_name || "");
                    setSchool(profile.school || "");
                    setSubject(profile.subject || "");
                }
            } catch (error)
            {
                console.error("Error loading profile:", error);
                toast.error("Gagal memuat profil");
            } finally
            {
                setLoading(false);
            }
        }

        loadProfile();
    }, [nav]);

    async function updateProfile (e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try
        {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user)
            {
                toast.error("Tidak ada user yang login");
                setSaving(false);
                return;
            }

            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: fullName },
            });

            if (authError) throw authError;

            const { error: profileError } = await supabase
                .from("profiles")
                .update({
                    full_name: fullName,
                    school,
                    subject,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

            if (profileError) throw profileError;

            toast.success("Profil berhasil diperbarui");
        } catch (error: any)
        {
            toast.error(error.message || "Gagal memperbarui profil");
        } finally
        {
            setSaving(false);
        }
    }

    async function logout () {
        const { error } = await supabase.auth.signOut();
        if (error) return toast.error(error.message);
        toast.success("Berhasil logout");
        nav({ to: "/auth" });
    }

    if (loading) return <p className="text-sm text-muted-foreground">Memuat…</p>;

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <ArrowLeft className="size-3" /> Kembali
                </Link>
                <h1 className="text-3xl font-bold tracking-tight mt-3">Profil Saya</h1>
                <p className="text-muted-foreground mt-1">Kelola informasi akun Anda.</p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <form onSubmit={updateProfile} className="space-y-4">
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" disabled value={email} className="bg-muted" />
                            <p className="text-xs text-muted-foreground mt-1">Email tidak dapat diubah</p>
                        </div>

                        <div>
                            <Label htmlFor="fullName">Nama Lengkap</Label>
                            <Input
                                id="fullName"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Nama Anda"
                            />
                        </div>

                        <div>
                            <Label htmlFor="school">Sekolah / Institusi</Label>
                            <Input
                                id="school"
                                value={school}
                                onChange={(e) => setSchool(e.target.value)}
                                placeholder="e.g. SMA Negeri 1 Jakarta"
                            />
                        </div>

                        <div>
                            <Label htmlFor="subject">Mata Pelajaran (dipisahkan koma)</Label>
                            <Textarea
                                id="subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="e.g. Matematika, Bahasa Indonesia, IPA"
                                className="min-h-20"
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button type="submit" disabled={saving}>
                                {saving ? "Menyimpan..." : "Simpan Perubahan"}
                            </Button>
                            <Button type="button" variant="outline" onClick={logout}>
                                <LogOut className="size-4 mr-2" /> Logout
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}