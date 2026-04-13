"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookmarkPlus, Brain, CheckCircle2, ChevronLeft, Clapperboard,
  Compass, Copy, Download, Eye, EyeOff, Flame, Ghost, Heart, HeartHandshake, Laugh,
  Library, Link2, Loader2, LogOut, Play, Popcorn, RefreshCw, Rocket, Share2,
  Sparkles, Star, Trash2, Tv, UserRound, Users, X, Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ═══════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════ */

type Tab = "descobrir" | "cinemateca";
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type MoodName = "Adrenalina" | "Risadas" | "Reflexão" | "Aconchego" | "Arrepio" | "Nostalgia";
type Ritmo = "eletrizante" | "slow_burn" | "curto_direto" | "montanha_russa" | "progressivo" | "denso";
type Protagonista = "anti_heroi" | "inspirador" | "genio" | "grupo" | "underdog" | "vilao_carismatico";
type Vibe = "leve_divertido" | "tensao_constante" | "para_chorar" | "terror_puro" | "trama_filosofica" | "mind_blowing";
type Companhia = "solo" | "date_night" | "familia_kids" | "amigos_party" | "pais" | "casal";
type Epoca = "idade_de_ouro" | "classicos_cult" | "anos_90" | "era_moderna" | "blockbusters_recentes" | "lancamentos";
type Streaming = "netflix" | "prime" | "disney" | "max" | "apple" | "globoplay";
type CinematecaFilter = "todos" | "para_ver" | "ja_visto";

type Movie = {
  id: number; title: string; overview: string;
  poster_path: string | null; backdrop_path: string | null;
  release_date: string; vote_average: number;
};

type CinematecaItem = {
  id?: string; user_phone: string; user_name: string;
  movie_id: number; movie_title: string; poster_path: string | null;
  status: "para_ver" | "ja_visto"; rating: number | null;
};

type QuizState = {
  mood: Mood | null; ritmo: Ritmo | null; protagonista: Protagonista | null;
  vibe: Vibe | null; companhia: Companhia | null; epoca: Epoca | null;
  streamings: Streaming[];
};

type Mood = { nome: MoodName; categoria: string; tmdbGenreId: number; Icone: React.ElementType };
type MoodTheme = { bg: string; glow: string; border: string };
type ToastMessage = { id: number; text: string; type: "success" | "error" | "info" };

/* ═══════════════════════════════════════════
   CONSTANTES & CONFIGURAÇÃO
   ═══════════════════════════════════════════ */

const MAX_BLACKLIST = 200;

const MOODS: Mood[] = [
  { nome: "Adrenalina", categoria: "Ação/Aventura", tmdbGenreId: 28, Icone: Flame },
  { nome: "Risadas", categoria: "Comédia", tmdbGenreId: 35, Icone: Laugh },
  { nome: "Reflexão", categoria: "Drama/Sci-Fi", tmdbGenreId: 18, Icone: Brain },
  { nome: "Aconchego", categoria: "Romance/Feel-good", tmdbGenreId: 10749, Icone: Heart },
  { nome: "Arrepio", categoria: "Terror/Suspense", tmdbGenreId: 27, Icone: Ghost },
  { nome: "Nostalgia", categoria: "Clássicos/Feel-good", tmdbGenreId: 10751, Icone: Popcorn },
];

const MOOD_THEME: Record<MoodName, MoodTheme> = {
  Adrenalina: { bg: "radial-gradient(circle at 20% 20%, rgba(239,68,68,0.4), transparent 40%), #100707", glow: "rgba(239,68,68,0.5)", border: "rgba(239,68,68,0.6)" },
  Risadas: { bg: "radial-gradient(circle at 18% 18%, rgba(250,204,21,0.3), transparent 40%), #130f07", glow: "rgba(250,204,21,0.4)", border: "rgba(250,204,21,0.5)" },
  Reflexão: { bg: "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.3), transparent 40%), #070a14", glow: "rgba(99,102,241,0.4)", border: "rgba(125,211,252,0.5)" },
  Aconchego: { bg: "radial-gradient(circle at 20% 18%, rgba(251,191,36,0.3), transparent 40%), #161006", glow: "rgba(251,191,36,0.4)", border: "rgba(251,191,36,0.5)" },
  Arrepio: { bg: "radial-gradient(circle at 18% 16%, rgba(168,85,247,0.3), transparent 40%), #06040d", glow: "rgba(168,85,247,0.5)", border: "rgba(196,181,253,0.5)" },
  Nostalgia: { bg: "radial-gradient(circle at 20% 16%, rgba(14,165,233,0.3), transparent 40%), #070913", glow: "rgba(244,114,182,0.4)", border: "rgba(125,211,252,0.5)" },
};

const STREAMINGS = [
  { id: "netflix" as const, nome: "Netflix", providerId: "8", brandClass: "text-red-400 border-red-400/50 bg-red-500/10" },
  { id: "prime" as const, nome: "Prime Video", providerId: "119", brandClass: "text-sky-300 border-sky-400/50 bg-sky-500/10" },
  { id: "disney" as const, nome: "Disney+", providerId: "337", brandClass: "text-indigo-300 border-indigo-400/50 bg-indigo-500/10" },
  { id: "max" as const, nome: "Max", providerId: "384", brandClass: "text-violet-300 border-violet-400/50 bg-violet-500/10" },
  { id: "apple" as const, nome: "Apple TV", providerId: "350", brandClass: "text-zinc-100 border-zinc-300/50 bg-zinc-200/10" },
  { id: "globoplay" as const, nome: "Globoplay", providerId: "307", brandClass: "text-pink-300 border-pink-400/50 bg-pink-500/10" },
];

