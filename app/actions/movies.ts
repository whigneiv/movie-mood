"use server";

import { createClient } from "@supabase/supabase-js";

type Ritmo =
  | "frenetico"
  | "de_boa"
  | "curto_direto"
  | "filme_pipoca";
type Vibe =
  | "mundo_real"
  | "fora_da_realidade"
  | "misterio_criminal"
  | "fritar_cerebro";
type Companhia = "sozinho" | "casal_date" | "galera" | "familia";
type Epoca =
  | "classicos"
  | "anos_2000"
  | "passados_recentes"
  | "novinhos";

type MoviesFilters = {
  genreId?: number;
  providers?: string;
  year?: number;
  ritmo?: Ritmo;
  vibe?: Vibe;
  companhia?: Companhia;
  epoca?: Epoca;
};

type GetMoviesInput = {
  filters: MoviesFilters;
  blacklist: number[];
  userPhone?: string;
};

/** TMDB watch provider IDs — mirrors quiz streaming picks (app/page STREAMINGS). */
const STREAMING_PROVIDER_IDS: Record<string, string> = {
  netflix: "8",
  prime: "119",
  disney: "337",
  max: "384",
  apple: "350",
  globoplay: "307",
};

/** Serializable quiz slice for building discover filters (client passes this from quiz state). */
export type QuizFiltersInput = {
  moodGenreId?: number | null;
  streamings: readonly string[];
  epoca?: Epoca | null;
  ritmo?: Ritmo | null;
  vibe?: Vibe | null;
  companhia?: Companhia | null;
};

export function buildMoviesFiltersFromQuiz(quiz: QuizFiltersInput): MoviesFilters {
  const providers = quiz.streamings
    .map((s) => STREAMING_PROVIDER_IDS[s])
    .filter(Boolean)
    .join("|");
  const yearMap: Partial<Record<Epoca, number>> = {
    classicos: 1985,
    anos_2000: 2005,
    passados_recentes: 2018,
    novinhos: new Date().getFullYear(),
  };
  return {
    genreId: quiz.moodGenreId ?? undefined,
    providers: providers || undefined,
    year: quiz.epoca ? yearMap[quiz.epoca] : undefined,
    ritmo: quiz.ritmo ?? undefined,
    vibe: quiz.vibe ?? undefined,
    companhia: quiz.companhia ?? undefined,
    epoca: quiz.epoca ?? undefined,
  };
}

/* [CHANGE #12] Provider type */
type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
};

type TMDBMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  runtime?: number;
  genre_ids?: number[];
  providers?: Provider[]; /* [CHANGE #12] */
};

type TMDBListResponse = { results?: TMDBMovie[] };

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon);
}

async function getCinematecaMovieIds(userPhone?: string): Promise<number[]> {
  if (!userPhone) return [];
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cinemateca")
    .select("movie_id")
    .eq("user_phone", userPhone)
    .limit(500);
  if (error || !data) return [];
  return data
    .map((row) => Number((row as { movie_id?: number }).movie_id))
    .filter((id) => Number.isFinite(id));
}

function getTMDBAuthHeaders(): HeadersInit {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("Missing TMDB_API_KEY on server.");
  if (key.startsWith("eyJ")) return { Authorization: `Bearer ${key}` };
  return {};
}

function appendApiKeyIfNeeded(url: string): string {
  const key = process.env.TMDB_API_KEY;
  const parsed = new URL(url);
  if (!parsed.searchParams.has("watch_region")) parsed.searchParams.set("watch_region", "BR");
  if (!key || key.startsWith("eyJ")) return parsed.toString();
  parsed.searchParams.set("api_key", key);
  return parsed.toString();
}

