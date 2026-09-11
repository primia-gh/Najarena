-- ============================================================
--  NAJARENA — Schéma de base de données V1 (PostgreSQL / Supabase)
--  Périmètre : LoL 1v1, structure multi-jeux, classement Glicko-2
-- ============================================================

-- ---------- Types ----------
create type verdict_level as enum ('manuel', 'historique', 'code_tournoi');
create type tournament_status as enum ('brouillon','ouvert','checkin','en_cours','termine','annule');
create type match_status as enum ('en_attente','en_cours','termine','litige','forfait');
create type registration_status as enum ('inscrit','confirme','absent','retire');

-- ============================================================
--  1. IDENTITÉ
-- ============================================================

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  pseudo        text unique not null check (char_length(pseudo) between 3 and 20),
  slug          text unique not null,          -- /joueur/[slug]
  avatar_url    text,
  pays          text,
  discord_id    text unique,
  created_at    timestamptz not null default now()
);

create table games (
  id            smallint primary key,
  slug          text unique not null,          -- 'lol', 'valorant'
  nom           text not null,
  actif         boolean not null default true
);

-- Un joueur peut rattacher un compte par jeu (voire plusieurs, un seul principal).
create table game_accounts (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles(id) on delete cascade,
  game_id             smallint not null references games(id),
  puuid               text not null,           -- identifiant stable Riot
  riot_game_name      text not null,
  riot_tag_line       text not null,
  region              text not null,           -- EUW, EUNE...
  est_principal       boolean not null default true,
  verifie_le          timestamptz,             -- null = non vérifié
  methode_verification text,                   -- 'icone_profil' puis 'rso'
  derniere_sync_le    timestamptz,
  defi_icone_id       smallint,                -- icône à adopter en jeu pour prouver la possession (méthode 'icone_profil')
  unique (game_id, puuid)
);
create index on game_accounts (profile_id, game_id);

-- ============================================================
--  2. SAISONS ET TOURNOIS
-- ============================================================

create table seasons (
  id            uuid primary key default gen_random_uuid(),
  game_id       smallint not null references games(id),
  numero        int not null,
  nom           text,
  debut_le      timestamptz not null,
  fin_le        timestamptz not null,
  est_courante  boolean not null default false,
  unique (game_id, numero)
);

create table tournaments (
  id                  uuid primary key default gen_random_uuid(),
  game_id             smallint not null references games(id),
  season_id           uuid references seasons(id),
  organisateur_id     uuid not null references profiles(id),
  slug                text unique not null,
  nom                 text not null,
  format              text not null,            -- '1v1', '5v5'
  type_bracket        text not null default 'elim_simple',
  best_of             smallint not null default 1,
  capacite            smallint not null check (capacite in (4,8,16,32,64)),
  region              text not null,
  rating_min          int,
  rating_max          int,
  compte_pour_classement boolean not null default true,
  debute_le           timestamptz not null,
  checkin_ouvre_le    timestamptz not null,
  statut              tournament_status not null default 'brouillon',
  verrouille_le       timestamptz,              -- après 1er inscrit : règles figées
  cree_le             timestamptz not null default now()
);
create index on tournaments (game_id, statut, debute_le);

create table registrations (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  profile_id    uuid not null references profiles(id),
  statut        registration_status not null default 'inscrit',
  seed          smallint,
  rating_a_inscription int,                     -- figé : preuve du niveau au moment T
  inscrit_le    timestamptz not null default now(),
  confirme_le   timestamptz,
  unique (tournament_id, profile_id)
);

-- ============================================================
--  3. MATCHS ET VERDICTS
-- ============================================================

create table matches (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  tour            smallint not null,            -- 1 = premier tour
  position        smallint not null,            -- position dans le tour
  match_suivant_id uuid references matches(id), -- où va le gagnant
  statut          match_status not null default 'en_attente',
  code_tournoi    text,                         -- code de lobby Riot (niveau 3)
  demarre_le      timestamptz,
  unique (tournament_id, tour, position)
);

create table match_participants (
  match_id      uuid not null references matches(id) on delete cascade,
  profile_id    uuid not null references profiles(id),
  slot          smallint not null check (slot in (1,2)),
  score         smallint not null default 0,
  est_gagnant   boolean,
  primary key (match_id, profile_id)
);

