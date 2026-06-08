import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Bank Soal — Soal HOTS AI" }] }),
  component: Library,
});

function Library () {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["sets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("question_sets")
        .select("id,title,subject,grade_level,question_type,total_questions,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter(item => {
      const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subject.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === "all" || item.question_type === filterType;
      const matchGrade = filterGrade === "all" || item.grade_level === filterGrade;
      return matchSearch && matchType && matchGrade;
    });
  }, [data, searchQuery, filterType, filterGrade]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bank Soal</h1>
        <p className="text-muted-foreground mt-1">Semua paket soal yang Anda simpan.</p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan judul atau mata pelajaran..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter tipe soal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              <SelectItem value="pilihan_ganda">Pilihan Ganda</SelectItem>
              <SelectItem value="esai">Esai</SelectItem>
              <SelectItem value="benar_salah">Benar/Salah</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter jenjang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua jenjang</SelectItem>
              <SelectItem value="SD">SD</SelectItem>
              <SelectItem value="SMP">SMP</SelectItem>
              <SelectItem value="SMA_SMK">SMA/SMK</SelectItem>
              <SelectItem value="Kuliah">Perguruan Tinggi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Memuat…</p>}
      {data && filteredData.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <BookOpen className="size-8 mx-auto mb-3 opacity-60" />
          {data.length === 0 ? "Belum ada paket soal. Mulai dari Generator." : "Tidak ada hasil yang sesuai dengan filter."}
        </CardContent></Card>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {filteredData?.map((s) => (
          <Link key={s.id} to="/sets/$id" params={{ id: s.id }}>
            <Card className="hover:border-primary/50 transition cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">{s.subject} · {s.grade_level?.replace("_", "/")}</div>
                    <div className="flex gap-2 mt-3">
                      <Badge variant="outline">{s.total_questions} soal</Badge>
                      <Badge variant="outline">{s.question_type?.replace("_", " ") ?? "-"}</Badge>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}