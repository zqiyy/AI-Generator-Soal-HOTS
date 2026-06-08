import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sets/$id")({
  head: () => ({ meta: [{ title: "Paket Soal — Soal HOTS AI" }] }),
  component: SetDetail,
});

const BLOOM_LABELS: Record<string, string> = {
  C1: "Mengingat", C2: "Memahami", C3: "Menerapkan",
  C4: "Menganalisis", C5: "Mengevaluasi", C6: "Mencipta",
};

function SetDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["set", id],
    queryFn: async () => {
      const [{ data: set, error: e1 }, { data: qs, error: e2 }] = await Promise.all([
        supabase.from("question_sets").select("*").eq("id", id).single(),
        supabase.from("questions").select("*").eq("question_set_id", id).order("created_at"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { set, questions: qs ?? [] };
    },
  });

  async function deleteSet() {
    if (!confirm("Hapus paket soal ini?")) return;
    const { error } = await supabase.from("question_sets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus");
    nav({ to: "/library" });
  }

  async function exportPdf() {
    if (!data) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const maxW = 595 - margin * 2;
    let y = margin;

    doc.setFont("helvetica", "bold").setFontSize(16);
    doc.text(data.set.title, margin, y); y += 22;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
    doc.text(`${data.set.subject} · ${data.set.grade_level} · ${data.questions.length} soal`, margin, y); y += 20;
    doc.setTextColor(0);

    data.questions.forEach((q, i) => {
      const checkPage = (needed = 20) => {
        if (y + needed > 760) { doc.addPage(); y = margin; }
      };

      checkPage(40);
      doc.setFont("helvetica", "bold").setFontSize(11);
      doc.text(`${i + 1}. [${q.bloom_level ?? ""}]`, margin, y); y += 14;

      doc.setFont("helvetica", "normal").setFontSize(11);
      const lines = doc.splitTextToSize(q.question_text, maxW);
      checkPage(lines.length * 14);
      doc.text(lines, margin, y); y += lines.length * 14 + 4;

      // Pilihan ganda: tampil dari option_a - option_d
      const opts: Record<string, string | null> = {
        A: q.option_a,
        B: q.option_b,
        C: q.option_c,
        D: q.option_d,
      };
      Object.entries(opts).forEach(([k, v]) => {
        if (!v) return;
        const opt = doc.splitTextToSize(`${k}. ${v}`, maxW - 14);
        checkPage(opt.length * 13);
        doc.text(opt, margin + 14, y); y += opt.length * 13;
      });

      if (q.correct_answer) {
        checkPage(14);
        doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(60);
        doc.text(`Kunci: ${q.correct_answer}`, margin, y); y += 14;
        doc.setTextColor(0);
      }

      if (q.explanation) {
        const expLines = doc.splitTextToSize(`Penjelasan: ${q.explanation}`, maxW);
        checkPage(expLines.length * 13);
        doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(100);
        doc.text(expLines, margin, y); y += expLines.length * 13;
        doc.setTextColor(0);
      }

      y += 10;
    });

    doc.save(`${data.set.title}.pdf`);
  }

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Memuat…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/library" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3" /> Bank Soal
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-1">{data.set.title}</h1>
          <p className="text-muted-foreground mt-1">
            {data.set.subject} · {data.set.grade_level?.replace("_", "/")} · {data.questions.length} soal
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf}>
            <Download className="size-4 mr-2" />Ekspor PDF
          </Button>
          <Button variant="ghost" onClick={deleteSet}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {data.questions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Badge>{q.bloom_level}</Badge>
                <Badge variant="outline">{BLOOM_LABELS[q.bloom_level ?? ""] ?? ""}</Badge>
                <Badge variant="outline">{q.question_type?.replace("_", " ")}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">#{i + 1}</span>
              </div>

              <p className="whitespace-pre-wrap">{q.question_text}</p>

              {/* Pilihan ganda: tampil dari option_a - option_d */}
              {q.option_a && (
                <div className="grid sm:grid-cols-2 gap-1.5 text-sm">
                  {[
                    { k: "A", v: q.option_a },
                    { k: "B", v: q.option_b },
                    { k: "C", v: q.option_c },
                    { k: "D", v: q.option_d },
                  ].filter(({ v }) => v).map(({ k, v }) => (
                    <div
                      key={k}
                      className={`rounded border px-3 py-1.5 ${
                        q.correct_answer === k ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <span className="font-semibold mr-2">{k}.</span>{v}
                    </div>
                  ))}
                </div>
              )}

              {q.correct_answer && !q.option_a && (
                <div className="text-sm">
                  <span className="font-semibold">Kunci:</span> {q.correct_answer}
                </div>
              )}

              {q.explanation && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Penjelasan:</span> {q.explanation}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}