-- Le verdict : QUI a gagné, D'OÙ vient l'information, à QUEL niveau de fiabilité.
create table match_verdicts (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  niveau          verdict_level not null,
  gagnant_id      uuid references profiles(id),  -- null si double forfait
  riot_match_id   text,                          -- partie officielle correspondante
  decide_par      uuid references profiles(id),  -- rempli si niveau 'manuel'
  motif           text,                          -- journalisé et affiché publiquement
  est_definitif   boolean not null default false,
  cree_le         timestamptz not null default now()
);
create unique index on match_verdicts (match_id) where est_definitif;

create table disputes (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id),
  ouvert_par    uuid not null references profiles(id),
  motif         text not null,
  resolution    text,
  resolu_par    uuid references profiles(id),
  resolu_le     timestamptz,
  cree_le       timestamptz not null default now()
);

-- ============================================================
--  4. CLASSEMENT (Glicko-2)
-- ============================================================

-- État courant : une ligne par (joueur, jeu, saison).
create table ratings (
  profile_id      uuid not null references profiles(id) on delete cascade,
  game_id         smallint not null references games(id),
  season_id       uuid not null references seasons(id),
  rating          numeric(7,2) not null default 1500,
  rd              numeric(6,2) not null default 350,
  volatilite      numeric(8,6) not null default 0.06,
  matchs_joues    int not null default 0,
  est_classe      boolean generated always as (rd <= 150) stored,
  maj_le          timestamptz not null default now(),
  primary key (profile_id, game_id, season_id)
);
create index on ratings (game_id, season_id, rating desc) where rd <= 150;

-- Journal immuable : chaque variation de points est traçable et affichable.
create table rating_events (
  id              bigserial primary key,
  profile_id      uuid not null references profiles(id),
  game_id         smallint not null references games(id),
  season_id       uuid not null references seasons(id),
  match_id        uuid references matches(id),
  tournament_id   uuid references tournaments(id), -- clé de la garde d'idempotence par (tournoi, joueur)
  motif           text not null,                 -- 'tournoi', 'soft_reset', 'inactivite', 'correction'
  rating_avant    numeric(7,2) not null,
  rd_avant        numeric(6,2) not null,
  rating_apres    numeric(7,2) not null,
  rd_apres        numeric(6,2) not null,
  adversaire_id   uuid references profiles(id),
  cree_le         timestamptz not null default now()
);
create index on rating_events (profile_id, cree_le desc);
create index on rating_events (tournament_id, profile_id);

-- Paliers : seuils fixes, jamais des quotas.
create table tiers (
  id            smallint primary key,
  game_id       smallint not null references games(id),
  nom           text not null,
  rating_min    int not null,
  ordre         smallint not null
);

-- ============================================================
--  5. ÉQUIPES (P1 — préparé, non utilisé en V1)
-- ============================================================

create table teams (
  id            uuid primary key default gen_random_uuid(),
  game_id       smallint not null references games(id),
  slug          text unique not null,
  nom           text not null,
  tag           text not null check (char_length(tag) between 2 and 5),
  capitaine_id  uuid not null references profiles(id),
  cree_le       timestamptz not null default now()
);

create table team_members (
  team_id       uuid not null references teams(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  role          text,
  accepte_le    timestamptz,
  primary key (team_id, profile_id)
);

-- ============================================================
--  6. SÉCURITÉ (RLS) — principe directeur
-- ============================================================
-- Règle absolue : ratings et rating_events ne sont JAMAIS écrits
-- depuis le client. Écriture réservée au service_role (fonction serveur).

alter table ratings        enable row level security;
alter table rating_events  enable row level security;
alter table match_verdicts enable row level security;
alter table profiles       enable row level security;
alter table game_accounts  enable row level security;

create policy "classement lisible par tous"
  on ratings for select using (true);

create policy "journal lisible par tous"
  on rating_events for select using (true);

create policy "verdicts lisibles par tous"
  on match_verdicts for select using (true);

create policy "profil modifiable par son proprietaire"
  on profiles for update using (auth.uid() = id);

create policy "profils lisibles par tous"
  on profiles for select using (true);

-- Le Riot ID vérifié fait partie du CV e-sport public : lisible par tous.
create policy "comptes de jeu lisibles par tous"
  on game_accounts for select using (true);

-- Aucune policy d'INSERT/UPDATE sur ratings et rating_events :
-- l'absence de policy = écriture impossible côté client. C'est voulu.
-- Idem pour match_verdicts : aucune policy d'INSERT/UPDATE, l'écriture
-- des verdicts (tous niveaux, y compris manuel) passe par une fonction serveur.

-- Création du profil : atomique avec l'inscription (auth.users), jamais
-- depuis le client. Pas de policy d'INSERT sur profiles — inutile, puisque
-- seul ce trigger (security definer) y écrit.
-- Si aucun pseudo n'est fourni en métadonnée (compte créé depuis le
-- tableau de bord Supabase, ou un futur flux qui n'en fournit pas tout de
-- suite), un pseudo par défaut est généré : profiles.pseudo est NOT NULL,
-- et le trigger tourne dans la même transaction que l'insert dans
-- auth.users — le laisser échouer bloquerait la création du compte lui-même.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pseudo text;
  v_slug text;