export async function fetchTMDB(url: string): Promise<TMDBListResponse> {
  const finalUrl = appendApiKeyIfNeeded(url);
  const res = await fetch(finalUrl, {
    headers: getTMDBAuthHeaders(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return { results: [] };
  return (await res.json()) as TMDBListResponse;
}

function applyStrictFilters(params: URLSearchParams, filters: MoviesFilters): void {
  if (filters.genreId) params.set("with_genres", String(filters.genreId));

  if (filters.providers) {
    params.set("watch_region", "BR");
    params.set("with_watch_monetization_types", "flatrate");
    params.set("with_watch_providers", filters.providers);
  }

  if (filters.ritmo === "curto_direto") params.set("with_runtime.lte", "100");
  if (filters.ritmo === "de_boa") {
    params.set("with_runtime.gte", "115");
    params.set("sort_by", "vote_average.desc");
  }
  if (filters.ritmo === "frenetico" || filters.ritmo === "filme_pipoca") {
    params.set("sort_by", "popularity.desc");
  }

  if (filters.vibe === "fritar_cerebro") params.set("with_genres", `${filters.genreId ?? ""},878,9648`);
  if (filters.vibe === "misterio_criminal") params.set("with_genres", `${filters.genreId ?? ""},80,9648,53`);
  if (filters.vibe === "fora_da_realidade") params.set("with_genres", `${filters.genreId ?? ""},14,878`);
  if (filters.vibe === "mundo_real") params.set("with_genres", `${filters.genreId ?? ""},18`);

  if (filters.companhia === "familia") {
    params.set("certification_country", "BR");
    params.set("certification.lte", "12");
  }
  if (filters.companhia === "casal_date") {
    params.set("with_genres", `${filters.genreId ?? ""},10749`);
  }
  if (filters.companhia === "galera") {
    params.set("with_genres", `${filters.genreId ?? ""},28,12,35`);
  }
}

function applyEpoch(params: URLSearchParams, epoca?: Epoca): void {
  if (!epoca) return;
  if (epoca === "classicos") params.set("release_date.lte", "1999-12-31");
  if (epoca === "anos_2000") {
    params.set("release_date.gte", "2000-01-01");
    params.set("release_date.lte", "2009-12-31");
  }
  if (epoca === "passados_recentes") {
    params.set("release_date.gte", "2010-01-01");
    params.set("release_date.lte", "2022-12-31");
  }
  if (epoca === "novinhos") params.set("release_date.gte", "2023-01-01");
}

function calculateScore(movie: TMDBMovie, filters: MoviesFilters): number {
  let score = 0;
  if (filters.genreId && (movie.genre_ids ?? []).includes(filters.genreId)) score += 3;
  if (filters.year) {
    const year = Number(movie.release_date?.slice(0, 4));
    if (year === filters.year) score += 2;
  }
  score += movie.vote_average ?? 0;
  if ((movie.vote_count ?? 0) > 500) score += 2.5;
  return score;
}

/* [CHANGE #12] Busca providers (plataformas de streaming) de um filme */
async function getMovieProviders(movieId: number): Promise<Provider[]> {
  try {
    const url = `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`;
    const finalUrl = appendApiKeyIfNeeded(url);
    const res = await fetch(finalUrl, {
      headers: getTMDBAuthHeaders(),
      next: { revalidate: 86400 }, // cache 24h — providers mudam raramente
    });
    if (!res.ok) return [];
    const data = await res.json();
    const brProviders = data?.results?.BR?.flatrate;
    if (!Array.isArray(brProviders)) return [];
    return brProviders.map(
      (p: { provider_id: number; provider_name: string; logo_path: string }) => ({
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        logo_path: p.logo_path,
      })
    );
  } catch {
    return [];
  }
}

/* Busca runtime + providers dos top 5 filmes em paralelo */
async function hydrateRuntimeTop(list: TMDBMovie[]): Promise<TMDBMovie[]> {
  const top = list.slice(0, 5);
  const rest = list.slice(5);

  const withDetails = await Promise.all(
    top.map(async (movie) => {
      /* Runtime + providers em paralelo pra cada filme */
      const [detail, providers] = await Promise.all([
        fetchTMDB(
          `https://api.themoviedb.org/3/movie/${movie.id}?language=pt-BR`
        ) as Promise<TMDBMovie>,
        getMovieProviders(movie.id),
      ]);
      return { ...movie, runtime: detail.runtime, providers };
    })
  );
  return [...withDetails, ...rest];
}

export async function getMoviesAction({
  filters,
  blacklist,
  userPhone,
}: GetMoviesInput): Promise<TMDBMovie[]> {
  const base = new URLSearchParams({
    language: "pt-BR",
    include_adult: "false",
    sort_by: "popularity.desc",
    watch_region: "BR",
    with_original_language: "en|pt|es",
  });

  const strict = new URLSearchParams(base);
  applyStrictFilters(strict, filters);
  applyEpoch(strict, filters.epoca);

  const relaxed = new URLSearchParams(base);
  if (filters.genreId) relaxed.set("with_genres", String(filters.genreId));
  if (filters.ritmo) {
    applyStrictFilters(relaxed, {
      genreId: filters.genreId,
      ritmo: filters.ritmo,
      vibe: filters.vibe,
    });
  }

  const strictUrl = `https://api.themoviedb.org/3/discover/movie?${strict.toString()}`;
  const relaxedUrl = `https://api.themoviedb.org/3/discover/movie?${relaxed.toString()}`;
  const trendingUrl = "https://api.themoviedb.org/3/trending/movie/week?language=pt-BR";

  const [strictRes, relaxedRes, trendingRes] = await Promise.all([
    fetchTMDB(strictUrl),
    fetchTMDB(relaxedUrl),
    fetchTMDB(trendingUrl),
  ]);

  const unique = new Map<number, TMDBMovie>();
  [...(strictRes.results ?? []), ...(relaxedRes.results ?? []), ...(trendingRes.results ?? [])]
    .filter((movie) => Boolean(movie.poster_path))
    .forEach((movie) => {
      if (!unique.has(movie.id)) unique.set(movie.id, movie);
    });

  const cinematecaMovieIds = await getCinematecaMovieIds(userPhone);
  const blockedIds = new Set<number>([...blacklist, ...cinematecaMovieIds]);
  const filtered = [...unique.values()].filter((movie) => !blockedIds.has(movie.id));

  const ranked = filtered
    .map((movie) => ({ movie, score: calculateScore(movie, filters) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item) => item.movie);

  return hydrateRuntimeTop(ranked);
}

/** Resolve a single movie from TMDB search (poster, runtime, providers) for AI-picked titles. */
export async function getMovieBySearchTitleAction(input: {
  title: string;
  blacklist: number[];
  userPhone?: string;
}): Promise<TMDBMovie | null> {
  const trimmed = input.title.trim();
  if (!trimmed) return null;

  const cinematecaMovieIds = await getCinematecaMovieIds(input.userPhone);
  const blocked = new Set<number>([
    ...input.blacklist,
    ...cinematecaMovieIds,
  ]);

  const data = await fetchTMDB(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(trimmed)}&language=pt-BR&page=1`
  );
  const candidates = (data.results ?? []).filter(
    (m) => Boolean(m.poster_path) && !blocked.has(m.id)
  );
  const pick = candidates[0];
  if (!pick) return null;

  const [detail, providers] = await Promise.all([
    fetchTMDB(
      `https://api.themoviedb.org/3/movie/${pick.id}?language=pt-BR`
    ) as Promise<TMDBMovie>,
    getMovieProviders(pick.id),
  ]);

  return {
    ...pick,
    ...detail,
    overview: detail.overview || pick.overview,
    poster_path: pick.poster_path ?? detail.poster_path,
    backdrop_path: pick.backdrop_path ?? detail.backdrop_path,
    providers,
  };
}

export async function getTrailerAction(movieId: number): Promise<string | null> {
  const fetchVideos = async (language: "pt-BR" | "en-US") => {
    const data = (await fetchTMDB(
      `https://api.themoviedb.org/3/movie/${movieId}/videos?language=${language}`
    )) as {
      results?: Array<{ site: string; type: string; key: string; official?: boolean }>;
    };
    const list = data.results ?? [];
    const trailer =
      list.find((x) => x.site === "YouTube" && x.type === "Trailer" && x.official) ??
      list.find((x) => x.site === "YouTube" && x.type === "Trailer");
    return trailer?.key ?? null;
  };
  return (await fetchVideos("pt-BR")) ?? (await fetchVideos("en-US"));
}