const STEP_CONFIG: Record<number, { title: string; sub: string }> = {
  1: { title: "Qual o clima de hoje?", sub: "Escolha o mood que combina com o momento" },
  2: { title: "E o ritmo?", sub: "Como você quer que o filme te leve" },
  3: { title: "Quem lidera a história?", sub: "O tipo de protagonista ideal" },
  4: { title: "Qual a vibe?", sub: "A sensação que você quer sentir" },
  5: { title: "Assistindo com quem?", sub: "A companhia muda tudo" },
  6: { title: "De qual época?", sub: "Viaje no tempo do cinema" },
  7: { title: "Onde você assiste?", sub: "Selecione seus streamings ou pule" },
};

type QuizOption = { id: string; label: string; Icon: React.ElementType; sub?: string };

const QUIZ_STEPS: Record<number, QuizOption[]> = {
  2: [
    { id: "eletrizante", label: "Eletrizante", Icon: Rocket },
    { id: "slow_burn", label: "Fogo Baixo", Icon: Sparkles },
    { id: "curto_direto", label: "Curto e Direto", Icon: Zap },
    { id: "montanha_russa", label: "Montanha-russa", Icon: RefreshCw },
    { id: "progressivo", label: "Progressivo", Icon: Brain },
    { id: "denso", label: "Denso", Icon: Ghost },
  ],
  3: [
    { id: "anti_heroi", label: "Anti-herói", Icon: Ghost },
    { id: "inspirador", label: "Inspirador", Icon: Heart },
    { id: "genio", label: "Gênio", Icon: Brain },
    { id: "grupo", label: "Grupo", Icon: Users },
    { id: "underdog", label: "Azarão", Icon: UserRound },
    { id: "vilao_carismatico", label: "Vilão", Icon: Flame },
  ],
  4: [
    { id: "leve_divertido", label: "Leve e Divertido", Icon: Laugh },
    { id: "tensao_constante", label: "Tensão Total", Icon: Rocket },
    { id: "para_chorar", label: "Pra Chorar", Icon: Heart },
    { id: "terror_puro", label: "Terror Puro", Icon: Ghost },
    { id: "trama_filosofica", label: "Filosófico", Icon: Brain },
    { id: "mind_blowing", label: "Fritar Cérebro", Icon: Sparkles },
  ],
  5: [
    { id: "solo", label: "Só Eu", Icon: UserRound },
    { id: "date_night", label: "Sessão a Dois", Icon: Heart },
    { id: "familia_kids", label: "Família", Icon: Popcorn },
    { id: "amigos_party", label: "Amigos", Icon: Users },
    { id: "pais", label: "Com os Pais", Icon: HeartHandshake },
    { id: "casal", label: "Casal", Icon: Heart },
  ],
  6: [
    { id: "idade_de_ouro", label: "Era de Ouro", sub: "1940–1960", Icon: Star },
    { id: "classicos_cult", label: "Cult", sub: "1970–1980", Icon: Clapperboard },
    { id: "anos_90", label: "Anos 90", sub: "1990–1999", Icon: Tv },
    { id: "era_moderna", label: "Moderna", sub: "2000–2015", Icon: Sparkles },
    { id: "blockbusters_recentes", label: "Recentes", sub: "2016–2024", Icon: Rocket },
    { id: "lancamentos", label: "Lançamentos", sub: "2025+", Icon: Zap },
  ],
};

const QUIZ_FIELD_MAP: Record<number, keyof QuizState> = {
  2: "ritmo", 3: "protagonista", 4: "vibe", 5: "companhia", 6: "epoca",
};

const SELECTION_LABELS: Record<string, string> = {
  eletrizante: "Eletrizante", slow_burn: "Fogo Baixo", curto_direto: "Curto e Direto",
  montanha_russa: "Montanha-russa", progressivo: "Progressivo", denso: "Denso",
  anti_heroi: "Anti-herói", inspirador: "Inspirador", genio: "Gênio",
  grupo: "Grupo", underdog: "Azarão", vilao_carismatico: "Vilão",
  leve_divertido: "Leve", tensao_constante: "Tensão", para_chorar: "Chorar",
  terror_puro: "Terror", trama_filosofica: "Filosófico", mind_blowing: "Mind Blow",
  solo: "Solo", date_night: "A Dois", familia_kids: "Família",
  amigos_party: "Amigos", pais: "Pais", casal: "Casal",
  idade_de_ouro: "1940-60", classicos_cult: "Cult", anos_90: "Anos 90",
  era_moderna: "Moderna", blockbusters_recentes: "Recentes", lancamentos: "Lançamentos",
};

const LOADING_MESSAGES = [
  "Vasculhando catálogos...",
  "Consultando os críticos...",
  "Analisando seu perfil...",
  "Quase lá...",
];

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, value); } catch {}
}
function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(key); } catch {}
}
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
function phoneDigits(formatted: string): string { return formatted.replace(/\D/g, ""); }

/** Quebra texto em linhas para caber no canvas */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else { current = test; }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3); // max 3 linhas
}