begin
  v_pseudo := new.raw_user_meta_data->>'pseudo';
  v_slug := new.raw_user_meta_data->>'slug';

  if v_pseudo is null or v_slug is null then
    v_pseudo := 'Joueur-' || substr(new.id::text, 1, 8);
    v_slug := lower(v_pseudo);
  end if;

  insert into public.profiles (id, pseudo, slug)
  values (new.id, v_pseudo, v_slug);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS des 10 tables restantes ----------
-- Principe : lecture publique partout (tournois, brackets et CV joueur
-- doivent être indexables et consultables par tous), écriture réservée
-- à la bonne personne. Pour les tables de référence (games, seasons,
-- tiers), même règle que ratings : aucune policy d'écriture, seed et
-- mises à jour via migration/service_role uniquement.

alter table games              enable row level security;
alter table seasons            enable row level security;
alter table tournaments        enable row level security;
alter table registrations      enable row level security;
alter table matches            enable row level security;
alter table match_participants enable row level security;
alter table disputes           enable row level security;
alter table tiers              enable row level security;
alter table teams              enable row level security;
alter table team_members       enable row level security;

create policy "jeux lisibles par tous"
  on games for select using (true);

create policy "saisons lisibles par tous"
  on seasons for select using (true);

create policy "paliers lisibles par tous"
  on tiers for select using (true);

create policy "tournois lisibles par tous"
  on tournaments for select using (true);

create policy "organisateur cree son tournoi"
  on tournaments for insert with check (organisateur_id = auth.uid());

create policy "organisateur modifie son tournoi"
  on tournaments for update using (organisateur_id = auth.uid());

create policy "inscriptions lisibles par tous"
  on registrations for select using (true);

create policy "joueur s inscrit lui meme"
  on registrations for insert with check (profile_id = auth.uid());

create policy "joueur ou organisateur modifie l inscription"
  on registrations for update using (
    profile_id = auth.uid()
    or exists (
      select 1 from tournaments t
      where t.id = registrations.tournament_id
        and t.organisateur_id = auth.uid()
    )
  );

create policy "matchs lisibles par tous"
  on matches for select using (true);

create policy "organisateur gere les matchs de son tournoi"
  on matches for insert with check (
    exists (
      select 1 from tournaments t
      where t.id = matches.tournament_id
        and t.organisateur_id = auth.uid()
    )
  );

create policy "organisateur modifie les matchs de son tournoi"
  on matches for update using (
    exists (
      select 1 from tournaments t
      where t.id = matches.tournament_id
        and t.organisateur_id = auth.uid()
    )
  );

create policy "participants lisibles par tous"
  on match_participants for select using (true);

create policy "organisateur gere les participants"
  on match_participants for insert with check (
    exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = match_participants.match_id
        and t.organisateur_id = auth.uid()
    )
  );

create policy "organisateur modifie les participants"
  on match_participants for update using (
    exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = match_participants.match_id
        and t.organisateur_id = auth.uid()
    )
  );

-- Litiges : visibles par les deux joueurs du match et l'organisateur,
-- ouverts par un participant, résolus par l'organisateur.

create policy "litige visible par les concernes"
  on disputes for select using (
    ouvert_par = auth.uid()
    or exists (
      select 1 from match_participants mp
      where mp.match_id = disputes.match_id
        and mp.profile_id = auth.uid()
    )
    or exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = disputes.match_id
        and t.organisateur_id = auth.uid()
    )
  );

create policy "un participant ouvre un litige"
  on disputes for insert with check (
    ouvert_par = auth.uid()
    and exists (
      select 1 from match_participants mp
      where mp.match_id = disputes.match_id
        and mp.profile_id = auth.uid()
    )
  );

