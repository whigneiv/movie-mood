"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookmarkPlus, Brain, CheckCircle2, ChevronLeft, Clapperboard,
  Compass, Eye, EyeOff, Flame, Ghost, Heart, HeartHandshake, Laugh,
  Library, Loader2, LogOut, Play, Popcorn, RefreshCw, Rocket, Share2,
  Sparkles, Star, Trash2, Tv, UserRound, Users, X, Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getMoviesAction, getTrailerAction } from "@/app/actions/movies";

/* ═══════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════ */

type Tab = "descobrir" | "cinemateca";
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type MoodName = "Adrenalina" | "Risadas" | "Reflexão" | "Arrepio";
type Ritmo = "frenetico" | "de_boa" | "curto_direto" | "filme_pipoca";
type Vibe = "mundo_real" | "fora_da_realidade" | "misterio_criminal" | "fritar_cerebro";
type Companhia = "sozinho" | "casal_date" | "galera" | "familia";
type Epoca = "classicos" | "anos_2000" | "passados_recentes" | "novinhos";
type Streaming = "netflix" | "prime" | "disney" | "max" | "apple" | "globoplay";
type CinematecaFilter = "todos" | "para_ver" | "ja_visto";

type Provider = { provider_id: number; provider_name: string; logo_path: string };

type Movie = {
  id: number; title: string; overview: string;
  poster_path: string | null; backdrop_path: string | null;
  release_date: string; vote_average: number; runtime?: number;
  providers?: Provider[];
};

type CinematecaItem = {
  id?: string; user_phone: string; user_name: string;
  movie_id: number; movie_title: string; poster_path: string | null;
  status: "para_ver" | "ja_visto"; rating: number | null;
};

type QuizState = {
  mood: Mood | null; ritmo: Ritmo | null;
  vibe: Vibe | null; companhia: Companhia | null; epoca: Epoca | null;
  streamings: Streaming[];
};

type Mood = { nome: MoodName; categoria: string; sub: string; tmdbGenreId: number; Icone: React.ElementType };
type MoodTheme = { bg: string; glow: string; border: string };
type ToastMessage = { id: string; text: string; type: "success" | "error" | "info" };
type ActionMovie = Movie & { genre_ids?: number[] };

/* ═══════════════════════════════════════════
   CONSTANTES & CONFIGURAÇÃO
   ═══════════════════════════════════════════ */

const MAX_BLACKLIST = 200;

const MOODS: Mood[] = [
  { nome: "Adrenalina", categoria: "Ação / Aventura", sub: "Explosões, perseguições, coração acelerado", tmdbGenreId: 28, Icone: Flame },
  { nome: "Risadas", categoria: "Comédia", sub: "Pra rir até doer a barriga", tmdbGenreId: 35, Icone: Laugh },
  { nome: "Reflexão", categoria: "Drama / Sci-Fi", sub: "Histórias que ficam na cabeça", tmdbGenreId: 18, Icone: Brain },
  { nome: "Arrepio", categoria: "Terror / Suspense", sub: "Pra assistir com a luz apagada", tmdbGenreId: 27, Icone: Ghost },
];

const MOOD_THEME: Record<MoodName, MoodTheme> = {
  Adrenalina: { bg: "radial-gradient(circle at 20% 20%, rgba(239,68,68,0.4), transparent 40%), #100707", glow: "rgba(239,68,68,0.5)", border: "rgba(239,68,68,0.6)" },
  Risadas: { bg: "radial-gradient(circle at 18% 18%, rgba(250,204,21,0.3), transparent 40%), #130f07", glow: "rgba(250,204,21,0.4)", border: "rgba(250,204,21,0.5)" },
  Reflexão: { bg: "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.3), transparent 40%), #070a14", glow: "rgba(99,102,241,0.4)", border: "rgba(125,211,252,0.5)" },
  Arrepio: { bg: "radial-gradient(circle at 18% 16%, rgba(168,85,247,0.3), transparent 40%), #06040d", glow: "rgba(168,85,247,0.5)", border: "rgba(196,181,253,0.5)" },
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
  1: { title: "Tá a fim de quê?", sub: "O humor certo faz o filme certo" },
  2: { title: "Que tipo de história?", sub: "Cada universo conta diferente" },
  3: { title: "Qual a pegada?", sub: "Rápido, devagar ou no meio?" },
  4: { title: "Quem tá junto?", sub: "Isso muda tudo na escolha" },
  5: { title: "De que época?", sub: "Clássico ou novinho em folha?" },
  6: { title: "Onde vai assistir?", sub: "Marca seus streamings ou pula direto" },
};

type QuizOption = { id: string; label: string; Icon: React.ElementType; sub?: string };

const QUIZ_STEPS: Record<number, QuizOption[]> = {
  2: [
    { id: "mundo_real", label: "Mundo real", Icon: Compass, sub: "Baseado em fatos ou realista" },
    { id: "fora_da_realidade", label: "Fora da realidade", Icon: Sparkles, sub: "Fantasia, ficção, mundos novos" },
    { id: "misterio_criminal", label: "Mistério criminal", Icon: Ghost, sub: "Quem fez? Suspense total" },
    { id: "fritar_cerebro", label: "Fritar o cérebro", Icon: Brain, sub: "Plot twist atrás de plot twist" },
  ],
  3: [
    { id: "frenetico", label: "Frenético", Icon: Rocket, sub: "Sem tempo pra respirar" },
    { id: "de_boa", label: "De boa", Icon: Popcorn, sub: "Saboreia cada cena" },
    { id: "curto_direto", label: "Curto e direto", Icon: Zap, sub: "Menos de 1h40, sem enrolação" },
    { id: "filme_pipoca", label: "Filme pipoca", Icon: RefreshCw, sub: "Diversão leve e garantida" },
  ],
  4: [
    { id: "sozinho", label: "Sozinho(a)", Icon: UserRound, sub: "Minha sessão, minhas regras" },
    { id: "casal_date", label: "Casal / Date", Icon: Heart, sub: "Romance no ar" },
    { id: "galera", label: "Com a galera", Icon: Users, sub: "Quanto mais melhor" },
    { id: "familia", label: "Família", Icon: HeartHandshake, sub: "Pra todas as idades" },
  ],
  5: [
    { id: "classicos", label: "Clássicos", Icon: Star, sub: "Antes dos anos 2000" },
    { id: "anos_2000", label: "Anos 2000", Icon: Tv, sub: "A década que marcou" },
    { id: "passados_recentes", label: "Recentes", Icon: Clapperboard, sub: "De 2010 até 2022" },
    { id: "novinhos", label: "Novinhos", Icon: Sparkles, sub: "2023 pra cá, fresquinho" },
  ],
};

const QUIZ_FIELD_MAP: Record<number, keyof QuizState> = { 2: "vibe", 3: "ritmo", 4: "companhia", 5: "epoca" };

