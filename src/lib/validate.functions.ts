import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const QuestionSchema = z.object({
  level_bloom: z.string(),
  type: z.string(),
  question_text: z.string(),
  options: z.record(z.string(), z.string()).optional(),
  correct_answer: z.string().optional(),
  explanation: z.string(),
  rubric: z.string().optional(),
});

const InputSchema = z.object({
  questions: z.array(QuestionSchema),
  subject: z.string(),
  gradeLevel: z.string(),
});

type Question = z.infer<typeof QuestionSchema>;

type ValidationResult = {
  index: number;
  valid: boolean;
  bloom_correct: boolean;
  issues: string[];
  suggestion: string;
};

// ─── STEP 1: Groq validasi ───────────────────────────────────────────────────
async function runValidation(
  questions: Question[],
  subject: string,
  gradeLevel: string,
  groqKey: string
): Promise<ValidationResult[]> {
  const questionsText = questions
    .map(
      (q, i) => `
Soal #${i + 1}:
- Level Bloom diklaim: ${q.level_bloom}
- Tipe: ${q.type}
- Pertanyaan: ${q.question_text}
${q.options ? `- Opsi: ${JSON.stringify(q.options)}` : ""}
${q.correct_answer ? `- Jawaban: ${q.correct_answer}` : ""}
- Penjelasan: ${q.explanation}`
    )
    .join("\n---\n");

  const prompt = `Kamu adalah validator soal pendidikan Indonesia ahli Taksonomi Bloom (Anderson & Krathwohl).
Validasi setiap soal berikut untuk mata pelajaran "${subject}" jenjang "${gradeLevel}".

Periksa setiap soal:
1. Apakah level Bloom yang diklaim sudah tepat?
2. Apakah soal ambigu atau membingungkan?
3. Apakah kunci jawaban benar sesuai penjelasan?
4. Apakah bahasa sudah formal dan sesuai jenjang?

Soal-soal:
${questionsText}

Balas HANYA dengan JSON array, tanpa teks lain:
[{"index":0,"valid":true,"bloom_correct":true,"issues":[],"suggestion":"Soal sudah baik"}]`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);

  const result = await response.json();
  const text = result.choices[0].message.content as string;
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as ValidationResult[];
}

// ─── STEP 2: Gemini auto-fix soal invalid ────────────────────────────────────
async function runEnhancement(
  questions: Question[],
  validations: ValidationResult[],
  subject: string,
  gradeLevel: string,
  geminiKey: string
): Promise<Question[]> {
  const invalidIndices = validations
    .filter((v) => !v.valid || !v.bloom_correct)
    .map((v) => v.index);

  if (invalidIndices.length === 0) return questions;

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            index: { type: SchemaType.NUMBER } as any,
            level_bloom: { type: SchemaType.STRING } as any,
            type: { type: SchemaType.STRING } as any,
            question_text: { type: SchemaType.STRING } as any,
            options: {
              type: SchemaType.OBJECT,
              properties: {
                A: { type: SchemaType.STRING },
                B: { type: SchemaType.STRING },
                C: { type: SchemaType.STRING },
                D: { type: SchemaType.STRING },
                E: { type: SchemaType.STRING },
              },
            } as any,
            correct_answer: { type: SchemaType.STRING } as any,
            explanation: { type: SchemaType.STRING } as any,
            rubric: { type: SchemaType.STRING } as any,
          },
          required: ["index", "level_bloom", "type", "question_text", "explanation"],
        },
      },
    },
  });

  const toFix = invalidIndices.map((i) => {
    const q = questions[i];
    const v = validations[i];
    return `
Soal #${i} (PERLU DIPERBAIKI):
- Level Bloom: ${q.level_bloom}
- Pertanyaan: ${q.question_text}
${q.options ? `- Opsi: ${JSON.stringify(q.options)}` : ""}
${q.correct_answer ? `- Jawaban: ${q.correct_answer}` : ""}
- Masalah ditemukan: ${v.issues.join(", ")}
- Saran validator: ${v.suggestion}`;
  }).join("\n---\n");

  const prompt = `Kamu adalah ahli penyusun soal HOTS untuk Kurikulum Indonesia.
Perbaiki soal-soal berikut berdasarkan masalah yang ditemukan validator.
Mata pelajaran: ${subject}, Jenjang: ${gradeLevel}.

Pertahankan tipe soal dan level Bloom yang sama, kecuali jika level Bloom-nya salah — koreksi ke level yang tepat.
Pastikan bahasa formal, soal tidak ambigu, dan kunci jawaban benar.

${toFix}

Kembalikan array JSON berisi soal yang sudah diperbaiki dengan field "index" untuk menandai nomor soal mana.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const fixed = JSON.parse(text) as Array<Question & { index: number }>;

  const updatedQuestions = [...questions];
  fixed.forEach((f) => {
    const { index, ...q } = f;
    updatedQuestions[index] = { ...updatedQuestions[index], ...q };
  });

  return updatedQuestions;
}

// ─── Server Function utama ────────────────────────────────────────────────────
export const validateAndEnhanceQuestions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY tidak tersedia");
    if (!geminiKey) throw new Error("GEMINI_API_KEY tidak tersedia");

    // Step 1 — Groq validasi
    let validations: ValidationResult[];
    try {
      validations = await runValidation(data.questions, data.subject, data.gradeLevel, groqKey);
    } catch {
      throw new Error("Gagal menjalankan validasi Groq");
    }

    // Step 2 — Gemini auto-fix soal yang invalid
    let enhancedQuestions: Question[];
    try {
      enhancedQuestions = await runEnhancement(
        data.questions, validations, data.subject, data.gradeLevel, geminiKey
      );
    } catch {
      // Kalau enhancement gagal, tetap pakai soal original
      enhancedQuestions = data.questions;
    }

    // Re-validasi soal yang sudah diperbaiki
    const fixedIndices = validations
      .filter((v) => !v.valid || !v.bloom_correct)
      .map((v) => v.index);

    const finalValidations = validations.map((v) =>
      fixedIndices.includes(v.index)
        ? { ...v, valid: true, bloom_correct: true, issues: [], suggestion: "Diperbaiki otomatis oleh AI" }
        : v
    );

    return {
      validations: finalValidations,
      enhancedQuestions,
      fixedCount: fixedIndices.length,
    };
  });