create policy "organisateur resout le litige"
  on disputes for update using (
    exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = disputes.match_id
        and t.organisateur_id = auth.uid()
    )
  );

-- Équipes (P1 — préparé, non utilisé en V1, sécurisé par anticipation).

create policy "equipes lisibles par tous"
  on teams for select using (true);

create policy "capitaine cree son equipe"
  on teams for insert with check (capitaine_id = auth.uid());

create policy "capitaine modifie son equipe"
  on teams for update using (capitaine_id = auth.uid());

create policy "membres lisibles par tous"
  on team_members for select using (true);

create policy "capitaine invite un membre"
  on team_members for insert with check (
    exists (
      select 1 from teams tm
      where tm.id = team_members.team_id
        and tm.capitaine_id = auth.uid()
    )
  );

create policy "membre accepte ou capitaine gere"
  on team_members for update using (
    profile_id = auth.uid()
    or exists (
      select 1 from teams tm
      where tm.id = team_members.team_id
        and tm.capitaine_id = auth.uid()
    )
  );

create policy "membre quitte ou capitaine retire"
  on team_members for delete using (
    profile_id = auth.uid()
    or exists (
      select 1 from teams tm
      where tm.id = team_members.team_id
        and tm.capitaine_id = auth.uid()
    )
  );

