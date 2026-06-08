import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Brain, FileText, Layers, Sparkles, GraduationCap, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Generator Soal HOTS — Taksonomi Bloom" },
      { name: "description", content: "Generator soal HOTS otomatis berbasis Taksonomi Bloom C1–C6 untuk Kurikulum Merdeka & K-13. Upload materi, hasilkan puluhan soal berkualitas dalam hitungan detik." },
      { property: "og:title", content: "AI Generator Soal HOTS" },
      { property: "og:description", content: "Generator soal HOTS otomatis berbasis Taksonomi Bloom untuk kurikulum Indonesia." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 bg-background/80 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Brain className="size-5" />
            </div>
            <div className="font-semibold tracking-tight">Soal HOTS AI</div>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">Masuk</Button></Link>
            <Link to="/auth"><Button>Mulai Gratis</Button></Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="size-3.5 text-accent-foreground" />
          Berbasis Gemini & Taksonomi Bloom revisi (Anderson & Krathwohl, 2001)
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.05]">
          Buat <span className="text-primary">Soal HOTS</span> otomatis dari materi Anda, dalam hitungan detik.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Unggah PDF materi, atur jenjang dan distribusi level Bloom C1–C6, lalu biarkan AI menyusun soal pilihan ganda, esai, atau benar/salah yang siap pakai untuk Kurikulum Merdeka & K-13.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/auth"><Button size="lg" className="h-12 px-6">Coba Sekarang</Button></Link>
          <a href="#fitur"><Button size="lg" variant="outline" className="h-12 px-6">Lihat Fitur</Button></a>
        </div>
      </section>

      <section id="fitur" className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { icon: FileText, title: "Parsing PDF Cerdas", desc: "Ekstraksi otomatis dari materi PDF hingga 10MB dengan pembersihan header/footer." },
          { icon: Layers, title: "Taksonomi Bloom C1–C6", desc: "Distribusi level kognitif yang bisa Anda atur, dari mengingat hingga mencipta." },
          { icon: GraduationCap, title: "Kontekstual Indonesia", desc: "Bahasa Indonesia native, gaya soal UTBK/UNBK, terminologi SKL Kemendikbudristek." },
          { icon: Sparkles, title: "3 Tipe Soal", desc: "Pilihan ganda, esai dengan rubrik penilaian, dan benar/salah—semua siap edit." },
          { icon: BookOpen, title: "Bank Soal Pribadi", desc: "Simpan, cari, dan ekspor ke PDF. Aman dengan otentikasi & RLS per pengguna." },
          { icon: Brain, title: "Edit & Re-generate", desc: "Tinjau hasil AI, ubah inline, atau hasilkan ulang per soal sesuai kebutuhan." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-6">
            <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-4">
              <Icon className="size-5" />
            </div>
            <div className="font-semibold text-foreground">{title}</div>
            <div className="text-sm text-muted-foreground mt-1">{desc}</div>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-sm text-muted-foreground">
        © 2026 Tim RPL UNESA · Universitas Negeri Surabaya
      </footer>
    </div>
  );
}