/* ═══════════════════════════════════════════
   COMPONENTES AUXILIARES
   ═══════════════════════════════════════════ */

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-[200] flex flex-col gap-3 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl text-sm font-medium w-full sm:max-w-sm ${
              t.type === "success" ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-200" : t.type === "error" ? "bg-red-950/80 border-red-500/30 text-red-200" : "bg-zinc-900/80 border-white/10 text-zinc-200"}`}>
            {t.type === "success" && <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />}
            {t.type === "error" && <X size={18} className="shrink-0 text-red-400" />}
            {t.type === "info" && <Sparkles size={18} className="shrink-0 text-zinc-400" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => onDismiss(t.id)} className="shrink-0 text-white/40 hover:text-white transition" aria-label="Fechar"><X size={14} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function QuizCard({ Icon, label, sub, onClick, delay = 0, accentColor }: {
  Icon: React.ElementType; label: string; sub?: string; onClick: () => void; delay?: number; accentColor?: string;
}) {
  return (
    <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.05, duration: 0.3 }}
      onClick={onClick}
      className="p-5 sm:p-6 bg-white/[0.04] border border-white/[0.06] rounded-3xl text-left hover:bg-white/10 hover:border-white/15 transition-all duration-300 group active:scale-[0.97]">
      <Icon className="mb-3 transition-colors duration-300" style={{ color: accentColor || undefined }} size={24} />
      <p className="font-bold text-[15px] leading-tight">{label}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
    </motion.button>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <div key={n} className={`rounded-full transition-all duration-500 ${
          n < current ? "w-2 h-2 bg-white/40" : n === current ? "w-6 h-2 bg-white/80 rounded-full" : "w-2 h-2 bg-white/[0.08]"}`} />
      ))}
    </div>
  );
}