-- ---------- Liaison Riot ID (méthode 'icone_profil', avant RSO) ----------
-- Le client peut créer/mettre à jour SA PROPRE liaison via cette fonction
-- (statut non vérifié uniquement — verifie_le n'est jamais touché ici).
-- Toujours self : auth.uid() est utilisé en interne, jamais un paramètre.

create or replace function public.lier_compte_riot(
  p_game_id smallint,
  p_puuid text,
  p_riot_game_name text,
  p_riot_tag_line text,
  p_region text,
  p_defi_icone_id smallint
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_proprietaire uuid;
begin
  select profile_id into v_proprietaire
  from public.game_accounts
  where game_id = p_game_id and puuid = p_puuid;

  if v_proprietaire is not null and v_proprietaire <> auth.uid() then
    raise exception 'RIOT_ACCOUNT_TAKEN';
  end if;

  insert into public.game_accounts (
    profile_id, game_id, puuid, riot_game_name, riot_tag_line, region,
    est_principal, defi_icone_id, methode_verification
  )
  values (
    auth.uid(), p_game_id, p_puuid, p_riot_game_name, p_riot_tag_line, p_region,
    true, p_defi_icone_id, 'icone_profil'
  )
  on conflict (game_id, puuid) do update set
    riot_game_name = excluded.riot_game_name,
    riot_tag_line = excluded.riot_tag_line,
    region = excluded.region,
    defi_icone_id = excluded.defi_icone_id,
    verifie_le = null;
end;
$$;

grant execute on function public.lier_compte_riot(smallint, text, text, text, text, smallint) to authenticated;

-- Note : la confirmation de vérification (verifie_le) n'est PAS exposée par
-- une policy ni une fonction appelable par le client — sinon n'importe qui
-- pourrait se déclarer "vérifié" sans jamais avoir changé son icône en jeu.
-- Elle passe uniquement par le service_role côté serveur Next.js, après
-- que le serveur a lui-même revérifié l'icône actuelle auprès de l'API Riot.

-- ---------- Verrouillage au premier inscrit + verdict manuel ----------

-- Premier inscrit = règles figées (CLAUDE.md §2). Le joueur qui s'inscrit
-- n'est pas l'organisateur : il n'a pas le droit de modifier tournaments,
-- donc ce trigger (security definer) le fait à sa place, de façon atomique.
create or replace function public.verrouiller_tournoi_si_premier_inscrit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.tournaments
  set verrouille_le = now()
  where id = new.tournament_id and verrouille_le is null;
  return new;
end;
$$;

create trigger on_registration_created
  after insert on registrations
  for each row execute function public.verrouiller_tournoi_si_premier_inscrit();

-- Verdict manuel + avancée du bracket. Aucune policy d'INSERT/UPDATE sur
-- match_verdicts n'existe : c'est volontaire, cette fonction est le seul
-- chemin d'écriture. Elle revérifie elle-même que l'appelant est bien
-- l'organisateur du tournoi concerné — jamais un paramètre client de confiance.
-- Rapprochement par historique (niveau 2) — docs/moteur-resultats.md §3.
-- Factorise la logique "faire avancer un vainqueur" (utilisée par
-- enregistrer_verdict_manuel ET enregistrer_verdict_historique), pour que
-- les deux niveaux de verdict fassent démarrer le match suivant (statut
-- en_cours + demarre_le) dès que ses deux vraies places sont connues —
-- c'est le déclencheur de la recherche de résultat pour le tour suivant.
-- Fonction interne, jamais grantée : appelée uniquement depuis d'autres
-- fonctions security definer.
create or replace function public.avancer_vainqueur(p_match_id uuid, p_gagnant_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match_suivant_id uuid;
  v_slot_libre smallint;
  v_nb_participants int;
begin
  update match_participants
  set est_gagnant = (profile_id = p_gagnant_id)
  where match_id = p_match_id;

  update matches set statut = 'termine' where id = p_match_id;

  select match_suivant_id into v_match_suivant_id from matches where id = p_match_id;
  if v_match_suivant_id is null then
    return;
  end if;

  select case
    when exists (select 1 from match_participants where match_id = v_match_suivant_id and slot = 1)
    then 2 else 1
  end into v_slot_libre;

  insert into match_participants (match_id, profile_id, slot)
  values (v_match_suivant_id, p_gagnant_id, v_slot_libre)
  on conflict (match_id, profile_id) do nothing;

  select count(*) into v_nb_participants from match_participants where match_id = v_match_suivant_id;
  if v_nb_participants = 2 then
    update matches set statut = 'en_cours', demarre_le = now() where id = v_match_suivant_id;
  end if;
end;
$$;

create or replace function public.enregistrer_verdict_manuel(
  p_match_id uuid,
  p_gagnant_id uuid,
  p_motif text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_organisateur_id uuid;
begin
  select t.organisateur_id
  into v_organisateur_id
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_organisateur_id is null then
    raise exception 'MATCH_INTROUVABLE';
  end if;

  if v_organisateur_id <> auth.uid() then
    raise exception 'NON_AUTORISE';
  end if;

  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and profile_id = p_gagnant_id
  ) then
    raise exception 'GAGNANT_INVALIDE';
  end if;

  insert into public.match_verdicts (match_id, niveau, gagnant_id, decide_par, motif, est_definitif)
  values (p_match_id, 'manuel', p_gagnant_id, auth.uid(), p_motif, true);

  perform public.avancer_vainqueur(p_match_id, p_gagnant_id);
end;
$$;

grant execute on function public.enregistrer_verdict_manuel(uuid, uuid, text) to authenticated;

-- Écriture d'un verdict niveau 2 (partie retrouvée dans l'historique Riot).
-- Le gagnant vient d'une partie Riot réelle parsée côté serveur, pas d'un
-- choix humain structurellement re-vérifiable par SQL — même frontière de
-- sécurité que cloturer_rating_joueur : AUCUN grant à authenticated,
-- uniquement service_role depuis le worker planifié.
create or replace function public.enregistrer_verdict_historique(
  p_match_id uuid,
  p_gagnant_id uuid,
  p_riot_match_id text
)
returns boolean -- true si écrit, false si déjà décidé (idempotence)
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from match_verdicts where match_id = p_match_id and est_definitif
  ) then
    return false;
  end if;

  if not exists (
    select 1 from match_participants
    where match_id = p_match_id and profile_id = p_gagnant_id
  ) then
    raise exception 'GAGNANT_INVALIDE';
  end if;

  insert into match_verdicts (match_id, niveau, gagnant_id, riot_match_id, est_definitif)
  values (p_match_id, 'historique', p_gagnant_id, p_riot_match_id, true);

  perform avancer_vainqueur(p_match_id, p_gagnant_id);

  return true;
end;
$$;

-- ---------- Administration (modération, litiges) ----------
-- Distinction admin/joueur absente jusque-là du schéma. Table séparée de
-- profiles (pas une colonne) : une élévation de privilège ne doit jamais
-- pouvoir passer par un chemin d'écriture destiné aux données de profil.
create table admins (
  profile_id uuid primary key references profiles(id) on delete cascade,
  ajoute_le  timestamptz not null default now()
);

alter table admins enable row level security;

-- Un utilisateur peut seulement vérifier SA PROPRE présence dans la table
-- (pour afficher/masquer les accès admin côté site) — jamais la liste
-- complète. Aucune policy d'INSERT/UPDATE/DELETE : ajouter un admin ne
-- passe jamais par le client, uniquement par migration/dashboard Supabase.
create policy "verifier son propre statut admin"
  on admins for select using (profile_id = auth.uid());

-- Modération globale : un admin voit et résout TOUS les litiges, pas
-- seulement ceux des tournois qu'il organise (la policy organisateur déjà
-- en place, section 6, reste inchangée en complément).
create policy "admin voit tous les litiges"
  on disputes for select using (
    exists (select 1 from admins where profile_id = auth.uid())
  );