const SELECTION_LABELS: Record<string, string> = {
  mundo_real: "Mundo real", fora_da_realidade: "Fora da realidade", misterio_criminal: "Mistério criminal",
  fritar_cerebro: "Fritar o cérebro", frenetico: "Frenético", de_boa: "De boa", curto_direto: "Curto e direto",
  filme_pipoca: "Filme pipoca", sozinho: "Sozinho(a)", casal_date: "Casal / Date", galera: "Com a galera",
  familia: "Família", classicos: "Clássicos", anos_2000: "Anos 2000", passados_recentes: "Recentes", novinhos: "Novinhos",
};

const LOADING_MESSAGES = [
  "Lendo seu gosto cinematográfico...",
  "Rodando os rolos de filme...",
  "Filtrando milhares de títulos...",
  "Preparando a pipoca...",
  "Quase! Só mais um segundo...",
];

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */

function safeGetItem(key: string): string | null { if (typeof window === "undefined") return null; try { return localStorage.getItem(key); } catch { return null; } }
function safeSetItem(key: string, value: string): void { if (typeof window === "undefined") return; try { localStorage.setItem(key, value); } catch {} }
function safeRemoveItem(key: string): void { if (typeof window === "undefined") return; try { localStorage.removeItem(key); } catch {} }
function formatPhone(raw: string): string { const digits = raw.replace(/\D/g, "").slice(0, 11); if (digits.length <= 2) return digits; if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`; return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`; }
function phoneDigits(formatted: string): string { return formatted.replace(/\D/g, ""); }
function formatRuntime(runtime?: number): string { if (!runtime || runtime <= 0) return ""; const h = Math.floor(runtime / 60); const m = runtime % 60; if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`; }
function getSelectionLabel(value: string): string { return SELECTION_LABELS[value] ?? value.replaceAll("_", " "); }
function isValidBRPhone(digits: string): boolean { if (digits.length !== 11) return false; const ddd = parseInt(digits.slice(0, 2), 10); if (ddd < 11 || ddd > 99) return false; return digits[2] === "9"; }
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] { const words = text.split(" "); const lines: string[] = []; let current = ""; for (const word of words) { const test = current ? `${current} ${word}` : word; if (ctx.measureText(test).width > maxWidth && current) { lines.push(current); current = word; } else { current = test; } } if (current) lines.push(current); return lines.slice(0, 3); }

/* ═══════════════════════════════════════════
   COMPONENTES AUXILIARES
   ═══════════════════════════════════════════ */

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (<div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-[200] flex flex-col gap-3 items-end pointer-events-none"><AnimatePresence>{toasts.map((t) => (<motion.div key={t.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl text-sm font-medium w-full sm:max-w-sm ${t.type === "success" ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-200" : t.type === "error" ? "bg-red-950/80 border-red-500/30 text-red-200" : "bg-zinc-900/80 border-white/10 text-zinc-200"}`}>{t.type === "success" && <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />}{t.type === "error" && <X size={18} className="shrink-0 text-red-400" />}{t.type === "info" && <Sparkles size={18} className="shrink-0 text-zinc-400" />}<span className="flex-1">{t.text}</span><button onClick={() => onDismiss(t.id)} className="shrink-0 text-white/40 hover:text-white transition" aria-label="Fechar"><X size={14} /></button></motion.div>))}</AnimatePresence></div>);
}

function QuizCard({ Icon, label, sub, onClick, delay = 0, accentColor }: { Icon: React.ElementType; label: string; sub?: string; onClick: () => void; delay?: number; accentColor?: string }) {
  return (<motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.06, duration: 0.35, ease: "easeOut" }} whileTap={{ scale: 0.94 }} whileHover={{ y: -2 }} onClick={onClick} className="relative p-5 sm:p-6 bg-white/[0.04] border border-white/[0.06] rounded-3xl text-left hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300 group active:scale-[0.97] overflow-hidden"><div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: accentColor ? `radial-gradient(circle at 30% 30%, ${accentColor.replace("0.5)", "0.08)").replace("0.4)", "0.06)")}, transparent 70%)` : undefined }} /><div className="relative"><Icon className="mb-3 transition-all duration-300 group-hover:scale-110" style={{ color: accentColor || undefined }} size={24} /><p className="font-bold text-[15px] leading-tight">{label}</p>{sub && <p className="text-[11px] text-zinc-500 mt-1 leading-snug group-hover:text-zinc-400 transition-colors">{sub}</p>}</div></motion.button>);
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (<div className="flex items-center gap-1.5">{Array.from({ length: total }, (_, i) => i + 1).map((n) => (<motion.div key={n} layout className={`rounded-full transition-colors duration-500 ${n < current ? "w-2 h-2 bg-white/40" : n === current ? "w-7 h-2 bg-white/90 rounded-full" : "w-2 h-2 bg-white/[0.08]"}`} />))}</div>);
}

function StarRating({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (<div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((s) => (<button key={s} onClick={() => onChange?.(s === value ? 0 : s)} disabled={!onChange} className={`transition-all duration-200 ${onChange ? "cursor-pointer hover:text-amber-300 hover:scale-110" : "cursor-default"} ${s <= value ? "text-amber-400" : "text-zinc-700"}`} aria-label={`${s} estrela${s > 1 ? "s" : ""}`}><Star size={size} fill={s <= value ? "currentColor" : "none"} /></button>))}</div>);
}

