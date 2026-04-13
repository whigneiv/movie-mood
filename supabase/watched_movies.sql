create table if not exists public.watched_movies (
  user_id text not null,
  movie_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

alter table public.watched_movies enable row level security;

create policy "allow read watched movies"
on public.watched_movies
for select
to anon
using (true);

create policy "allow insert watched movies"
on public.watched_movies
for insert
to anon
with check (true);