create policy "admin resout tous les litiges"
  on disputes for update using (
    exists (select 1 from admins where profile_id = auth.uid())
  );

-- ---------- Moteur Glicko-2 (docs/moteur-resultats.md §4) ----------
-- Écriture du résultat d'une clôture pour UN joueur. Les valeurs "après"
-- sont calculées en TypeScript (src/lib/glicko2.ts) — cette fonction ne
-- fait AUCUN calcul de classement, elle ne fait qu'écrire de façon
-- atomique et idempotente ce qu'on lui donne. Aucun grant à authenticated :
-- seul service_role (qui contourne les grants, comme il contourne RLS)
-- peut l'appeler, exclusivement depuis le serveur Next.js après avoir
-- lui-même fait tourner le calcul. Une policy ou un grant public ici
-- permettrait à n'importe qui de s'attribuer le rating de son choix —
-- règle non négociable CLAUDE.md §6.1.
create or replace function public.cloturer_rating_joueur(
  p_profile_id uuid,
  p_game_id smallint,
  p_season_id uuid,
  p_tournament_id uuid,
  p_rating_avant numeric,
  p_rd_avant numeric,
  p_volatilite_avant numeric,
  p_rating_apres numeric,
  p_rd_apres numeric,
  p_volatilite_apres numeric,
  p_matchs_comptes int,
  p_motif text
)
returns boolean -- true si écrit, false si déjà traité (idempotence)
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from rating_events
    where profile_id = p_profile_id and tournament_id = p_tournament_id
  ) then
    return false;
  end if;

  insert into rating_events (
    profile_id, game_id, season_id, tournament_id, match_id, motif,
    rating_avant, rd_avant, rating_apres, rd_apres, adversaire_id
  ) values (
    p_profile_id, p_game_id, p_season_id, p_tournament_id, null, p_motif,
    p_rating_avant, p_rd_avant, p_rating_apres, p_rd_apres, null
  );

  insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues, maj_le)
  values (p_profile_id, p_game_id, p_season_id, p_rating_apres, p_rd_apres, p_volatilite_apres, p_matchs_comptes, now())
  on conflict (profile_id, game_id, season_id) do update set
    rating = excluded.rating,
    rd = excluded.rd,
    volatilite = excluded.volatilite,
    matchs_joues = ratings.matchs_joues + p_matchs_comptes,
    maj_le = now();

  return true;
end;
$$;

-- Décroissance mensuelle du RD par inactivité (docs/moteur-resultats.md §4
-- et §6). Le calcul (formule Glicko-2 "aucun match") est fait en TypeScript
-- (src/lib/glicko2.ts, mettreAJourJoueur avec une liste vide) — cette
-- fonction ne fait aucun calcul, elle écrit de façon atomique et
-- idempotente ce qu'on lui donne, exactement comme cloturer_rating_joueur.
-- Même règle de sécurité : aucun grant à authenticated, uniquement
-- service_role depuis le worker planifié.
create or replace function public.appliquer_decroissance_rd(
  p_profile_id uuid,
  p_game_id smallint,
  p_season_id uuid,
  p_rating numeric,
  p_rd_avant numeric,
  p_rd_apres numeric,
  p_volatilite numeric
)
returns boolean -- true si écrit, false si déjà appliqué aujourd'hui (idempotence)
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from rating_events
    where profile_id = p_profile_id
      and game_id = p_game_id
      and season_id = p_season_id
      and motif = 'inactivite'
      and cree_le >= now() - interval '1 day'
  ) then
    return false;
  end if;

  insert into rating_events (
    profile_id, game_id, season_id, tournament_id, match_id, motif,
    rating_avant, rd_avant, rating_apres, rd_apres, adversaire_id
  ) values (
    p_profile_id, p_game_id, p_season_id, null, null, 'inactivite',
    p_rating, p_rd_avant, p_rating, p_rd_apres, null
  );

  update ratings
  set rd = p_rd_apres, volatilite = p_volatilite, maj_le = now()
  where profile_id = p_profile_id and game_id = p_game_id and season_id = p_season_id;

  return true;
