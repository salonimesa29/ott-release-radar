-- OTT Release Radar: initial schema
-- Catalogue tables (titles, ott_releases) are shared and written only by the server (service role).
-- Per-user tables are protected by RLS: a user can only read and modify their own rows.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles & preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  preferred_genres text[] not null default array['thriller','science_fiction','indie_drama'],
  preferred_languages text[] not null default array['hi','en','ta'],
  preferred_platforms text[] not null default array['netflix','prime_video','hotstar'],
  preferred_content_types text[] not null default array['movie','tv'],
  preferred_runtime text not null default 'any',
  dubbed_content_preference text not null default 'no_preference',
  popularity_preference text not null default 'balanced',
  genre_exploration text not null default 'familiar',
  discovery_mode text not null default 'balanced',
  preferred_mood text,
  use_feedback boolean not null default true,
  digest_enabled boolean not null default true,
  digest_day smallint not null default 5,          -- 0 = Sunday … 5 = Friday (ISO-ish, Asia/Kolkata)
  digest_time time not null default '18:00',
  timezone text not null default 'Asia/Kolkata',
  telegram_chat_id bigint,
  telegram_username text,
  telegram_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prefs_genres_valid check (preferred_genres <@ array[
    'thriller','science_fiction','indie_drama','comedy','romance','crime','mystery',
    'action','horror','documentary','animation','family']::text[]),
  constraint prefs_languages_valid check (
    cardinality(preferred_languages) between 1 and 20
    and array_to_string(preferred_languages, ',') ~ '^[a-z]{2}(,[a-z]{2})*$'),
  constraint prefs_platforms_valid check (
    cardinality(preferred_platforms) >= 1
    and preferred_platforms <@ array['netflix','prime_video','hotstar']::text[]),
  constraint prefs_content_types_valid check (
    cardinality(preferred_content_types) >= 1
    and preferred_content_types <@ array['movie','tv']::text[]),
  constraint prefs_runtime_valid check (preferred_runtime in ('any','under_60','under_120','over_120')),
  constraint prefs_dubbed_valid check (dubbed_content_preference in ('original_only','dubbed_ok','no_preference')),
  constraint prefs_popularity_valid check (popularity_preference in ('popular','balanced','hidden_gems')),
  constraint prefs_exploration_valid check (genre_exploration in ('familiar','open')),
  constraint prefs_discovery_valid check (discovery_mode in ('stick','balanced','surprise')),
  constraint prefs_mood_valid check (preferred_mood is null or preferred_mood in (
    'mind_bending','edge_of_seat','feel_good','emotionally_intense','thought_provoking','something_different')),
  constraint prefs_digest_day_valid check (digest_day between 0 and 6),
  constraint prefs_tz_valid check (timezone = 'Asia/Kolkata')
);

-- Create a profile + default preferences for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.titles (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie','tv')),
  title text not null,
  original_title text,
  overview text,
  original_language text not null,
  genre_ids integer[] not null default '{}',
  genre_names text[] not null default '{}',
  networks text[] not null default '{}',
  poster_path text,
  backdrop_path text,
  runtime_minutes integer check (runtime_minutes is null or runtime_minutes > 0),
  episode_runtime_minutes integer check (episode_runtime_minutes is null or episode_runtime_minutes > 0),
  number_of_seasons integer,
  number_of_episodes integer,
  vote_average numeric(3,1),
  vote_count integer,
  popularity numeric(10,3),
  metadata_fingerprint text not null,
  metadata_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tmdb_id, media_type)
);

create table public.ott_releases (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.titles (id) on delete cascade,
  provider_key text not null check (provider_key in ('netflix','prime_video','hotstar')),
  provider_id integer,
  provider_name text not null,
  region text not null default 'IN',
  streaming_release_date date,
  release_date_type text not null check (release_date_type in (
    'in_digital_release','series_premiere','season_premiere','global_digital_release','primary_release')),
  season_number integer not null default 0,   -- 0 for movies
  episode_count integer,
  availability_status text not null check (availability_status in ('verified','unverified_date')),
  source_name text not null default 'tmdb',
  source_url text,
  last_verified_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per title × provider × region × release event (season 0 for movies).
alter table public.ott_releases
  add constraint ott_releases_event_key unique (title_id, provider_key, region, release_date_type, season_number);

-- ---------------------------------------------------------------------------
-- AI recommendations, watchlist, feedback
-- ---------------------------------------------------------------------------
create table public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id uuid not null references public.titles (id) on delete cascade,
  match_score integer not null check (match_score between 0 and 100),
  verdict text not null check (verdict in ('watch','maybe','skip')),
  synopsis text not null,
  explanation text not null,
  matched_preferences text[] not null default '{}',
  confidence text not null check (confidence in ('high','medium','low')),
  model_name text not null,
  generated_at timestamptz not null default now(),
  metadata_fingerprint text not null,
  preference_fingerprint text not null,
  unique (user_id, title_id, preference_fingerprint)
);

