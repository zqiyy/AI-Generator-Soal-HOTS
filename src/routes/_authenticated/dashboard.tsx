import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Sparkles, Loader2, FileText, Save, Trash2, Eye, EyeOff, CheckCircle, XCircle, AlertCircle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { useServerFn } from "@tanstack/react-start";
import { generateQuestions } from "@/lib/generate.functions";
import { validateAndEnhanceQuestions } from "@/lib/validate.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Generator — Soal HOTS AI" }] }),
  component: Dashboard,
});

type GeneratedQ = {
  level_bloom: string;
  type: string;
  question_text: string;
  options?: Record<string, string>;
  correct_answer?: string;
  explanation: string;
  rubric?: string;
};

type ValidationResult = {
  index: number;
  valid: boolean;
  bloom_correct: boolean;
  issues: string[];
  suggestion: string;
};

const BLOOMS = ["C1", "C2", "C3", "C4", "C5", "C6"] as const;
const BLOOM_LABELS: Record<string, string> = {
  C1: "Mengingat", C2: "Memahami", C3: "Menerapkan",
  C4: "Menganalisis", C5: "Mengevaluasi", C6: "Mencipta",
};

function Dashboard() {
  const nav = useNavigate();
  const generate = useServerFn(generateQuestions);
  const validateAndEnhance = useServerFn(validateAndEnhanceQuestions);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState<"SD" | "SMP" | "SMA_SMK" | "Kuliah">("SMA_SMK");
  const [qType, setQType] = useState<"pilihan_ganda" | "esai" | "benar_salah">("pilihan_ganda");
  const [total, setTotal] = useState(10);
  const [dist, setDist] = useState<Record<string, number>>({ C1: 1, C2: 1, C3: 2, C4: 3, C5: 2, C6: 1 });
  const [sourceText, setSourceText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQ[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAnswers, setShowAnswers] = useState(true);
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [validating, setValidating] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<string>("");

  const distSum = Object.values(dist).reduce((a, b) => a + b, 0);

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParsing(true);
    try {
      const text = await extractTextFromPdf(f);
      setSourceText(text);
      if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
      toast.success(`Berhasil mengekstrak ${text.length.toLocaleString()} karakter`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Gagal memproses PDF");
    } finally {
      setParsing(false);
    }
  }

  async function onGenerate() {
    if (sourceText.trim().length < 50) return toast.error("Materi sumber terlalu pendek (min 50 karakter)");
    if (!subject.trim()) return toast.error("Isi mata pelajaran");
    if (distSum !== total) return toast.error(`Distribusi Bloom (${distSum}) harus sama dengan total soal (${total})`);
    setLoading(true);
    setValidations([]);
    setPipelineStep("Gemini sedang membuat soal…");
    try {
      const res = await generate({
        data: { subject, gradeLevel: grade, questionType: qType, totalQuestions: total, bloomDistribution: dist, sourceText },
      });
      setQuestions(res.questions);
      setShowAnswers(true);
      toast.success(`${res.questions.length} soal berhasil dibuat`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Gagal menghasilkan soal");
    } finally {
      setLoading(false);
      setPipelineStep("");
    }
  }

  async function onValidateAndEnhance() {
    if (!questions.length) return;
    setValidating(true);
    setValidations([]);
    try {
      // Step 1
      setPipelineStep("🔍 Groq/Llama sedang memvalidasi soal…");
      await new Promise((r) => setTimeout(r, 300));

      const res = await validateAndEnhance({
        data: { questions, subject, gradeLevel: grade },
      });

      // Step 2 feedback
      setPipelineStep(`✨ Gemini memperbaiki ${res.fixedCount} soal yang bermasalah…`);
      await new Promise((r) => setTimeout(r, 500));

      setValidations(res.validations);
      setQuestions(res.enhancedQuestions);

      const invalidCount = res.validations.filter((v) => !v.valid).length;
      if (res.fixedCount > 0) {
        toast.success(`Validasi selesai — ${res.fixedCount} soal diperbaiki otomatis`);
      } else if (invalidCount === 0) {
        toast.success("Semua soal valid! Tidak ada yang perlu diperbaiki.");
      } else {
        toast.warning(`${invalidCount} soal masih perlu perhatian`);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Gagal memvalidasi");
    } finally {
      setValidating(false);
      setPipelineStep("");
    }
  }

  async function onSave() {
    if (!questions.length) return;
    if (!title.trim()) return toast.error("Beri judul untuk paket soal ini");
    if (!subject.trim()) return toast.error("Isi mata pelajaran terlebih dahulu");
    setSaving(true);
    try {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user!.id;

      const { data: set, error: e1 } = await supabase
        .from("question_sets")
        .insert({
          user_id: uid, title, subject,
          grade_level: grade, question_type: qType,
          total_questions: questions.length,
          bloom_distribution: dist,
          source_text: sourceText.slice(0, 30000),
        })
        .select()
        .single();
      if (e1) throw new Error(e1.message);

      const rows = questions.map((q, i) => ({
        set_id: set.id, user_id: uid, order_index: i,
        level_bloom: q.level_bloom as "C1"|"C2"|"C3"|"C4"|"C5"|"C6",
        type: q.type as "pilihan_ganda"|"esai"|"benar_salah",
        question_text: q.question_text,
        options: q.options ?? null,
        correct_answer: q.correct_answer ?? null,
        explanation: q.explanation,
        rubric: q.rubric ?? null,
      }));

      const { error: e2 } = await supabase.from("questions").insert(rows);
      if (e2) throw new Error(e2.message);

      toast.success("Paket soal tersimpan");
      nav({ to: "/library" });
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  function updateQ(i: number, patch: Partial<GeneratedQ>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  const validCount = validations.filter((v) => v.valid && v.bloom_correct).length;
  const fixedCount = validations.filter((v) => v.suggestion === "Diperbaiki otomatis oleh AI").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generator Soal HOTS</h1>
        <p className="text-muted-foreground mt-1">Upload materi PDF atau tempel teks, atur konfigurasi, lalu hasilkan soal berbasis Taksonomi Bloom.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="size-4" />1. Materi Sumber</CardTitle>
            <CardDescription>Unggah PDF (maks 10MB) atau tempel teks langsung.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="pdf" className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 cursor-pointer hover:bg-muted/50 transition">
              {parsing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              <span className="text-sm">{parsing ? "Mengekstrak…" : "Pilih file PDF"}</span>
              <input id="pdf" type="file" accept="application/pdf" className="hidden" onChange={onPdf} disabled={parsing} />
            </Label>
            <Textarea
              placeholder="Atau tempel teks materi di sini…"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="min-h-[180px] font-mono text-xs"
            />
            <div className="text-xs text-muted-foreground">{sourceText.length.toLocaleString()} karakter</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4" />2. Konfigurasi</CardTitle>
            <CardDescription>Atur judul, jenjang, tipe, dan distribusi Bloom.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Judul paket soal</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="cth. UH Bab 3 — Hukum Newton" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mata pelajaran</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Fisika" />
              </div>
              <div>
                <Label>Jenjang</Label>
                <Select value={grade} onValueChange={(v) => setGrade(v as "SD" | "SMP" | "SMA_SMK" | "Kuliah")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SD">SD</SelectItem>
                    <SelectItem value="SMP">SMP</SelectItem>
                    <SelectItem value="SMA_SMK">SMA/SMK</SelectItem>
                    <SelectItem value="Kuliah">Perguruan Tinggi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipe soal</Label>
                <Select value={qType} onValueChange={(v) => setQType(v as "pilihan_ganda" | "esai" | "benar_salah")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pilihan_ganda">Pilihan Ganda</SelectItem>
                    <SelectItem value="esai">Esai</SelectItem>
                    <SelectItem value="benar_salah">Benar / Salah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Total soal: {total}</Label>
                <Slider min={5} max={50} step={1} value={[total]} onValueChange={([v]) => setTotal(v)} className="mt-3" />
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Distribusi Taksonomi Bloom</Label>
                <span className={`text-xs ${distSum === total ? "text-primary" : "text-destructive"}`}>{distSum} / {total}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {BLOOMS.map((b) => (
                  <div key={b} className="rounded border border-border p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{b}</span>
                      <span className="text-[10px] text-muted-foreground">{BLOOM_LABELS[b]}</span>
                    </div>
                    <Input
                      type="number" min={0} max={50}
                      value={dist[b] ?? 0}
                      onChange={(e) => setDist({ ...dist, [b]: Math.max(0, parseInt(e.target.value || "0")) })}
                      className="h-7 mt-1 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={onGenerate} disabled={loading || parsing}>
              {loading
                ? <><Loader2 className="size-4 mr-2 animate-spin" />Menghasilkan…</>
                : <><Sparkles className="size-4 mr-2" />Hasilkan Soal</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline status banner */}
      {(loading || validating) && pipelineStep && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-primary shrink-0" />
          <p className="text-sm text-primary font-medium">{pipelineStep}</p>
        </div>
      )}

      {questions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>3. Tinjau & Simpan</CardTitle>
              <CardDescription>{questions.length} soal — edit jika perlu, lalu simpan ke bank soal.</CardDescription>
              {validations.length > 0 && (
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="size-3" />{validCount} valid
                  </span>
                  {fixedCount > 0 && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Wand2 className="size-3" />{fixedCount} diperbaiki AI
                    </span>
                  )}
                  {validations.filter((v) => !v.valid).length > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="size-3" />{validations.filter((v) => !v.valid).length} perlu perhatian
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAnswers((v) => !v)}>
                {showAnswers ? <><EyeOff className="size-4 mr-2" />Sembunyikan Jawaban</> : <><Eye className="size-4 mr-2" />Tampilkan Jawaban</>}
              </Button>
              <Button variant="outline" size="sm" onClick={onValidateAndEnhance} disabled={validating}>
                {validating
                  ? <><Loader2 className="size-4 mr-2 animate-spin" />Memproses…</>
                  : <><Wand2 className="size-4 mr-2" />Validasi & Perbaiki AI</>}
              </Button>
              <Button onClick={onSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}Simpan
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q, i) => {
              const val = validations[i];
              return (
                <div key={i} className={`rounded-lg border p-4 space-y-3 ${
                  val ? (val.valid && val.bloom_correct ? "border-green-200" : "border-red-200") : "border-border"
                }`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge>{q.level_bloom}</Badge>
                    <Badge variant="outline">{BLOOM_LABELS[q.level_bloom] ?? ""}</Badge>
                    <Badge variant="outline">{q.type.replace("_", " ")}</Badge>
                    {val && (
                      val.valid && val.bloom_correct
                        ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle className="size-3 mr-1" />
                            {val.suggestion === "Diperbaiki otomatis oleh AI" ? "Diperbaiki AI" : "Valid"}
                          </Badge>
                        : <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            <XCircle className="size-3 mr-1" />Perlu perhatian
                          </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">#{i + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {/* Issues dari validator */}
                  {val && (!val.valid || !val.bloom_correct) && val.issues.length > 0 && (
                    <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 space-y-0.5">
                      {val.issues.map((issue, j) => (
                        <p key={j} className="flex items-start gap-1">
                          <AlertCircle className="size-3 mt-0.5 shrink-0" />{issue}
                        </p>
                      ))}
                    </div>
                  )}

                  <Textarea
                    value={q.question_text}
                    onChange={(e) => updateQ(i, { question_text: e.target.value })}
                    className="min-h-[80px]"
                  />

                  {q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(q.options).map(([k, v]) => (
                        <div key={k} className="flex gap-2 items-center">
                          <Badge
                            variant={showAnswers && q.correct_answer === k ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => updateQ(i, { correct_answer: k })}
                          >{k}</Badge>
                          <Input
                            value={v}
                            onChange={(e) => updateQ(i, { options: { ...q.options!, [k]: e.target.value } })}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {showAnswers && q.type === "esai" && (
                    <div>
                      <Label className="text-xs">Rubrik</Label>
                      <Textarea value={q.rubric ?? ""} onChange={(e) => updateQ(i, { rubric: e.target.value })} className="min-h-[60px] text-sm" />
                    </div>
                  )}

                  {showAnswers && (
                    <div>
                      <Label className="text-xs">Penjelasan</Label>
                      <Textarea value={q.explanation} onChange={(e) => updateQ(i, { explanation: e.target.value })} className="min-h-[60px] text-sm" />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}