end;
$$;

-- Soft reset de saison (docs/moteur-resultats.md §4 "Changement de saison"
-- et §6 "Rotation de saison"). Le calcul (formule Glicko-2, 15% vers 1500,
-- RD × 1.8) est fait en TypeScript (src/lib/glicko2.ts, softResetSaison) —
-- ces fonctions ne calculent rien, elles écrivent de façon atomique et
-- idempotente ce qu'on leur donne, exactement comme cloturer_rating_joueur
-- et appliquer_decroissance_rd. Même frontière de sécurité : aucun grant à
-- authenticated, uniquement service_role depuis le worker planifié.

create or replace function public.appliquer_soft_reset_saison(
  p_profile_id uuid,
  p_game_id smallint,
  p_season_id uuid, -- la NOUVELLE saison que le joueur rejoint
  p_rating_avant numeric,
  p_rd_avant numeric,
  p_volatilite numeric,
  p_rating_apres numeric,
  p_rd_apres numeric
)
returns boolean -- true si écrit, false si déjà traité pour cette saison (idempotence)
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from rating_events
    where profile_id = p_profile_id
      and season_id = p_season_id
      and motif = 'soft_reset'
  ) then
    return false;
  end if;

  insert into rating_events (
    profile_id, game_id, season_id, tournament_id, match_id, motif,
    rating_avant, rd_avant, rating_apres, rd_apres, adversaire_id
  ) values (
    p_profile_id, p_game_id, p_season_id, null, null, 'soft_reset',
    p_rating_avant, p_rd_avant, p_rating_apres, p_rd_apres, null
  );

  insert into ratings (profile_id, game_id, season_id, rating, rd, volatilite, matchs_joues, maj_le)
  values (p_profile_id, p_game_id, p_season_id, p_rating_apres, p_rd_apres, p_volatilite, 0, now())
  on conflict (profile_id, game_id, season_id) do update set
    rating = excluded.rating,
    rd = excluded.rd,
    volatilite = excluded.volatilite,
    matchs_joues = 0,
    maj_le = now();

  return true;
end;
$$;

-- Bascule atomique du drapeau "saison courante" pour un jeu : évite qu'un
-- lecteur voie un instant sans aucune saison courante (ou deux à la fois)
-- pendant la rotation. Idempotent par nature (mettre un drapeau à sa
-- valeur déjà en place ne change rien).
create or replace function public.activer_saison(
  p_game_id smallint,
  p_nouvelle_saison_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update seasons set est_courante = false
  where game_id = p_game_id and est_courante = true and id != p_nouvelle_saison_id;

  update seasons set est_courante = true
  where id = p_nouvelle_saison_id;
end;
$$;

-- ---------- Anti-brute-force sur /connexion (audit du 2026-09-11) ----------
-- Journalise uniquement les tentatives de connexion échouées. Jamais
-- exposée au client (comme ratings/match_verdicts) : aucune policy RLS,
-- seul le service_role y écrit et y lit, depuis src/lib/auth-actions.ts.
-- Une policy ou un grant public ici permettrait à quiconque de lire les
-- e-mails ayant échoué à se connecter, ou de purger ses propres tentatives
-- pour contourner la limite.
create table login_attempts (
  id      bigint generated always as identity primary key,
  email   text not null,
  cree_le timestamptz not null default now()
);
create index login_attempts_email_cree_le_idx on login_attempts (email, cree_le);
alter table login_attempts enable row level security;

-- ---------- Notifications push web (audit du 2026-09-11, item 10) ----------
-- Complète les notifications e-mail (src/lib/notifications.ts) sur le
-- canal mobile. Un joueur peut avoir plusieurs abonnements (un par
-- appareil/navigateur).
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  cree_le     timestamptz not null default now()
);
create index push_subscriptions_profile_id_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

-- Un joueur gère uniquement SES PROPRES abonnements (créés depuis son
-- propre navigateur au moment de l'activation). La lecture croisée
-- (notifier un AUTRE joueur, ex. l'adversaire qui gagne un match) passe
-- exclusivement par le client service_role côté serveur — jamais par une
-- policy publique, même lecture seule, sinon n'importe qui pourrait lister
-- les abonnements push d'un autre joueur.
create policy "un joueur gere ses propres abonnements push"
  on push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