create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id uuid not null references public.titles (id) on delete cascade,
  status text not null default 'want_to_watch'
    check (status in ('want_to_watch','watching','watched','not_interested')),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title_id)
);

create table public.viewing_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id uuid not null references public.titles (id) on delete cascade,
  feedback_type text not null check (feedback_type in ('not_interested','liked','disliked')),
  rating smallint check (rating is null or rating between 1 and 5),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Digest delivery
-- ---------------------------------------------------------------------------
create table public.digest_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('preview','test','weekly')),
  period_start date not null,
  period_end date not null,
  status text not null check (status in ('preview','pending','sent','partial','failed','skipped')),
  telegram_message_id bigint,
  telegram_message_ids bigint[] not null default '{}',
  chunks_total integer not null default 0,
  chunks_sent integer not null default 0,
  title_count integer not null default 0,
  recommended_count integer not null default 0,
  message_preview text,
  message_chunks text[] not null default '{}',   -- exact messages, so a partial delivery can resume
  sent_at timestamptz,
  error_message text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('release_refresh','weekly_digest')),
  run_key text not null unique,   -- e.g. weekly_digest:2026-10-16 — prevents duplicate runs per window
  trigger text not null check (trigger in ('cron','manual')),
  status text not null check (status in ('running','succeeded','partial','failed','skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_processed integer not null default 0,
  records_failed integer not null default 0,
  summary jsonb,
  error_summary text,
  created_at timestamptz not null default now()
);

create table public.integration_status (
  id uuid primary key default gen_random_uuid(),
  integration_name text not null unique check (integration_name in ('supabase','tmdb','gemini','telegram')),
  status text not null check (status in ('ok','error','unconfigured','unknown')),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index titles_title_trgm_idx on public.titles using gin (title gin_trgm_ops);
create index titles_language_idx on public.titles (original_language);
create index ott_releases_date_idx on public.ott_releases (region, streaming_release_date desc);
create index ott_releases_provider_idx on public.ott_releases (provider_key);
create index ott_releases_title_idx on public.ott_releases (title_id);
create index ai_recs_user_idx on public.ai_recommendations (user_id, preference_fingerprint);
create index watchlist_user_idx on public.watchlist (user_id, status);
create index feedback_user_idx on public.viewing_feedback (user_id, title_id);
create index digest_history_user_idx on public.digest_history (user_id, created_at desc);
create index automation_runs_job_idx on public.automation_runs (job_type, started_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger prefs_updated before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger titles_updated before update on public.titles for each row execute function public.set_updated_at();
create trigger releases_updated before update on public.ott_releases for each row execute function public.set_updated_at();
create trigger watchlist_updated before update on public.watchlist for each row execute function public.set_updated_at();
create trigger digest_updated before update on public.digest_history for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.titles enable row level security;
alter table public.ott_releases enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.watchlist enable row level security;
alter table public.viewing_feedback enable row level security;
alter table public.digest_history enable row level security;
alter table public.telegram_link_codes enable row level security;
alter table public.automation_runs enable row level security;
alter table public.integration_status enable row level security;

-- Own profile
create policy "own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Own preferences. Telegram columns are only written by the server after verification (see column grants below).
create policy "own prefs read" on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "own prefs update" on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke update on public.user_preferences from authenticated;
grant update (
  preferred_genres, preferred_languages, preferred_platforms, preferred_content_types, preferred_runtime,
  dubbed_content_preference, popularity_preference, genre_exploration, discovery_mode, preferred_mood,
  use_feedback, digest_enabled, digest_day
) on public.user_preferences to authenticated;

-- Shared catalogue: any signed-in user may read; only the service role writes.
create policy "catalogue read titles" on public.titles for select to authenticated using (true);
create policy "catalogue read releases" on public.ott_releases for select to authenticated using (true);

-- Own recommendations (written by the server)
create policy "own recs read" on public.ai_recommendations for select to authenticated using ((select auth.uid()) = user_id);

-- Own watchlist
create policy "own watchlist read" on public.watchlist for select to authenticated using ((select auth.uid()) = user_id);
create policy "own watchlist insert" on public.watchlist for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own watchlist update" on public.watchlist for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own watchlist delete" on public.watchlist for delete to authenticated using ((select auth.uid()) = user_id);

-- Own feedback
create policy "own feedback read" on public.viewing_feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy "own feedback insert" on public.viewing_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own feedback delete" on public.viewing_feedback for delete to authenticated using ((select auth.uid()) = user_id);

-- Own digest history (written by the server)
create policy "own digests read" on public.digest_history for select to authenticated using ((select auth.uid()) = user_id);

-- Operational status is non-sensitive and readable by signed-in users; written by the server.
create policy "ops read runs" on public.automation_runs for select to authenticated using (true);
create policy "ops read integrations" on public.integration_status for select to authenticated using (true);

-- telegram_link_codes: no policies → only the service role can access it.