function QuizSummaryChips({ quiz }: { quiz: QuizState }) {
  const chips: string[] = []; if (quiz.mood) chips.push(quiz.mood.nome); if (quiz.vibe) chips.push(getSelectionLabel(quiz.vibe)); if (quiz.ritmo) chips.push(getSelectionLabel(quiz.ritmo)); if (quiz.companhia) chips.push(getSelectionLabel(quiz.companhia)); if (quiz.epoca) chips.push(getSelectionLabel(quiz.epoca)); if (chips.length === 0) return null;
  return (<div className="flex flex-wrap gap-1.5 mb-4">{chips.map((c, i) => (<motion.span key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.06] font-medium text-white/50">{c}</motion.span>))}</div>);
}

function ProviderBadge({ provider }: { provider: Provider }) {
  return (<span className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/55 backdrop-blur-md border border-white/10 rounded-xl text-xs font-bold text-zinc-200"><Image src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`} width={20} height={20} alt={provider.provider_name} className="rounded-md" />{provider.provider_name}</span>);
}

function MovieDetailModal({ item, onClose, onToggleStatus, onRemove, onUpdateRating, onOpenTrailer, isSaving }: { item: CinematecaItem; onClose: () => void; onToggleStatus: (item: CinematecaItem) => void; onRemove: (item: CinematecaItem) => void; onUpdateRating: (item: CinematecaItem, rating: number) => void; onOpenTrailer: (movieId: number) => void; isSaving: boolean }) {
  return (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl" onClick={onClose}><button className="absolute top-6 right-6 text-white/40 hover:text-white transition p-2 z-10" onClick={onClose} aria-label="Fechar"><X size={28} /></button><motion.div initial={{ scale: 0.92, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 30 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-md bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="relative aspect-[2/3] w-full max-h-[50vh] overflow-hidden">{item.poster_path ? (<Image src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} fill sizes="(max-width: 640px) 100vw, 400px" className="object-cover" alt={item.movie_title} />) : (<div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center text-zinc-400"><div className="text-center px-4"><Clapperboard size={30} className="mx-auto mb-2 text-zinc-500" /><p className="text-sm font-semibold">Poster indisponível</p></div></div>)}<div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />{item.status === "ja_visto" && <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold"><CheckCircle2 size={14} /> Assistido</div>}{item.status === "para_ver" && <div className="absolute top-4 right-4 bg-amber-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-black"><Eye size={14} /> Na fila</div>}</div><div className="p-6 -mt-10 relative"><h3 className="text-xl font-bold mb-3 leading-tight">{item.movie_title}</h3><div className="mb-5"><p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-2">Sua nota</p><StarRating value={item.rating ?? 0} onChange={(v) => onUpdateRating(item, v)} size={20} /></div><div className="space-y-2.5"><button onClick={() => onOpenTrailer(item.movie_id)} className="w-full py-3.5 bg-white text-black border border-white rounded-2xl flex items-center justify-center gap-2.5 hover:bg-zinc-200 transition font-semibold text-sm"><Play size={18} /> Ver Trailer</button><div className="flex gap-2.5"><button disabled={isSaving} onClick={() => onToggleStatus(item)} className="flex-1 py-3 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold hover:bg-white/20 transition disabled:opacity-60 disabled:cursor-not-allowed">{item.status === "para_ver" ? <><Eye size={16} /> Já vi</> : <><EyeOff size={16} /> Não vi</>}</button><button disabled={isSaving} onClick={() => onRemove(item)} className="py-3 px-4 bg-red-500/15 border border-red-500/20 rounded-xl hover:bg-red-500/30 transition disabled:opacity-60 disabled:cursor-not-allowed" aria-label="Remover"><Trash2 size={16} className="text-red-400" /></button></div></div></div></motion.div></motion.div>);
}

/* ═══════════════════════════════════════════
   SERVER ACTION MAPPING
   ═══════════════════════════════════════════ */

function mapQuizToActionFilters(quiz: QuizState) {
  const providers = quiz.streamings.map((s) => STREAMINGS.find((p) => p.id === s)?.providerId).filter(Boolean).join("|");
  const yearMap: Partial<Record<Epoca, number>> = { classicos: 1985, anos_2000: 2005, passados_recentes: 2018, novinhos: new Date().getFullYear() };
  return { genreId: quiz.mood?.tmdbGenreId, providers: providers || undefined, year: quiz.epoca ? yearMap[quiz.epoca] : undefined, ritmo: quiz.ritmo ?? undefined, vibe: quiz.vibe ?? undefined, companhia: quiz.companhia ?? undefined, epoca: quiz.epoca ?? undefined };
}

/* ═══════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════ */

export default function Home() {
  const [mounted, setMounted] = useState(false); const [hasOnboarded, setHasOnboarded] = useState(false); const [userName, setUserName] = useState(""); const [userPhone, setUserPhone] = useState(""); const [activeTab, setActiveTab] = useState<Tab>("descobrir"); const [step, setStep] = useState<Step>(1); const [quiz, setQuiz] = useState<QuizState>({ mood: null, ritmo: null, vibe: null, companhia: null, epoca: null, streamings: [] }); const [movie, setMovie] = useState<Movie | null>(null); const [cachedMovies, setCachedMovies] = useState<Movie[]>([]); const [isSaving, setIsSaving] = useState(false); const [isLoading, setIsLoading] = useState(false); const [loadingMsg, setLoadingMsg] = useState(0); const [cinemateca, setCinemateca] = useState<CinematecaItem[]>([]); const [cinematecaLoading, setCinematecaLoading] = useState(false); const [cinematecaFilter, setCinematecaFilter] = useState<CinematecaFilter>("todos"); const [expandedCard, setExpandedCard] = useState<string | null>(null); const [trailerOpen, setTrailerOpen] = useState(false); const [trailerKey, setTrailerKey] = useState<string | null>(null); const [toasts, setToasts] = useState<ToastMessage[]>([]); const [shareLoading, setShareLoading] = useState(false); const [isOnboardingLoading, setIsOnboardingLoading] = useState(false); const [posterLoadError, setPosterLoadError] = useState(false); const [cinematecaPosterErrors, setCinematecaPosterErrors] = useState<Record<number, boolean>>({}); const [detailModalItem, setDetailModalItem] = useState<CinematecaItem | null>(null);
  const quizRef = useRef(quiz); quizRef.current = quiz; const cachedMoviesRef = useRef<Movie[]>(cachedMovies); cachedMoviesRef.current = cachedMovies; const movieRef = useRef<Movie | null>(movie); movieRef.current = movie; const loadingInterval = useRef<NodeJS.Timeout | null>(null);
  const toast = useCallback((text: string, type: ToastMessage["type"] = "info") => { const id = crypto.randomUUID(); setToasts((prev) => [...prev, { id, text, type }]); setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500); }, []);
  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const loadCinemateca = useCallback(async (phone: string) => { setCinematecaLoading(true); try { const { data, error } = await supabase.from("cinemateca").select("*").eq("user_phone", phone).order("created_at", { ascending: false }); if (error) throw error; if (data) setCinemateca(data); } catch (err) { console.error("Erro ao carregar cinemateca:", err); } finally { setCinematecaLoading(false); } }, []);
  useEffect(() => { setMounted(true); const savedName = safeGetItem("userName"); const savedPhone = safeGetItem("userPhone"); if (savedName && savedPhone) { setUserName(savedName); setUserPhone(savedPhone); setHasOnboarded(true); loadCinemateca(savedPhone); } }, [loadCinemateca]);
  useEffect(() => { if (isLoading) { setLoadingMsg(0); loadingInterval.current = setInterval(() => setLoadingMsg((p) => (p + 1) % LOADING_MESSAGES.length), 1800); } else { if (loadingInterval.current) clearInterval(loadingInterval.current); } return () => { if (loadingInterval.current) clearInterval(loadingInterval.current); }; }, [isLoading]);
  useEffect(() => { const shouldWarn = hasOnboarded && step > 1 && step < 8; if (!shouldWarn) return; const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload); }, [hasOnboarded, step]);
  useEffect(() => { setPosterLoadError(false); }, [movie?.id]);

  const handleOnboarding = useCallback(async () => { if (isOnboardingLoading) return; const cleanPhone = phoneDigits(userPhone); if (!userName.trim()) { toast("Falta seu nome!", "error"); return; } if (!isValidBRPhone(cleanPhone)) { toast("Celular inválido. Ex: (11) 91234-5678", "error"); return; } setIsOnboardingLoading(true); try { const normalizedName = userName.trim(); safeSetItem("userName", normalizedName); safeSetItem("userPhone", cleanPhone); const { data: existing } = await supabase.from("visitors").select("phone").eq("phone", cleanPhone).limit(1); if (!existing || existing.length === 0) { await supabase.from("visitors").insert({ name: normalizedName, phone: cleanPhone }); } setHasOnboarded(true); loadCinemateca(cleanPhone); } catch { toast("Algo deu errado, tenta de novo.", "error"); } finally { setIsOnboardingLoading(false); } }, [isOnboardingLoading, userName, userPhone, loadCinemateca, toast]);
  const resetQuiz = useCallback(() => { setQuiz({ mood: null, ritmo: null, vibe: null, companhia: null, epoca: null, streamings: [] }); setMovie(null); setStep(1); }, []);
  const handleLogout = useCallback(() => { if (!confirm("Sair do Movie Mood?")) return; safeRemoveItem("userName"); safeRemoveItem("userPhone"); safeRemoveItem("movieMood_blacklist"); setUserName(""); setUserPhone(""); setHasOnboarded(false); setCinemateca([]); resetQuiz(); }, [resetQuiz]);
  const getServerBlacklist = useCallback(async (): Promise<number[]> => { const phone = phoneDigits(userPhone) || safeGetItem("userPhone") || ""; if (!phone) return []; try { const { data } = await supabase.from("interactions").select("movie_id").eq("user_phone", phone).in("action", ["skipped", "watched"]); if (data) return data.map((row: { movie_id: number }) => row.movie_id); } catch {} return []; }, [userPhone]);
  const fetchMoviesFromServer = useCallback(async (blacklist: number[]) => { const filters = mapQuizToActionFilters(quizRef.current); const phone = phoneDigits(userPhone) || safeGetItem("userPhone") || ""; const response = (await getMoviesAction({ filters, blacklist, userPhone: phone || undefined })) as ActionMovie[]; return response.filter((m) => Boolean(m.poster_path)).map((m) => ({ id: m.id, title: m.title, overview: m.overview, poster_path: m.poster_path, backdrop_path: m.backdrop_path, release_date: m.release_date, vote_average: m.vote_average, runtime: m.runtime, providers: (m as Movie).providers })) as Movie[]; }, [userPhone]);

  const discoverMovie = useCallback(async (isSkipping = false) => { try { const raw = safeGetItem("movieMood_blacklist") || "[]"; let blacklist: number[] = JSON.parse(raw); const serverBlacklist = await getServerBlacklist(); blacklist = [...new Set([...blacklist, ...serverBlacklist])]; if (isSkipping && movieRef.current) { blacklist.push(movieRef.current.id); if (blacklist.length > MAX_BLACKLIST) blacklist = blacklist.slice(-MAX_BLACKLIST); safeSetItem("movieMood_blacklist", JSON.stringify(blacklist.slice(-MAX_BLACKLIST))); const phone = phoneDigits(userPhone) || safeGetItem("userPhone") || ""; if (phone) { void supabase.from("interactions").insert({ user_phone: phone, movie_id: movieRef.current.id, action: "skipped" }); } } if (isSkipping && cachedMoviesRef.current.length > 1) { const [, nextMovie, ...rest] = cachedMoviesRef.current; if (nextMovie) { setMovie(nextMovie); setCachedMovies([nextMovie, ...rest]); setStep(8); if (rest.length < 2) { void (async () => { try { const fresh = await fetchMoviesFromServer(blacklist); if (fresh.length === 0) return; setCachedMovies((prev) => { const merged = [...prev, ...fresh].filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index); return merged.slice(0, 10); }); } catch {} })(); } return; } } setIsLoading(true); const movies = await fetchMoviesFromServer(blacklist); if (movies.length > 0) { setMovie(movies[0]); setCachedMovies(movies); setStep(8); } else { toast("Nenhum filme encontrado. Tenta mudar alguma escolha!", "info"); } } catch { toast("Ops, algo deu errado. Tenta de novo!", "error"); } finally { setIsLoading(false); } }, [fetchMoviesFromServer, getServerBlacklist, toast, userPhone]);

  const trackInteraction = useCallback(async (movieId: number, action: "viewed" | "skipped" | "saved" | "watched") => { const phone = phoneDigits(userPhone) || safeGetItem("userPhone") || ""; if (!phone) return; try { await supabase.from("interactions").insert({ user_phone: phone, movie_id: movieId, action }); } catch {} }, [userPhone]);
  useEffect(() => { if (!movie) return; void trackInteraction(movie.id, "viewed"); }, [movie, trackInteraction]);
  const addToCinemateca = useCallback(async (m: Movie) => {
    if (isSaving) return;
    if (cinemateca.some((item) => item.movie_id === m.id)) { toast("Esse já tá na sua lista!", "info"); return; }
    const phone = phoneDigits(userPhone) || safeGetItem("userPhone") || "";
    const name = userName || safeGetItem("userName") || "";
    const item: CinematecaItem = { user_phone: phone, user_name: name, movie_id: m.id, movie_title: m.title, poster_path: m.poster_path, status: "para_ver", rating: null };
    setIsSaving(true);
    try {
      const { data, error } = await supabase.from("cinemateca").upsert(item).select().single();
      if (error) throw error;
      if (!data) throw new Error("No cinemateca row returned");
      setCinemateca((prev) => [data, ...prev.filter((x) => !(x.user_phone === data.user_phone && x.movie_id === data.movie_id))]);
      toast("Salvo na Cinemateca!", "success");
      void trackInteraction(m.id, "saved");
    } catch { toast("Ops, tenta de novo!", "error"); }
    finally { setIsSaving(false); }
  }, [cinemateca, isSaving, trackInteraction, userPhone, userName, toast]);

  const markAsWatched = useCallback(async (m: Movie) => {
    if (isSaving) return;
    const phone = phoneDigits(userPhone) || safeGetItem("userPhone") || "";
    const name = userName || safeGetItem("userName") || "";
    setIsSaving(true);
    const item: CinematecaItem = { user_phone: phone, user_name: name, movie_id: m.id, movie_title: m.title, poster_path: m.poster_path, status: "ja_visto", rating: null };
    const raw = safeGetItem("movieMood_blacklist") || "[]";
    const parsed = JSON.parse(raw) as number[];
    const updated = [...parsed, m.id].slice(-MAX_BLACKLIST);
    safeSetItem("movieMood_blacklist", JSON.stringify(updated));
    const discoverPromise = discoverMovie(true);
    void trackInteraction(m.id, "watched");
    try {
      const { data, error } = await supabase.from("cinemateca").upsert(item).select().single();
      if (error) throw error;
      if (!data) throw new Error("No cinemateca row returned");
      setCinemateca((prev) => [data, ...prev.filter((x) => !(x.user_phone === data.user_phone && x.movie_id === data.movie_id))]);
    } catch { toast("Ops, tenta de novo!", "error"); }
    finally { setIsSaving(false); }
    await discoverPromise;
  }, [discoverMovie, isSaving, toast, trackInteraction, userName, userPhone]);

  const toggleStatus = useCallback(async (item: CinematecaItem) => {
    if (isSaving) return;
    const newStatus = item.status === "para_ver" ? "ja_visto" : "para_ver";
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("cinemateca")
        .update({ status: newStatus })
        .eq("user_phone", item.user_phone)
        .eq("movie_id", item.movie_id)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("No cinemateca row returned");
      setCinemateca((prev) => prev.map((c) => (c.user_phone === data.user_phone && c.movie_id === data.movie_id ? data : c)));
      setDetailModalItem((prev) => (prev && prev.user_phone === data.user_phone && prev.movie_id === data.movie_id ? data : prev));
      toast(newStatus === "ja_visto" ? "Pronto, marcado!" : "Voltou pra fila!", "success");
    } catch { toast("Ops, tenta de novo!", "error"); }
    finally { setIsSaving(false); }
  }, [isSaving, toast]);

  const updateRating = useCallback(async (item: CinematecaItem, rating: number) => {
    try {
      const { data, error } = await supabase
        .from("cinemateca")
        .update({ rating })
        .eq("user_phone", item.user_phone)
        .eq("movie_id", item.movie_id)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("No cinemateca row returned");
      setCinemateca((prev) => prev.map((c) => (c.user_phone === data.user_phone && c.movie_id === data.movie_id ? data : c)));
      setDetailModalItem((prev) => (prev && prev.user_phone === data.user_phone && prev.movie_id === data.movie_id ? data : prev));
    } catch {}
  }, []);

  const removeFromCinemateca = useCallback(async (item: CinematecaItem) => {
    if (isSaving) return;
    if (!confirm("Remover este filme da sua Cinemateca?")) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("cinemateca")
        .delete()
        .eq("user_phone", item.user_phone)
        .eq("movie_id", item.movie_id);
      if (error) throw error;
      setCinemateca((prev) => prev.filter((c) => !(c.user_phone === item.user_phone && c.movie_id === item.movie_id)));
      setExpandedCard(null);
      setDetailModalItem((prev) => (prev && prev.user_phone === item.user_phone && prev.movie_id === item.movie_id ? null : prev));
      toast("Filme removido.", "info");
    } catch { toast("Ops, tenta de novo!", "error"); }
    finally { setIsSaving(false); }
  }, [isSaving, toast]);

  const shareMovie = useCallback(async (m: Movie) => {
    setShareLoading(true);
    try {
      const W = 1080;
      const H = 1920;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      const loadImage = async (url: string): Promise<HTMLImageElement | null> => {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new window.Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = blobUrl;
          });
          URL.revokeObjectURL(blobUrl);
          return img;
        } catch {
          return null;
        }
      };

      const drawCoverImage = (
        image: HTMLImageElement,
        x: number,
        y: number,
        width: number,
        height: number
      ) => {
        const scale = Math.max(width / image.width, height / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        const dx = x + (width - drawW) / 2;
        const dy = y + (height - drawH) / 2;
        ctx.drawImage(image, dx, dy, drawW, drawH);
      };

      const clampLines = (
        text: string,
        maxWidth: number,
        maxLines: number,
        withEllipsis = true
      ): string[] => {
        const words = text.split(" ");
        const lines: string[] = [];
        let current = "";
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (ctx.measureText(candidate).width > maxWidth && current) {
            lines.push(current);
            current = word;
            if (lines.length === maxLines) break;
          } else {
            current = candidate;
          }
        }
        if (lines.length < maxLines && current) lines.push(current);
        if (withEllipsis && lines.length > 0 && words.join(" ") !== lines.join(" ")) {
          let last = lines[lines.length - 1];
          while (ctx.measureText(`${last}...`).width > maxWidth && last.length > 0) {
            last = last.slice(0, -1);
          }
          lines[lines.length - 1] = `${last}...`;
        }
        return lines.slice(0, maxLines);
      };

      // Base
      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, W, H);

      // Dynamic blurred backdrop (40px, 25% opacity)
      if (m.backdrop_path) {
        const backdrop = await loadImage(`https://image.tmdb.org/t/p/w1280${m.backdrop_path}`);
        if (backdrop) {
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.filter = "blur(40px)";
          drawCoverImage(backdrop, -80, -80, W + 160, H + 160);
          ctx.restore();
        }
      }
      const overlay = ctx.createLinearGradient(0, 0, 0, H);
      overlay.addColorStop(0, "rgba(0,0,0,0.25)");
      overlay.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, W, H);

      // Header branding
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 40px Geist, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText("MOVIE MOOD", W / 2, 170);

      // Poster dominant
      const poster = m.poster_path
        ? await loadImage(`https://image.tmdb.org/t/p/w780${m.poster_path}`)
        : null;
      const posterW = 760;
      const posterH = 1080;
      const posterX = (W - posterW) / 2;
      const posterY = 250;

      if (poster) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 20;
        ctx.beginPath();
        ctx.roundRect(posterX, posterY, posterW, posterH, 30);
        ctx.clip();
        drawCoverImage(poster, posterX, posterY, posterW, posterH);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(20,20,24,0.9)";
        ctx.beginPath();
        ctx.roundRect(posterX, posterY, posterW, posterH, 30);
        ctx.fill();
      }

      const contentY = posterY + posterH + 90;
      const contentW = W - 140;
      const synopsisMaxW = W - 220;
      const contentX = W / 2;

      // Title (max 2 lines + ellipsis)
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 60px Geist, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      const titleLines = clampLines(m.title, contentW, 2, true);
      titleLines.forEach((line, idx) => ctx.fillText(line, contentX, contentY + idx * 68));

      // Rating
      const ratingY = contentY + titleLines.length * 68 + 56;
      ctx.font = "600 36px Geist, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillStyle = "#facc15";
      ctx.fillText("★", contentX - 45, ratingY);
      ctx.fillStyle = "#e4e4e7";
      ctx.fillText(m.vote_average.toFixed(1), contentX + 10, ratingY);

      // Synopsis (3-4 lines)
      const synopsisY = ratingY + 60;
      ctx.fillStyle = "#e4e4e7";
      ctx.font = "400 32px Geist, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      const synopsisText = m.overview || "Uma indicação perfeita para sua próxima sessão.";
      const synopsisLines = clampLines(synopsisText, synopsisMaxW, 4, true);
      synopsisLines.forEach((line, idx) => ctx.fillText(line, contentX, synopsisY + idx * 42));

      // Footer CTA
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 36px Geist, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText("Descubra sua próxima sessão em moviemood.com", W / 2, H - 170);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        toast("Erro ao gerar imagem.", "error");
        return;
      }
      const file = new File([blob], `movie-mood-${m.id}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: m.title,
          text: `${m.title} — recomendado pelo Movie Mood!`,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast("Imagem salva! Posta nos stories.", "success");
      }
    } catch (err) {
      console.error("Share error:", err);
      toast("Erro ao compartilhar.", "error");
    } finally {
      setShareLoading(false);
    }
  }, [toast]);

  const openTrailer = useCallback(async (movieId: number) => { setTrailerOpen(true); setTrailerKey(null); const key = await getTrailerAction(movieId); setTrailerKey(key); }, []);
  const goBack = useCallback(() => { if (step === 1) return; if (step === 8) { setMovie(null); setStep(6); return; } setStep((s) => (s - 1) as Step); }, [step]);
  const handleQuizSelect = useCallback((stepNum: number, value: string) => { const field = QUIZ_FIELD_MAP[stepNum]; if (!field) return; setQuiz((prev) => ({ ...prev, [field]: value })); setStep((stepNum + 1) as Step); }, []);
  const handleMoodSelect = useCallback((m: Mood) => { setQuiz((prev) => ({ ...prev, mood: m })); setStep(2); }, []);
  const toggleStreaming = useCallback((sid: Streaming) => { setQuiz((prev) => ({ ...prev, streamings: prev.streamings.includes(sid) ? prev.streamings.filter((x) => x !== sid) : [...prev.streamings, sid] })); }, []);

  const theme = quiz.mood ? MOOD_THEME[quiz.mood.nome] : MOOD_THEME["Reflexão"];
  const accentColor = quiz.mood ? theme.glow : undefined;
  const firstName = userName.split(" ")[0];
  const filteredCinemateca = useMemo(() => { if (cinematecaFilter === "todos") return cinemateca; return cinemateca.filter((c) => c.status === cinematecaFilter); }, [cinemateca, cinematecaFilter]);
  const stats = useMemo(() => ({ total: cinemateca.length, paraVer: cinemateca.filter((c) => c.status === "para_ver").length, jaVisto: cinemateca.filter((c) => c.status === "ja_visto").length }), [cinemateca]);
  const visibleProviders = useMemo(() => { if (!movie?.providers || movie.providers.length === 0) return []; const selectedIds = quiz.streamings.map((s) => STREAMINGS.find((p) => p.id === s)?.providerId).filter((id): id is string => Boolean(id)); if (selectedIds.length === 0) return movie.providers; const filtered = movie.providers.filter((p) => selectedIds.includes(String(p.provider_id))); return filtered.length > 0 ? filtered : movie.providers; }, [movie?.providers, quiz.streamings]);

  if (!mounted) return <main className="min-h-screen bg-[#070913]" />;

  return (
    <main className="min-h-screen text-white transition-all duration-700 relative" style={{ background: theme.bg }}>
      {step === 8 && movie?.backdrop_path && (<div className="fixed inset-0 -z-10"><div className="absolute inset-0 bg-center bg-cover opacity-[0.15] blur-[50px] scale-110" style={{ backgroundImage: `url(https://image.tmdb.org/t/p/w780${movie.backdrop_path})` }} /><div className="absolute inset-0 bg-black/80" style={{ WebkitMaskImage: "radial-gradient(circle at center, transparent 18%, black 72%)", maskImage: "radial-gradient(circle at center, transparent 18%, black 72%)" }} /></div>)}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />

      <div className="relative z-10 p-4 sm:p-6">
        {!hasOnboarded ? (
          <div className="max-w-md mx-auto mt-16 sm:mt-24">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="p-8 sm:p-10 bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-[2.5rem] shadow-2xl">
              <div className="flex items-center gap-2 mb-1"><Clapperboard size={14} className="text-zinc-500" /><p className="text-zinc-500 uppercase text-[10px] tracking-[0.3em] font-semibold">Movie Mood</p></div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight leading-[1.1]">Seu filme perfeito te espera</h1>
              <p className="text-zinc-400 text-sm mb-8 leading-relaxed">Responde umas perguntinhas rápidas e a gente acha o filme ideal pra agora.</p>
              <div className="space-y-4">
                <div><label htmlFor="name" className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block">Como te chamo?</label><input id="name" className="w-full bg-white/[0.05] border border-white/[0.08] p-4 rounded-2xl outline-none focus:border-white/30 focus:bg-white/[0.07] transition-all placeholder:text-zinc-600" placeholder="Seu nome" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && document.getElementById("phone")?.focus()} /></div>
                <div><label htmlFor="phone" className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block">Seu celular</label><input id="phone" inputMode="numeric" className="w-full bg-white/[0.05] border border-white/[0.08] p-4 rounded-2xl outline-none focus:border-white/30 focus:bg-white/[0.07] transition-all placeholder:text-zinc-600" placeholder="(00) 00000-0000" value={userPhone} onChange={(e) => setUserPhone(formatPhone(e.target.value))} onKeyDown={(e) => e.key === "Enter" && handleOnboarding()} /><p className="text-[10px] text-zinc-600 mt-1.5 ml-1">Só pra salvar seus filmes. Nada de spam.</p></div>
                <motion.button whileTap={{ scale: 0.97 }} disabled={isOnboardingLoading} className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-100 transition-all active:scale-[0.98] mt-2 disabled:opacity-60 disabled:cursor-not-allowed text-base" onClick={handleOnboarding}>{isOnboardingLoading ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Entrando...</span> : "Partiu"}</motion.button>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <header className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 mb-10">
              <h2 className="text-xl sm:text-2xl font-semibold text-center sm:text-left">{activeTab === "descobrir" ? `E aí ${firstName}, o que vamos assistir?` : `Cinemateca de ${firstName}`}</h2>
              <div className="flex items-center gap-2">
                <nav className="flex bg-black/30 backdrop-blur-md p-1 rounded-full border border-white/[0.06]">{(["descobrir", "cinemateca"] as Tab[]).map((tab) => (<button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === tab ? "bg-white/[0.12] shadow-lg text-white" : "text-zinc-500 hover:text-zinc-300"}`}>{tab === "descobrir" ? <span className="flex items-center gap-1.5"><Compass size={14} /> Descobrir</span> : <span className="flex items-center gap-1.5"><Library size={14} /> Cinemateca {stats.total > 0 && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full ml-0.5">{stats.total}</span>}</span>}</button>))}</nav>
                <button onClick={handleLogout} className="p-2 rounded-full text-zinc-600 hover:text-white hover:bg-white/5 transition" title="Sair" aria-label="Sair"><LogOut size={16} /></button>
              </div>
            </header>

            {activeTab === "descobrir" && (
              <div className="max-w-4xl mx-auto">
                {step < 8 ? (
                  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 md:p-12 rounded-[2.5rem] border border-white/[0.06] shadow-2xl">
                    <div className="flex items-center gap-3 mb-5">{step > 1 ? <button onClick={goBack} className="p-2.5 -ml-2 rounded-2xl hover:bg-white/5 transition text-zinc-500 hover:text-white" aria-label="Voltar"><ChevronLeft size={22} /></button> : <div className="w-[42px]" />}<div className="flex-1 flex justify-center"><ProgressDots current={step} total={6} /></div><div className="w-[42px]" /></div>
                    <QuizSummaryChips quiz={quiz} />
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{STEP_CONFIG[step]?.title || ""}</h3>
                    <p className="text-zinc-500 text-sm mt-1 mb-6">{STEP_CONFIG[step]?.sub || ""}</p>
                    <AnimatePresence mode="wait">
                      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                        {step === 1 && (<div className="grid grid-cols-2 gap-3 sm:gap-4">{MOODS.map((m, i) => <QuizCard key={m.nome} Icon={m.Icone} label={m.nome} sub={m.sub} onClick={() => handleMoodSelect(m)} delay={i} />)}</div>)}
                        {[2, 3, 4, 5].includes(step) && QUIZ_STEPS[step] && (<div className="grid grid-cols-2 gap-3 sm:gap-4">{QUIZ_STEPS[step].map((item, i) => <QuizCard key={item.id} Icon={item.Icon} label={item.label} sub={item.sub} onClick={() => handleQuizSelect(step, item.id)} delay={i} accentColor={accentColor} />)}</div>)}
                        {step === 6 && (
                          <div className="text-center py-4 sm:py-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-8">{STREAMINGS.map((s, i) => (<motion.button key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.95 }} transition={{ delay: i * 0.04 }} onClick={() => toggleStreaming(s.id)} className={`p-4 border rounded-2xl transition-all duration-300 font-medium text-sm active:scale-[0.97] ${quiz.streamings.includes(s.id) ? s.brandClass + " border-current shadow-lg" : "border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"}`}>{s.nome}</motion.button>))}</div>
                            <p className="text-zinc-500 text-xs mb-6">{quiz.streamings.length === 0 ? "Nenhum marcado? A gente busca em tudo!" : `${quiz.streamings.length} plataforma${quiz.streamings.length > 1 ? "s" : ""} selecionada${quiz.streamings.length > 1 ? "s" : ""}`}</p>
                            <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }} className="px-10 sm:px-14 py-4 sm:py-5 bg-white text-black font-bold rounded-2xl transition-all shadow-xl shadow-white/10 text-base" onClick={() => discoverMovie()}><span className="flex items-center gap-2.5"><Sparkles size={20} /> Achar meu filme</span></motion.button>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.section>
                ) : movie && (
                  <AnimatePresence mode="wait">
                  <motion.div key={movie.id} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -14, scale: 0.98 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="grid md:grid-cols-[360px_1fr] lg:grid-cols-[400px_1fr] gap-8 md:gap-12 items-start">
                    <div className="relative group mx-auto md:mx-0 max-w-[360px] md:max-w-none">
                      <div className="absolute -inset-2 rounded-[2.5rem] opacity-25 blur-2xl transition-opacity duration-700 group-hover:opacity-40" style={{ background: theme.glow }} />
                      <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">{!posterLoadError && movie.poster_path ? (<Image src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} width={400} height={600} className="w-full transition-transform duration-700 group-hover:scale-[1.02]" alt={`Poster de ${movie.title}`} priority onError={() => setPosterLoadError(true)} />) : (<div className="aspect-[2/3] w-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center text-zinc-400"><div className="text-center px-6"><Clapperboard size={30} className="mx-auto mb-3 text-zinc-500" /><p className="font-semibold text-sm">Poster indisponível</p></div></div>)}</div>
                    </div>
                    <div>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-medium mb-4 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04]"><Sparkles size={12} className="text-amber-400" /> <span className="text-zinc-400">Feito pra esse momento</span></motion.div>
                      <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5 tracking-tight leading-[1.1]">{movie.title}</motion.h1>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} className="flex flex-wrap gap-2 mb-4">
                        <span className="px-3 py-1.5 bg-zinc-800/55 backdrop-blur-md border border-white/10 rounded-xl text-xs font-bold text-zinc-200 flex items-center gap-1.5"><Star size={12} className="text-yellow-400" fill="currentColor" /> {movie.vote_average.toFixed(1)}</span>
                        <span className="px-3 py-1.5 bg-zinc-800/55 backdrop-blur-md border border-white/10 rounded-xl text-xs font-bold text-zinc-200">{movie.release_date?.split("-")[0] || "—"}</span>
                        {movie.runtime && movie.runtime > 0 && <span className="px-3 py-1.5 bg-zinc-800/55 backdrop-blur-md border border-white/10 rounded-xl text-xs font-bold text-zinc-200">{formatRuntime(movie.runtime)}</span>}
                        {quiz.mood && <span className="px-3 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5" style={{ borderColor: theme.border, color: theme.glow, background: `${theme.glow}15` }}><quiz.mood.Icone size={12} /> {quiz.mood.nome}</span>}
                      </motion.div>
                      {visibleProviders.length > 0 && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.26 }} className="flex flex-wrap items-center gap-2 mb-8"><span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mr-1">Disponível em</span>{visibleProviders.map((p) => <ProviderBadge key={p.provider_id} provider={p} />)}</motion.div>)}
                      {visibleProviders.length === 0 && <div className="mb-4" />}
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-10">{movie.overview || "Sem sinopse disponível, mas confia — esse vale a pena."}</motion.p>
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} className="space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <motion.button whileTap={{ scale: 0.95 }} disabled={isSaving} onClick={() => openTrailer(movie.id)} className="px-6 sm:px-8 py-3.5 bg-white text-black border border-white rounded-2xl flex items-center gap-2.5 hover:bg-zinc-100 transition font-semibold text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"><Play size={18} /> Ver Trailer</motion.button>
                          <motion.button whileTap={{ scale: 0.95 }} disabled={isSaving} onClick={() => addToCinemateca(movie)} className="px-6 sm:px-8 py-3.5 bg-white/10 backdrop-blur-md text-white border border-white/25 rounded-2xl flex items-center gap-2.5 hover:bg-white/20 transition font-semibold text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"><BookmarkPlus size={18} /> Salvar</motion.button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <motion.button whileTap={{ scale: 0.95 }} disabled={isSaving} onClick={() => markAsWatched(movie)} className="px-4 sm:px-5 py-2.5 bg-transparent border border-white/15 rounded-xl flex items-center gap-2 hover:bg-white/[0.06] transition font-medium text-zinc-400 hover:text-zinc-200 text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"><CheckCircle2 size={16} /> Já vi esse</motion.button>
                          <motion.button whileTap={{ scale: 0.95 }} disabled={isSaving} onClick={() => discoverMovie(true)} className="px-4 sm:px-5 py-2.5 bg-transparent border border-white/15 rounded-xl flex items-center gap-2 hover:bg-white/[0.06] transition font-medium text-zinc-400 hover:text-zinc-200 text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"><RefreshCw size={16} /> Outro filme</motion.button>
                        </div>
                        <div><motion.button whileTap={{ scale: 0.95 }} onClick={() => shareMovie(movie)} disabled={isSaving || shareLoading} className="px-5 py-3.5 rounded-2xl border border-transparent [background:linear-gradient(#0b0b10,#0b0b10)_padding-box,linear-gradient(90deg,rgba(236,72,153,0.8),rgba(99,102,241,0.8))_border-box] flex items-center gap-2 hover:brightness-125 transition text-zinc-300 hover:text-white text-sm disabled:opacity-50">{shareLoading ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} {shareLoading ? "Gerando..." : "Compartilhar"}</motion.button></div>
                      </motion.div>
                      <motion.button whileTap={{ scale: 0.95 }} disabled={isSaving} className="mt-8 text-zinc-600 hover:text-white transition text-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed" onClick={resetQuiz}><ArrowLeft size={14} /> Recomeçar quiz</motion.button>
                    </div>
                  </motion.div>
                  </AnimatePresence>
                )}
              </div>
            )}

            {activeTab === "cinemateca" && (
              <div>
                <div className="flex gap-2 mb-8 overflow-x-auto pb-1">{([{ key: "todos" as const, label: "Todos", count: stats.total, icon: Library }, { key: "para_ver" as const, label: "Na fila", count: stats.paraVer, icon: Eye }, { key: "ja_visto" as const, label: "Assistidos", count: stats.jaVisto, icon: CheckCircle2 }]).map((f) => (<button key={f.key} onClick={() => setCinematecaFilter(f.key)} className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${cinematecaFilter === f.key ? "bg-white/[0.12] text-white border border-white/10" : "bg-white/[0.03] text-zinc-500 border border-transparent hover:text-zinc-300"}`}><f.icon size={13} />{f.label} <span className="text-[10px] opacity-60">{f.count}</span></button>))}</div>
                {cinematecaLoading ? (<div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-zinc-500" size={28} /></div>
                ) : filteredCinemateca.length === 0 ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">{cinematecaFilter === "ja_visto" ? <CheckCircle2 size={24} className="text-zinc-600" /> : cinematecaFilter === "para_ver" ? <Eye size={24} className="text-zinc-600" /> : <Popcorn size={24} className="text-zinc-600" />}</div>
                    <p className="text-zinc-400 text-lg font-medium">{cinematecaFilter === "todos" ? "Nenhum filme salvo ainda" : cinematecaFilter === "para_ver" ? "Nada na fila ainda" : "Nenhum assistido por aqui"}</p>
                    <p className="text-zinc-600 text-sm mt-2 max-w-xs mx-auto">{cinematecaFilter === "todos" ? "Descobre um filme e salva aqui pra não esquecer." : cinematecaFilter === "para_ver" ? "Seus próximos filmes vão aparecer aqui." : "Marca os que você já viu pra gente não repetir."}</p>
                    {cinematecaFilter === "todos" && (<motion.button whileTap={{ scale: 0.95 }} onClick={() => setActiveTab("descobrir")} className="mt-6 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl text-sm font-semibold hover:bg-white/15 transition"><span className="flex items-center gap-2"><Compass size={16} /> Descobrir filmes</span></motion.button>)}
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5"><AnimatePresence>{filteredCinemateca.map((item, i) => { const hasPosterError = !item.poster_path || Boolean(cinematecaPosterErrors[item.movie_id]); return (<motion.div key={item.id ?? item.movie_id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.03, ease: "easeOut" }} className="group bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.05] hover:border-white/15 transition-all duration-300"><div className="relative aspect-[2/3] overflow-hidden cursor-pointer" onClick={() => setDetailModalItem(item)}>{!hasPosterError ? (<Image src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw" className="object-cover transition-transform duration-500 group-hover:scale-105" alt={item.movie_title} onError={() => setCinematecaPosterErrors((prev) => ({ ...prev, [item.movie_id]: true }))} />) : (<div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center text-zinc-400"><div className="text-center px-4"><Clapperboard size={24} className="mx-auto mb-2 text-zinc-500" /><p className="text-[11px] font-semibold">Poster indisponível</p></div></div>)}<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:flex items-end p-3"><div className="flex gap-1.5 w-full"><button disabled={isSaving} onClick={(e) => { e.stopPropagation(); toggleStatus(item); }} className="flex-1 p-2 bg-white/15 backdrop-blur-md rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 hover:bg-white/25 transition disabled:opacity-60 disabled:cursor-not-allowed">{item.status === "para_ver" ? <><Eye size={12} /> Já vi</> : <><EyeOff size={12} /> Não vi</>}</button><button disabled={isSaving} onClick={(e) => { e.stopPropagation(); removeFromCinemateca(item); }} className="p-2 bg-red-500/20 backdrop-blur-md rounded-lg hover:bg-red-500/40 transition disabled:opacity-60 disabled:cursor-not-allowed"><Trash2 size={12} className="text-red-300" /></button></div></div>{item.status === "ja_visto" && <div className="absolute top-2 right-2 bg-emerald-500/90 backdrop-blur-sm p-1 rounded-full"><CheckCircle2 size={12} /></div>}</div><div className="p-3 bg-zinc-950/60"><p className="text-xs font-bold truncate mb-1.5">{item.movie_title}</p><StarRating value={item.rating ?? 0} onChange={(v) => updateRating(item, v)} size={12} /></div></motion.div>); })}</AnimatePresence></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>{trailerOpen && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl" onClick={() => setTrailerOpen(false)}><button className="absolute top-6 right-6 text-white/40 hover:text-white transition p-2" onClick={() => setTrailerOpen(false)} aria-label="Fechar"><X size={28} /></button><div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>{trailerKey ? <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen title="Trailer" /> : <div className="w-full h-full flex items-center justify-center bg-zinc-900"><Loader2 className="animate-spin text-zinc-500 mr-3" size={20} /><span className="text-zinc-500">Carregando...</span></div>}</div></motion.div>)}</AnimatePresence>
      <AnimatePresence>{detailModalItem && (<MovieDetailModal item={detailModalItem} onClose={() => setDetailModalItem(null)} onToggleStatus={toggleStatus} onRemove={removeFromCinemateca} onUpdateRating={updateRating} onOpenTrailer={openTrailer} isSaving={isSaving} />)}</AnimatePresence>
      <AnimatePresence>{isLoading && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center"><div className="relative mx-auto mb-6 w-14 h-14"><Loader2 className="animate-spin text-white absolute inset-0" size={56} /></div><AnimatePresence mode="wait"><motion.p key={loadingMsg} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-sm tracking-widest uppercase font-medium text-zinc-300">{LOADING_MESSAGES[loadingMsg]}</motion.p></AnimatePresence></motion.div></motion.div>)}</AnimatePresence>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}