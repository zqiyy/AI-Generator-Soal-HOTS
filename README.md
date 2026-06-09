# Soal HOTS AI

Aplikasi web berbasis AI untuk membantu guru dan dosen membuat soal berkualitas tinggi sesuai **Taksonomi Bloom Revisi (C1–C6)**. Cukup tempelkan materi teks, atur parameter soal, dan biarkan AI menghasilkan soal lengkap dengan kunci jawaban, penjelasan, hingga rubrik penilaian.

---

## Fitur

- **Generator Soal AI** — Hasilkan soal otomatis dari teks materi menggunakan Google Gemini AI
- **3 Tipe Soal** — Pilihan Ganda, Esai (dengan rubrik), dan Benar/Salah
- **Taksonomi Bloom (C1–C6)** — Atur distribusi level kognitif sesuai kebutuhan pembelajaran
- **Bank Soal** — Simpan, kelola, dan tinjau ulang semua set soal yang pernah dibuat
- **Ekspor PDF** — Unduh soal dalam format PDF siap cetak
- **Autentikasi** — Login via email/password atau Google OAuth
- **Profil Pengguna** — Simpan informasi sekolah dan mata pelajaran

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 19, TanStack Router, TanStack Query |
| UI | Tailwind CSS, Radix UI, shadcn/ui, Lucide Icons |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| AI | Google Gemini 2.5 Flash Lite (`@google/generative-ai`) |
| PDF | jsPDF |
| Validasi | Zod, React Hook Form |
| Build | Vite, TanStack Start |

---

## Cara Menjalankan

### 1. Clone repo

```bash
git clone https://github.com/username/UASGENERATESOAL.git
cd UASGENERATESOAL
```

### 2. Install dependencies

```bash
npm install
```

### 3. Buat file `.env`

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

> Dapatkan Gemini API Key di [Google AI Studio](https://aistudio.google.com/app/apikey)

### 4. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:8080](http://localhost:8080)

---

## Struktur Proyek

```
src/
├── routes/
│   ├── _authenticated/
│   │   ├── dashboard.tsx     # Generator soal + step Tinjau & Simpan
│   │   ├── library.tsx       # Bank soal
│   │   ├── sets.$id.tsx      # Detail set soal + ekspor PDF
│   │   └── profile.tsx       # Halaman profil pengguna
│   └── auth.tsx              # Halaman login & daftar
├── lib/
│   └── generate.functions.ts # Server function: generate & simpan soal via Gemini
└── integrations/
    └── supabase/             # Client & tipe Supabase
```

---

## Skema Database (Supabase)

- `profiles` — Data profil pengguna
- `question_sets` — Set soal (judul, mapel, jenjang, tipe, distribusi Bloom)
- `questions` — Soal individual (teks, pilihan, kunci, penjelasan, rubrik)

---

## Lisensi

MIT License — bebas digunakan dan dimodifikasi.
