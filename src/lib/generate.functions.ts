import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  subject: z.string().min(1).max(100),
  gradeLevel: z.enum(["SD", "SMP", "SMA_SMK", "Kuliah"]),
  questionType: z.enum(["pilihan_ganda", "esai", "benar_salah"]),
  totalQuestions: z.number().int().min(5).max(50),
  bloomDistribution: z.record(z.string(), z.number().int().min(0).max(50)),
  sourceText: z.string().min(50).max(60000),
  title: z.string().min(2).max(200).optional(),
});

const GRADE_LABEL: Record<string, string> = {
  SD: "Sekolah Dasar (SD)",
  SMP: "Sekolah Menengah Pertama (SMP)",
  SMA_SMK: "SMA/SMK",
  Kuliah: "Perguruan Tinggi",
};

const TYPE_LABEL: Record<string, string> = {
  pilihan_ganda: "Pilihan Ganda (4 opsi A–D)",
  esai: "Esai dengan rubrik penilaian",
  benar_salah: "Benar/Salah dengan justifikasi",
};

const BLOOM_GUIDE = `Taksonomi Bloom Revisi (Anderson & Krathwohl, 2001):
- C1 (Mengingat): mengingat fakta, definisi, konsep dasar.
- C2 (Memahami): interpretasi, parafrasa, klasifikasi.
- C3 (Menerapkan): menerapkan konsep ke situasi baru.
- C4 (Menganalisis): mendekomposisi masalah, sebab-akibat. [HOTS]
- C5 (Mengevaluasi): penilaian kritis, argumentasi, justifikasi. [HOTS]
- C6 (Mencipta): sintesis, mendesain solusi, menghasilkan karya baru. [HOTS]`;

type GeneratedQuestion = {
  level_bloom: string;
  type: string;
  question_text: string;
  options?: { A?: string; B?: string; C?: string; D?: string };
  correct_answer?: string;
  explanation: string;
  rubric?: string;
};

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY tidak tersedia");

    const genAI = new GoogleGenerativeAI(apiKey);

    const distLines = Object.entries(data.bloomDistribution)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `  - ${k}: ${n} soal`)
      .join("\n");

    const prompt = `Anda adalah ahli pedagogi dan penyusun soal profesional untuk Kurikulum Indonesia (Merdeka & K-13).
Anda WAJIB mematuhi Taksonomi Bloom Revisi dan menggunakan terminologi resmi Standar Kompetensi Lulusan (SKL) Kemendikbudristek.
Gunakan Bahasa Indonesia formal, gaya soal UTBK/UNBK/SBMPTN, dan konteks lokal Indonesia (nama, tempat, budaya).
${BLOOM_GUIDE}
Setiap soal HARUS relevan dengan materi sumber yang diberikan pengguna.
Jangan menambahkan informasi di luar materi yang signifikan.

Buat ${data.totalQuestions} soal untuk:
- Mata pelajaran: ${data.subject}
- Jenjang: ${GRADE_LABEL[data.gradeLevel]}
- Tipe soal: ${TYPE_LABEL[data.questionType]}

Distribusi level Bloom yang diminta:
${distLines || "  (bebas, fokus pada HOTS C4-C6)"}

MATERI SUMBER:
"""
${data.sourceText.slice(0, 50000)}
"""

Aturan output:
- Untuk pilihan_ganda: WAJIB isi "options" dengan 4 pilihan {A, B, C, D} dan "correct_answer" salah satu huruf A/B/C/D.
- Untuk esai: kosongkan "options", isi "correct_answer" dengan jawaban model, WAJIB isi "rubric" (kriteria penilaian 1-4).
- Untuk benar_salah: "correct_answer" diisi "BENAR" atau "SALAH".
- "explanation": penjelasan singkat mengapa jawaban benar.
- "level_bloom": salah satu C1..C6 sesuai distribusi.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            questions: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  level_bloom: {
                    type: SchemaType.STRING,
                    enum: ["C1", "C2", "C3", "C4", "C5", "C6"],
                  },
                  type: {
                    type: SchemaType.STRING,
                    enum: ["pilihan_ganda", "esai", "benar_salah"],
                  },
                  question_text: { type: SchemaType.STRING },
                  options: {
                    type: SchemaType.OBJECT,
                    properties: {
                      A: { type: SchemaType.STRING },
                      B: { type: SchemaType.STRING },
                      C: { type: SchemaType.STRING },
                      D: { type: SchemaType.STRING },
                    },
                  },
                  correct_answer: { type: SchemaType.STRING },
                  explanation: { type: SchemaType.STRING },
                  rubric: { type: SchemaType.STRING },
                },
                required: ["level_bloom", "type", "question_text", "explanation"],
              },
            },
          },
          required: ["questions"],
        },
      },
    });

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e?.status === 429) throw new Error("Batas permintaan tercapai. Coba lagi sebentar.");
      throw new Error(`Gagal menghubungi layanan AI: ${e?.message ?? String(err)}`);
    }

    const text = result.response.text();
    let parsed: { questions: GeneratedQuestion[] };
    try {
      parsed = JSON.parse(text) as { questions: GeneratedQuestion[] };
    } catch {
      throw new Error("AI tidak mengembalikan struktur soal yang valid.");
    }

    const questions = parsed.questions;
    if (!questions?.length) throw new Error("AI tidak mengembalikan soal.");

    // Simpan ke Supabase
    const { supabase, userId } = context;

    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .insert({
        user_id: userId,
        title: data.title ?? `${data.subject} - ${GRADE_LABEL[data.gradeLevel]}`,
        subject: data.subject,
        grade_level: data.gradeLevel,
        question_type: data.questionType,
        total_questions: questions.length,
        source_text: data.sourceText.slice(0, 1500),
        material_excerpt: data.sourceText.slice(0, 1500),
      })
      .select()
      .single();
    if (setErr) throw new Error(`Gagal menyimpan set soal: ${setErr.message}`);

    const rows = questions.map((q) => ({
      // kolom baru (USER-DEFINED enum)
      set_id: set.id,
      type: q.type,
      level_bloom: q.level_bloom,
      // kolom lama (text + CHECK constraint) — keduanya NOT NULL di DB
      question_set_id: set.id,
      question_type: q.type,
      bloom_level: q.level_bloom,
      // kolom bersama
      user_id: userId,
      question_text: q.question_text,
      options: q.options
        ? { A: q.options.A ?? null, B: q.options.B ?? null, C: q.options.C ?? null, D: q.options.D ?? null }
        : null,
      option_a: q.options?.A ?? null,
      option_b: q.options?.B ?? null,
      option_c: q.options?.C ?? null,
      option_d: q.options?.D ?? null,
      correct_answer: q.correct_answer ?? null,
      explanation: q.explanation,
      rubric: q.rubric ?? null,
    }));

    const { error: qErr } = await supabase.from("questions").insert(rows);
    if (qErr) throw new Error(`Gagal menyimpan soal: ${qErr.message}`);

    return {
      setId: set.id as string,
      count: rows.length,
      questions,
    };
  });