function StarRating({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} onClick={() => onChange?.(s === value ? 0 : s)} disabled={!onChange}
          className={`transition-colors ${onChange ? "cursor-pointer hover:text-amber-300" : "cursor-default"} ${s <= value ? "text-amber-400" : "text-zinc-700"}`}
          aria-label={`${s} estrela${s > 1 ? "s" : ""}`}>
          <Star size={size} fill={s <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function QuizSummaryChips({ quiz }: { quiz: QuizState }) {
  const chips: string[] = [];
  if (quiz.mood) chips.push(quiz.mood.nome);
  if (quiz.ritmo) chips.push(SELECTION_LABELS[quiz.ritmo] || quiz.ritmo);
  if (quiz.protagonista) chips.push(SELECTION_LABELS[quiz.protagonista] || quiz.protagonista);
  if (quiz.vibe) chips.push(SELECTION_LABELS[quiz.vibe] || quiz.vibe);
  if (quiz.companhia) chips.push(SELECTION_LABELS[quiz.companhia] || quiz.companhia);
  if (quiz.epoca) chips.push(SELECTION_LABELS[quiz.epoca] || quiz.epoca);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {chips.map((c, i) => (
        <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.06] font-medium text-white/50">{c}</span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TMDB API HELPERS
   ═══════════════════════════════════════════ */

function getTmdbHeaders() { return { Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_API_KEY}` }; }

function buildDiscoverParams(quiz: QuizState, withProviders: boolean, page: number): URLSearchParams {
  const params = new URLSearchParams({ language: "pt-BR", include_adult: "false", region: "BR", sort_by: "popularity.desc", page: String(page) });
  if (quiz.mood) params.set("with_genres", String(quiz.mood.tmdbGenreId));
  if (withProviders && quiz.streamings.length > 0) {
    const providers = quiz.streamings.map((s) => STREAMINGS.find((p) => p.id === s)?.providerId).filter(Boolean).join("|");
    params.set("with_watch_providers", providers); params.set("watch_region", "BR"); params.set("with_watch_monetization_types", "flatrate");
  }
  return params;
}

async function fetchFilteredMovie(quiz: QuizState, withProviders: boolean, blacklist: number[]): Promise<Movie | null> {
  const headers = getTmdbHeaders();
  for (let page = 1; page <= 5; page++) {
    const params = buildDiscoverParams(quiz, withProviders, page);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/discover/movie?${params.toString()}`, { headers });
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      const data = await res.json();
      const found = (data.results ?? []).find((m: Movie) => !blacklist.includes(m.id) && m.poster_path);
      if (found) return found;
      if (data.total_pages && page >= data.total_pages) break;
    } catch (err) { console.error("TMDB discover error:", err); return null; }
  }
  return null;
}

async function fetchMovieTrailerKey(movieId: number): Promise<string | null> {
  const headers = getTmdbHeaders();
  try {
    for (const lang of ["pt-BR", "en-US"]) {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?language=${lang}`, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      const trailer = data.results?.find((v: any) => v.type === "Trailer" && v.site === "YouTube");
      if (trailer?.key) return trailer.key;
    }
  } catch (err) { console.error("TMDB trailer error:", err); }
  return null;
}

/* ═══════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════ */

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("descobrir");
  const [step, setStep] = useState<Step>(1);
  const [quiz, setQuiz] = useState<QuizState>({ mood: null, ritmo: null, protagonista: null, vibe: null, companhia: null, epoca: null, streamings: [] });
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [cinemateca, setCinemateca] = useState<CinematecaItem[]>([]);
  const [cinematecaLoading, setCinematecaLoading] = useState(false);
  const [cinematecaFilter, setCinematecaFilter] = useState<CinematecaFilter>("todos");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [shareLoading, setShareLoading] = useState(false);

  const quizRef = useRef(quiz);
  quizRef.current = quiz;
  const loadingInterval = useRef<NodeJS.Timeout | null>(null);

  const toast = useCallback((text: string, type: ToastMessage["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const loadCinemateca = useCallback(async (phone: string) => {
    setCinematecaLoading(true);
    try {
      const { data, error } = await supabase.from("cinemateca").select("*").eq("user_phone", phone).order("created_at", { ascending: false });
      if (error) throw error;
      if (data) setCinemateca(data);
    } catch (err) { console.error("Erro ao carregar cinemateca:", err); }
    finally { setCinematecaLoading(false); }
  }, []);

  useEffect(() => {
    setMounted(true);
    const savedName = safeGetItem("userName");
    const savedPhone = safeGetItem("userPhone");
    if (savedName && savedPhone) {
      setUserName(savedName); setUserPhone(savedPhone); setHasOnboarded(true);
      loadCinemateca(savedPhone);
    }
  }, [loadCinemateca]);

  useEffect(() => {
    if (isLoading) {
      setLoadingMsg(0);
      loadingInterval.current = setInterval(() => setLoadingMsg((p) => (p + 1) % LOADING_MESSAGES.length), 1800);
    } else { if (loadingInterval.current) clearInterval(loadingInterval.current); }
    return () => { if (loadingInterval.current) clearInterval(loadingInterval.current); };
  }, [isLoading]);

  const handleOnboarding = useCallback(async () => {
    const cleanPhone = phoneDigits(userPhone);
    if (!userName.trim() || cleanPhone.length < 10) { toast("Preencha seu nome e um telefone válido.", "error"); return; }
    safeSetItem("userName", userName.trim()); safeSetItem("userPhone", cleanPhone);
    try { await supabase.from("visitors").insert({ name: userName.trim(), phone: cleanPhone }); } catch {}
    setHasOnboarded(true); loadCinemateca(cleanPhone);
  }, [userName, userPhone, loadCinemateca, toast]);

  const resetQuiz = useCallback(() => {
    setQuiz({ mood: null, ritmo: null, protagonista: null, vibe: null, companhia: null, epoca: null, streamings: [] });
    setMovie(null); setStep(1);
  }, []);

  const handleLogout = useCallback(() => {
    safeRemoveItem("userName"); safeRemoveItem("userPhone"); safeRemoveItem("movieMood_blacklist");
    setUserName(""); setUserPhone(""); setHasOnboarded(false); setCinemateca([]); resetQuiz();
  }, [resetQuiz]);

  const discoverMovie = useCallback(async (ignoreCurrent = false) => {
    setIsLoading(true);
    try {
      const raw = safeGetItem("movieMood_blacklist") || "[]";
      let blacklist: number[] = JSON.parse(raw);
      if (ignoreCurrent && movie) {
        blacklist.push(movie.id);
        if (blacklist.length > MAX_BLACKLIST) blacklist = blacklist.slice(-MAX_BLACKLIST);
        safeSetItem("movieMood_blacklist", JSON.stringify(blacklist));
      }
      let result = await fetchFilteredMovie(quizRef.current, true, blacklist);
      if (!result) result = await fetchFilteredMovie(quizRef.current, false, blacklist);
      if (result) { setMovie(result); setStep(8); }
      else { toast("Nenhum filme encontrado com esses filtros. Tente outras opções!", "error"); }
    } catch { toast("Erro ao buscar filme. Tente novamente.", "error"); }
    finally { setIsLoading(false); }
  }, [movie, toast]);

  const addToCinemateca = useCallback(async (m: Movie) => {
    if (cinemateca.some((item) => item.movie_id === m.id)) { toast("Já está na sua Cinemateca!", "info"); return; }
    const phone = phoneDigits(userPhone) || safeGetItem("userPhone") || "";
    const name = userName || safeGetItem("userName") || "";
    const item: CinematecaItem = { user_phone: phone, user_name: name, movie_id: m.id, movie_title: m.title, poster_path: m.poster_path, status: "para_ver", rating: null };
    try {
      const { data, error } = await supabase.from("cinemateca").upsert(item).select();
      if (error) throw error;
      setCinemateca((prev) => [data?.[0] ?? item, ...prev]);
      toast("Adicionado à Cinemateca!", "success");
    } catch { toast("Erro ao salvar.", "error"); }
  }, [cinemateca, userPhone, userName, toast]);

  const toggleStatus = useCallback(async (item: CinematecaItem) => {
    const newStatus = item.status === "para_ver" ? "ja_visto" : "para_ver";
    try {
      const { error } = await supabase.from("cinemateca").update({ status: newStatus }).eq("id", item.id);
      if (error) throw error;
      setCinemateca((prev) => prev.map((c) => (c.id === item.id ? { ...c, status: newStatus as any } : c)));
      toast(newStatus === "ja_visto" ? "Marcado como assistido!" : "Voltou pra lista!", "success");
    } catch { toast("Erro ao atualizar.", "error"); }
  }, [toast]);

  const updateRating = useCallback(async (item: CinematecaItem, rating: number) => {
    try {
      const { error } = await supabase.from("cinemateca").update({ rating }).eq("id", item.id);
      if (error) throw error;
      setCinemateca((prev) => prev.map((c) => (c.id === item.id ? { ...c, rating } : c)));
    } catch {}
  }, []);

  const removeFromCinemateca = useCallback(async (item: CinematecaItem) => {
    try {
      const { error } = await supabase.from("cinemateca").delete().eq("id", item.id);
      if (error) throw error;
      setCinemateca((prev) => prev.filter((c) => c.id !== item.id));
      setExpandedCard(null); toast("Removido da Cinemateca.", "info");
    } catch { toast("Erro ao remover.", "error"); }
  }, [toast]);

  const shareMovie = useCallback(async (m: Movie) => {
    setShareLoading(true);
    try {
      const W = 1080, H = 1920;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // --- Fundo gradiente baseado no mood ---
      const moodName = quiz.mood?.nome || "Nostalgia";
      const gradColors: Record<string, [string, string]> = {
        Adrenalina: ["#2d0a0a", "#100707"], Risadas: ["#2d2506", "#130f07"],
        Reflexão: ["#0a1230", "#070a14"], Aconchego: ["#2d2006", "#161006"],
        Arrepio: ["#1a0830", "#06040d"], Nostalgia: ["#0a1230", "#070913"],
      };
      const [c1, c2] = gradColors[moodName] || gradColors.Nostalgia;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

      // --- Glow circular sutil ---
      const currentTheme = quiz.mood ? MOOD_THEME[quiz.mood.nome] : MOOD_THEME["Nostalgia"];
      const glowGrad = ctx.createRadialGradient(W * 0.5, H * 0.25, 0, W * 0.5, H * 0.25, W * 0.7);
      glowGrad.addColorStop(0, currentTheme.glow.replace("0.5)", "0.15)").replace("0.4)", "0.12)"));
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad; ctx.fillRect(0, 0, W, H);

      // --- Poster (fetch como blob para evitar CORS) ---
      const posterUrl = `https://image.tmdb.org/t/p/w780${m.poster_path}`;
      let posterImg: HTMLImageElement | null = null;
      try {
        const res = await fetch(posterUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        posterImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = blobUrl;
        });
        URL.revokeObjectURL(blobUrl);
      } catch { /* poster indisponível */ }

      if (posterImg) {
        const pw = 680, ph = 1020;
        const px = (W - pw) / 2, py = 200;
        // Sombra do poster
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20;
        // Poster com bordas arredondadas
        const r = 36;
        ctx.beginPath(); ctx.moveTo(px + r, py); ctx.lineTo(px + pw - r, py);
        ctx.quadraticCurveTo(px + pw, py, px + pw, py + r); ctx.lineTo(px + pw, py + ph - r);
        ctx.quadraticCurveTo(px + pw, py + ph, px + pw - r, py + ph); ctx.lineTo(px + r, py + ph);
        ctx.quadraticCurveTo(px, py + ph, px, py + ph - r); ctx.lineTo(px, py + r);
        ctx.quadraticCurveTo(px, py, px + r, py); ctx.closePath();
        ctx.save(); ctx.clip();
        ctx.drawImage(posterImg, px, py, pw, ph);
        ctx.restore();
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        // Borda sutil
        ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + r, py); ctx.lineTo(px + pw - r, py);
        ctx.quadraticCurveTo(px + pw, py, px + pw, py + r); ctx.lineTo(px + pw, py + ph - r);
        ctx.quadraticCurveTo(px + pw, py + ph, px + pw - r, py + ph); ctx.lineTo(px + r, py + ph);
        ctx.quadraticCurveTo(px, py + ph, px, py + ph - r); ctx.lineTo(px, py + r);
        ctx.quadraticCurveTo(px, py, px + r, py); ctx.closePath(); ctx.stroke();
      }

      const textY = posterImg ? 1280 : 600;

      // --- Título ---
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
      ctx.font = "bold 56px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      const titleLines = wrapText(ctx, m.title, W - 160, 56);
      titleLines.forEach((line, i) => ctx.fillText(line, W / 2, textY + i * 68));

      // --- Nota + Ano + Mood ---
      const infoY = textY + titleLines.length * 68 + 30;
      ctx.font = "600 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      const infoStr = `⭐ ${m.vote_average.toFixed(1)}  •  ${m.release_date?.split("-")[0] || "—"}${quiz.mood ? `  •  ${quiz.mood.nome}` : ""}`;
      ctx.fillText(infoStr, W / 2, infoY);

      // --- Linha divisória ---
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W * 0.3, infoY + 50); ctx.lineTo(W * 0.7, infoY + 50); ctx.stroke();

      // --- Branding "Movie Mood" ---
      ctx.font = "700 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillText("🎬  MOVIE MOOD", W / 2, infoY + 110);

      // --- Top branding ---
      ctx.font = "600 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.textAlign = "center";
      ctx.fillText("MOVIE MOOD", W / 2, 100);
      ctx.font = "400 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillText("moviemood.app", W / 2, 135);

      // --- Gerar imagem ---
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) { toast("Erro ao gerar imagem.", "error"); return; }
      const file = new File([blob], `movie-mood-${m.id}.png`, { type: "image/png" });

      // --- Compartilhar ou baixar ---
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: m.title, text: `${m.title} — recomendado pelo Movie Mood!`, files: [file] });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = file.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast("Imagem salva! Poste nos seus stories.", "success");
      }
    } catch (err) {
      console.error("Share error:", err);
      toast("Erro ao compartilhar.", "error");
    } finally { setShareLoading(false); }
  }, [quiz.mood, toast]);

  const openTrailer = useCallback(async (movieId: number) => {
    setTrailerOpen(true); setTrailerKey(null);
    const key = await fetchMovieTrailerKey(movieId); setTrailerKey(key);
  }, []);

  const goBack = useCallback(() => {
    if (step === 1) return;
    if (step === 8) { setMovie(null); setStep(7); return; }
    setStep((s) => (s - 1) as Step);
  }, [step]);

  const handleQuizSelect = useCallback((stepNum: number, value: string) => {
    const field = QUIZ_FIELD_MAP[stepNum]; if (!field) return;
    setQuiz((prev) => ({ ...prev, [field]: value }));
    setStep((stepNum + 1) as Step);
  }, []);

  const handleMoodSelect = useCallback((m: Mood) => { setQuiz((prev) => ({ ...prev, mood: m })); setStep(2); }, []);

  const toggleStreaming = useCallback((sid: Streaming) => {
    setQuiz((prev) => ({ ...prev, streamings: prev.streamings.includes(sid) ? prev.streamings.filter((x) => x !== sid) : [...prev.streamings, sid] }));
  }, []);

  const theme = quiz.mood ? MOOD_THEME[quiz.mood.nome] : MOOD_THEME["Nostalgia"];
  const accentColor = quiz.mood ? theme.glow : undefined;
  const firstName = userName.split(" ")[0];

  const filteredCinemateca = useMemo(() => {
    if (cinematecaFilter === "todos") return cinemateca;
    return cinemateca.filter((c) => c.status === cinematecaFilter);
  }, [cinemateca, cinematecaFilter]);

  const stats = useMemo(() => ({
    total: cinemateca.length,
    paraVer: cinemateca.filter((c) => c.status === "para_ver").length,
    jaVisto: cinemateca.filter((c) => c.status === "ja_visto").length,
  }), [cinemateca]);

  if (!mounted) return <main className="min-h-screen bg-[#070913]" />;

  return (
    <main className="min-h-screen text-white transition-all duration-700 relative" style={{ background: theme.bg }}>
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />

      <div className="relative z-10 p-4 sm:p-6">

        {!hasOnboarded ? (
          <div className="max-w-md mx-auto mt-16 sm:mt-24">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="p-8 sm:p-10 bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-[2.5rem] shadow-2xl">
              <div className="flex items-center gap-2 mb-1"><Clapperboard size={14} className="text-zinc-500" /><p className="text-zinc-500 uppercase text-[10px] tracking-[0.3em] font-semibold">Movie Mood</p></div>
              <h1 className="text-3xl font-bold mb-2 tracking-tight">E aí, cinéfilo!</h1>
              <p className="text-zinc-500 text-sm mb-8">Conte um pouco sobre você e descubra o filme perfeito pra agora.</p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block">Seu nome</label>
                  <input id="name" className="w-full bg-white/[0.04] border border-white/[0.08] p-4 rounded-2xl outline-none focus:border-white/25 transition placeholder:text-zinc-600" placeholder="Ex: Joana" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && document.getElementById("phone")?.focus()} />
                </div>
                <div>
                  <label htmlFor="phone" className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block">WhatsApp</label>
                  <input id="phone" inputMode="numeric" className="w-full bg-white/[0.04] border border-white/[0.08] p-4 rounded-2xl outline-none focus:border-white/25 transition placeholder:text-zinc-600" placeholder="(00) 00000-0000" value={userPhone} onChange={(e) => setUserPhone(formatPhone(e.target.value))} onKeyDown={(e) => e.key === "Enter" && handleOnboarding()} />
                  <p className="text-[10px] text-zinc-600 mt-1.5 ml-1">Usado pra salvar sua cinemateca pessoal</p>
                </div>
                <button className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition active:scale-[0.98] mt-2" onClick={handleOnboarding}>Bora Descobrir</button>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <header className="flex flex-wrap justify-between items-center gap-4 mb-10">
              <h2 className="text-xl sm:text-2xl font-semibold">{activeTab === "descobrir" ? `${firstName}, bora escolher um filme?` : `Cinemateca de ${firstName}`}</h2>
              <div className="flex items-center gap-2">
                <nav className="flex bg-black/30 backdrop-blur-md p-1 rounded-full border border-white/[0.06]">
                  {(["descobrir", "cinemateca"] as Tab[]).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === tab ? "bg-white/[0.12] shadow-lg text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                      {tab === "descobrir" ? <span className="flex items-center gap-1.5"><Compass size={14} /> Descobrir</span>
                        : <span className="flex items-center gap-1.5"><Library size={14} /> Cinemateca {stats.total > 0 && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full ml-0.5">{stats.total}</span>}</span>}
                    </button>
                  ))}
                </nav>
                <button onClick={handleLogout} className="p-2 rounded-full text-zinc-600 hover:text-white hover:bg-white/5 transition" title="Sair" aria-label="Sair"><LogOut size={16} /></button>
              </div>
            </header>

            {activeTab === "descobrir" && (
              <div className="max-w-4xl mx-auto">
                {step < 8 ? (
                  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 md:p-12 rounded-[2.5rem] border border-white/[0.06] shadow-2xl">
                    <div className="flex items-center gap-3 mb-5">
                      {step > 1 ? <button onClick={goBack} className="p-2.5 -ml-2 rounded-2xl hover:bg-white/5 transition text-zinc-500 hover:text-white" aria-label="Voltar"><ChevronLeft size={22} /></button> : <div className="w-[42px]" />}
                      <div className="flex-1 flex justify-center"><ProgressDots current={step} total={7} /></div>
                      <div className="w-[42px]" />
                    </div>
                    <QuizSummaryChips quiz={quiz} />
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{STEP_CONFIG[step]?.title || ""}</h3>
                    <p className="text-zinc-500 text-sm mt-1 mb-6">{STEP_CONFIG[step]?.sub || ""}</p>
                    <AnimatePresence mode="wait">
                      <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                        {step === 1 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                            {MOODS.map((m, i) => <QuizCard key={m.nome} Icon={m.Icone} label={m.nome} sub={m.categoria} onClick={() => handleMoodSelect(m)} delay={i} />)}
                          </div>
                        )}
                        {[2, 3, 4, 5, 6].includes(step) && QUIZ_STEPS[step] && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                            {QUIZ_STEPS[step].map((item, i) => <QuizCard key={item.id} Icon={item.Icon} label={item.label} sub={item.sub} onClick={() => handleQuizSelect(step, item.id)} delay={i} accentColor={accentColor} />)}
                          </div>
                        )}
                        {step === 7 && (
                          <div className="text-center py-4 sm:py-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-8">
                              {STREAMINGS.map((s, i) => (
                                <motion.button key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                  onClick={() => toggleStreaming(s.id)}
                                  className={`p-4 border rounded-2xl transition-all duration-300 font-medium text-sm active:scale-[0.97] ${quiz.streamings.includes(s.id) ? s.brandClass + " border-current shadow-lg" : "border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"}`}>{s.nome}</motion.button>
                              ))}
                            </div>
                            <p className="text-zinc-600 text-xs mb-6">{quiz.streamings.length === 0 ? "Sem preferência? Buscamos em tudo!" : `${quiz.streamings.length} plataforma${quiz.streamings.length > 1 ? "s" : ""}`}</p>
                            <button className="px-10 sm:px-12 py-4 sm:py-5 bg-white text-black font-bold rounded-2xl hover:scale-[1.03] active:scale-[0.98] transition-transform shadow-xl shadow-white/5" onClick={() => discoverMovie()}>
                              <span className="flex items-center gap-2"><Sparkles size={18} /> Encontrar Meu Filme</span>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.section>
                ) : movie && (
                  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="grid md:grid-cols-[360px_1fr] lg:grid-cols-[400px_1fr] gap-8 md:gap-12 items-start">
                    <div className="relative group mx-auto md:mx-0 max-w-[360px] md:max-w-none">
                      <div className="absolute -inset-1 rounded-[2.2rem] opacity-30 blur-xl" style={{ background: theme.glow }} />
                      <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                        <Image src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} width={400} height={600} className="w-full" alt={`Poster de ${movie.title}`} priority />
                        <button onClick={() => openTrailer(movie.id)} className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-transparent to-transparent sm:bg-black/40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300" aria-label="Assistir trailer">
                          <div className="bg-white/90 sm:bg-white p-3.5 sm:p-4 rounded-full text-black shadow-xl hover:scale-110 transition-transform"><Play fill="black" size={22} /></div>
                        </button>
                      </div>
                    </div>
                    <div>
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">Selecionado pra você</motion.p>
                      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5 tracking-tight leading-tight">{movie.title}</motion.h1>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="flex flex-wrap gap-2 mb-8">
                        <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-400 flex items-center gap-1.5"><Star size={12} fill="currentColor" /> {movie.vote_average.toFixed(1)}</span>
                        <span className="px-3 py-1.5 bg-zinc-800/80 border border-white/5 rounded-xl text-xs font-bold text-zinc-400">{movie.release_date?.split("-")[0] || "—"}</span>
                        {quiz.mood && <span className="px-3 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5" style={{ borderColor: theme.border, color: theme.glow, background: `${theme.glow}15` }}><quiz.mood.Icone size={12} /> {quiz.mood.nome}</span>}
                      </motion.div>
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-10">{movie.overview || "Uma obra selecionada especialmente para o seu momento."}</motion.p>
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-3">
                        <button onClick={() => addToCinemateca(movie)} className="px-6 sm:px-8 py-3.5 bg-white text-black border border-white rounded-2xl flex items-center gap-2.5 hover:bg-zinc-200 transition font-semibold active:scale-[0.97] text-sm sm:text-base"><BookmarkPlus size={18} /> Salvar</button>
                        <button onClick={() => discoverMovie(true)} className="px-6 sm:px-8 py-3.5 bg-white/10 border border-white/10 rounded-2xl flex items-center gap-2.5 hover:bg-white/20 transition font-semibold text-zinc-300 active:scale-[0.97] text-sm sm:text-base"><RefreshCw size={18} /> Outro filme</button>
                        <button onClick={() => shareMovie(movie)} disabled={shareLoading}
                          className="px-5 py-3.5 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-2 hover:bg-white/10 transition text-zinc-400 active:scale-[0.97] text-sm disabled:opacity-50">
                          {shareLoading ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} {shareLoading ? "Gerando..." : "Stories"}
                        </button>
                      </motion.div>
                      <button className="mt-8 text-zinc-600 hover:text-white transition text-sm flex items-center gap-1.5" onClick={resetQuiz}><ArrowLeft size={14} /> Novo quiz</button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {activeTab === "cinemateca" && (
              <div>
                <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
                  {([{ key: "todos" as const, label: "Todos", count: stats.total, icon: Library }, { key: "para_ver" as const, label: "Para ver", count: stats.paraVer, icon: Eye }, { key: "ja_visto" as const, label: "Assistidos", count: stats.jaVisto, icon: CheckCircle2 }]).map((f) => (
                    <button key={f.key} onClick={() => setCinematecaFilter(f.key)} className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${cinematecaFilter === f.key ? "bg-white/[0.12] text-white border border-white/10" : "bg-white/[0.03] text-zinc-500 border border-transparent hover:text-zinc-300"}`}>
                      <f.icon size={13} />{f.label} <span className="text-[10px] opacity-60">{f.count}</span>
                    </button>
                  ))}
                </div>

                {cinematecaLoading ? (
                  <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-zinc-500" size={28} /></div>
                ) : filteredCinemateca.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                      {cinematecaFilter === "ja_visto" ? <CheckCircle2 size={24} className="text-zinc-600" /> : cinematecaFilter === "para_ver" ? <Eye size={24} className="text-zinc-600" /> : <Popcorn size={24} className="text-zinc-600" />}
                    </div>
                    <p className="text-zinc-400 text-lg font-medium">{cinematecaFilter === "todos" ? "Sua cinemateca está vazia" : cinematecaFilter === "para_ver" ? "Nenhum filme pendente" : "Nenhum filme assistido ainda"}</p>
                    <p className="text-zinc-600 text-sm mt-2 max-w-xs mx-auto">{cinematecaFilter === "todos" ? "Descubra filmes e monte sua coleção pessoal." : "Os filmes vão aparecer aqui conforme você usar."}</p>
                    {cinematecaFilter === "todos" && (
                      <button onClick={() => setActiveTab("descobrir")} className="mt-6 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm font-semibold hover:bg-white/15 transition">
                        <span className="flex items-center gap-2"><Compass size={16} /> Descobrir filmes</span>
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                    <AnimatePresence>
                      {filteredCinemateca.map((item, i) => {
                        const isExpanded = expandedCard === item.id;
                        return (
                          <motion.div key={item.id ?? item.movie_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.03 }}
                            className="group bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.05] hover:border-white/15 transition-all duration-300">
                            <div className="relative aspect-[2/3] overflow-hidden cursor-pointer" onClick={() => setExpandedCard(isExpanded ? null : item.id || null)}>
                              <Image src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw" className="object-cover transition-transform duration-500 group-hover:scale-105" alt={item.movie_title} />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:flex items-end p-3">
                                <div className="flex gap-1.5 w-full">
                                  <button onClick={(e) => { e.stopPropagation(); toggleStatus(item); }} className="flex-1 p-2 bg-white/15 backdrop-blur-md rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 hover:bg-white/25 transition">
                                    {item.status === "para_ver" ? <><Eye size={12} /> Assistido</> : <><EyeOff size={12} /> Não visto</>}
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); removeFromCinemateca(item); }} className="p-2 bg-red-500/20 backdrop-blur-md rounded-lg hover:bg-red-500/40 transition"><Trash2 size={12} className="text-red-300" /></button>
                                </div>
                              </div>
                              {item.status === "ja_visto" && <div className="absolute top-2 right-2 bg-emerald-500/90 backdrop-blur-sm p-1 rounded-full"><CheckCircle2 size={12} /></div>}
                            </div>
                            <div className="p-3 bg-zinc-950/60">
                              <p className="text-xs font-bold truncate mb-1.5">{item.movie_title}</p>
                              <StarRating value={item.rating ?? 0} onChange={(v) => updateRating(item, v)} size={12} />
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden sm:hidden">
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                                      <button onClick={() => toggleStatus(item)} className="flex-1 p-2.5 bg-white/10 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition">
                                        {item.status === "para_ver" ? <><Eye size={13} /> Assistido</> : <><EyeOff size={13} /> Não visto</>}
                                      </button>
                                      <button onClick={() => removeFromCinemateca(item)} className="p-2.5 bg-red-500/15 rounded-xl active:scale-95 transition" aria-label="Remover"><Trash2 size={13} className="text-red-400" /></button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {trailerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl" onClick={() => setTrailerOpen(false)}>
            <button className="absolute top-6 right-6 text-white/40 hover:text-white transition p-2" onClick={() => setTrailerOpen(false)} aria-label="Fechar"><X size={28} /></button>
            <div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {trailerKey ? <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen title="Trailer" />
                : <div className="w-full h-full flex items-center justify-center bg-zinc-900"><Loader2 className="animate-spin text-zinc-500 mr-3" size={20} /><span className="text-zinc-500">Carregando trailer...</span></div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center">
              <div className="relative mx-auto mb-5 w-12 h-12"><Loader2 className="animate-spin text-white absolute inset-0" size={48} /></div>
              <AnimatePresence mode="wait">
                <motion.p key={loadingMsg} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-sm tracking-widest uppercase font-medium text-zinc-300">{LOADING_MESSAGES[loadingMsg]}</motion.p>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}