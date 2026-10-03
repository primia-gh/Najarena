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
  role_prefere        text check (role_prefere in ('top','jungle','mid','adc','support')), -- renseigné par le joueur, utilisé par /lol/recherche (offre "organisateur")
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

-- Amorçage (migration amorcage_saison_1, 18/09/2026) : sans saison courante,
-- un tournoi n'a pas de season_id et sa clôture n'écrit jamais dans ratings.
-- Créée directement courante : le cron de rotation ne fait alors rien.
-- La saison suivante se crée à la main (aucun code ne crée de ligne seasons).
-- En commentaire ici : ce fichier ne sème pas `games` (id 1 = LoL), donc
-- l'insert échouerait sur une base vierge. À exécuter après ce semis :
--   insert into seasons (game_id, numero, nom, debut_le, fin_le, est_courante)
--   values (1, 1, 'Saison 1', '2026-09-18T00:00:00Z', '2026-12-18T00:00:00Z', true)
--   on conflict (game_id, numero) do nothing;

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
  capacite            smallint not null check (capacite in (4,8,16,32,64,128)), -- 128 = offre "organisateur"
  region              text not null,
  rating_min          int,
  rating_max          int,
  compte_pour_classement boolean not null default true,
  debute_le           timestamptz not null,
  checkin_ouvre_le    timestamptz not null,
  statut              tournament_status not null default 'brouillon',
  verrouille_le       timestamptz,              -- après 1er inscrit : règles figées
  cree_le             timestamptz not null default now(),
  logo_url            text,                     -- branding, offre "organisateur"
  couleur_accent      text
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

-- Stats détaillées par joueur et par match, capturées gratuitement au
-- moment du rapprochement niveau 2 (déjà présentes dans la réponse Riot
-- récupérée par trouverPartieCorrespondante, jamais lues jusqu'ici).
-- Alimente la revue de match écrite (offre Elite).
create table stats_match_joueur (
  match_id        uuid not null references matches(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  champion        text not null,
  kills           smallint not null,
  deaths          smallint not null,
  assists         smallint not null,
  cs              smallint not null,
  or_gagne        integer not null,
  duree_secondes  integer not null,
  gagne           boolean not null,
  cree_le         timestamptz not null default now(),
  primary key (match_id, profile_id)
);
alter table stats_match_joueur enable row level security;
create policy "stats de match lisibles par tous" on stats_match_joueur
  for select using (true);
-- Aucune policy insert/update : écrit uniquement par le worker de
-- rapprochement (service_role), même principe que match_verdicts.

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
  cree_le       timestamptz not null default now(),
  logo_url             text,                -- branding, offre Vérifié+
  couleur_accent       text,
  description          text check (char_length(description) <= 500),
  contact_recrutement  text
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

-- ---------- Offres payantes (Vérifié / Elite / Organisateur) ----------
-- Voir CLAUDE.md / docs — page /tarifs. Même principe que `admins` : table
-- séparée de profiles, jamais une colonne, pour la même raison (une
-- élévation de statut ne doit jamais passer par un chemin d'écriture
-- destiné aux données de profil). Absence de ligne = offre "gratuit".
-- Deux écrivains prévus, tous deux server_role, jamais le client :
-- attribution manuelle (attribuerOffreAdmin) et le futur webhook Stripe.
create table comptes_offres (
  profile_id     uuid primary key references profiles(id) on delete cascade,
  offre          text not null check (offre in ('verifie','elite','organisateur')),
  bio            text check (char_length(bio) <= 140),
  lien_externe   text,
  attribue_le    timestamptz not null default now(),
  attribue_par   uuid references profiles(id)
);
alter table comptes_offres enable row level security;

create policy "offre lisible par tous" on comptes_offres
  for select using (true);
-- Aucune policy insert/update/delete : écriture exclusivement via un
-- client service_role côté serveur.

-- ---------- "Qui a vu mon profil" (offre Vérifié+) ----------
-- RLS client réelle, sans risque d'élévation : un joueur ne peut
-- enregistrer une vue que pour lui-même comme visiteur, et ne peut lire
-- que la liste de SES propres visiteurs.
create table vues_profil (
  profile_id        uuid not null references profiles(id) on delete cascade,
  vu_par            uuid not null references profiles(id) on delete cascade,
  derniere_vue_le   timestamptz not null default now(),
  primary key (profile_id, vu_par),
  check (profile_id <> vu_par)
);
alter table vues_profil enable row level security;

create policy "le proprietaire voit ses visiteurs" on vues_profil
  for select using ((select auth.uid()) = profile_id);
create policy "un joueur enregistre sa propre visite" on vues_profil
  for insert with check ((select auth.uid()) = vu_par);
create policy "un joueur met a jour sa propre visite" on vues_profil
  for update using ((select auth.uid()) = vu_par);

-- ---------- Watchlist recruteur (offre "organisateur") ----------
-- RLS réelle : un recruteur ne gère que sa propre liste.
create table watchlist (
  recruteur_id     uuid not null references profiles(id) on delete cascade,
  joueur_suivi_id  uuid not null references profiles(id) on delete cascade,
  cree_le          timestamptz not null default now(),
  primary key (recruteur_id, joueur_suivi_id),
  check (recruteur_id <> joueur_suivi_id)
);
alter table watchlist enable row level security;
create policy "un recruteur gere sa propre watchlist" on watchlist
  for all using ((select auth.uid()) = recruteur_id) with check ((select auth.uid()) = recruteur_id);

-- ---------- Messagerie intégrée (initiation réservée à l'offre "organisateur") ----------
-- Répondre reste ouvert à tout participant — seule l'initiation d'une
-- conversation est filtrée par la policy insert ci-dessous.
create table conversations (
  id          uuid primary key default gen_random_uuid(),
  profile_a   uuid not null references profiles(id) on delete cascade,
  profile_b   uuid not null references profiles(id) on delete cascade,
  cree_le     timestamptz not null default now(),
  check (profile_a <> profile_b)
);
-- Une seule conversation par paire, quel que soit l'ordre a/b — une
-- contrainte unique classique ne porte pas sur une expression, il faut un
-- index unique fonctionnel.
create unique index conversations_paire_unique
  on conversations (least(profile_a, profile_b), greatest(profile_a, profile_b));

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  expediteur_id    uuid not null references profiles(id),
  contenu          text not null check (char_length(contenu) between 1 and 2000),
  envoye_le        timestamptz not null default now(),
  lu_le            timestamptz
);
alter table conversations enable row level security;
alter table messages      enable row level security;

create policy "participants lisent leur conversation" on conversations
  for select using ((select auth.uid()) in (profile_a, profile_b));
create policy "un organisateur demarre une conversation" on conversations
  for insert with check (
    profile_a = (select auth.uid())
    and exists (select 1 from comptes_offres where profile_id = (select auth.uid()) and offre = 'organisateur')
  );

create policy "participants lisent les messages" on messages
  for select using (exists (
    select 1 from conversations c where c.id = conversation_id
      and (select auth.uid()) in (c.profile_a, c.profile_b)
  ));
create policy "participants repondent" on messages
  for insert with check (
    expediteur_id = (select auth.uid())
    and exists (select 1 from conversations c where c.id = conversation_id
      and (select auth.uid()) in (c.profile_a, c.profile_b))
  );
-- Marquer un message comme lu — même périmètre que la lecture, aucun
-- risque de privilège (marqueur de lecture personnel).
create policy "participants marquent un message lu" on messages
  for update using (exists (
    select 1 from conversations c where c.id = conversation_id
      and (select auth.uid()) in (c.profile_a, c.profile_b)
  ));

-- ---------- Storage : logos de tournoi/équipe (branding, offre payante) ----------
-- Bucket public en lecture ; écriture restreinte au propriétaire du
-- fichier (`owner`, rempli automatiquement par Supabase Storage). Chemin
-- convention : logos/{type}/{id}.{ext}, pas utilisé par la policy elle-même.
insert into storage.buckets (id, name, public) values ('logos', 'logos', true);

create policy "logos lisibles par tous"
  on storage.objects for select using (bucket_id = 'logos');
create policy "un proprietaire ajoute son propre logo"
  on storage.objects for insert with check (bucket_id = 'logos' and owner = (select auth.uid()));
create policy "un proprietaire remplace son propre logo"
  on storage.objects for update using (bucket_id = 'logos' and owner = (select auth.uid()));
create policy "un proprietaire supprime son propre logo"
  on storage.objects for delete using (bucket_id = 'logos' and owner = (select auth.uid()));

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

-- ---------- CORRECTIF DE SÉCURITÉ CRITIQUE (2026-09-12) ----------
-- Trouvé via l'advisor de sécurité Supabase (jamais consulté avant cette
-- date malgré sa disponibilité — à exécuter régulièrement après toute
-- migration, cf. mémoire du projet).
--
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut sur toute fonction créée
-- sans REVOKE explicite. Aucune migration précédente ne faisait ce REVOKE :
-- les six fonctions ci-dessous, dont la sécurité repose ENTIÈREMENT sur
-- l'absence de grant (aucune vérification auth.uid() interne — voir les
-- commentaires sur cloturer_rating_joueur plus haut, CLAUDE.md §6.1),
-- étaient en réalité exécutables par N'IMPORTE QUI, authentifié ou non,
-- via /rest/v1/rpc/<nom> avec la seule clé anon publique.
--
-- avancer_vainqueur était le cas le plus grave : aucune vérification
-- d'aucune sorte, n'importe qui pouvait déclarer vainqueur n'importe quel
-- match. Vérifié par exploitation réelle (inoffensive, match_id bidon)
-- avant correction, puis reconfirmé bloqué après (permission denied).
revoke execute on function public.cloturer_rating_joueur from public, anon, authenticated;
revoke execute on function public.enregistrer_verdict_historique from public, anon, authenticated;
revoke execute on function public.appliquer_decroissance_rd from public, anon, authenticated;
revoke execute on function public.appliquer_soft_reset_saison from public, anon, authenticated;
revoke execute on function public.activer_saison from public, anon, authenticated;
revoke execute on function public.avancer_vainqueur from public, anon, authenticated;

-- Défense en profondeur : ces quatre fonctions ont leurs propres
-- vérifications internes (organisateur, propriétaire du compte Riot) ou
-- sont des déclencheurs qui ne peuvent de toute façon pas s'exécuter en
-- appel direct — mais retirer la surface d'appel inutile ne coûte rien.
-- enregistrer_verdict_manuel et lier_compte_riot gardent leur grant
-- `authenticated` : ce sont les seules fonctions de cette liste appelées
-- directement par l'app depuis un compte utilisateur normal.
revoke execute on function public.enregistrer_verdict_manuel from public, anon;
revoke execute on function public.lier_compte_riot from public, anon;
revoke execute on function public.handle_new_user from public, anon, authenticated;
revoke execute on function public.verrouiller_tournoi_si_premier_inscrit from public, anon, authenticated;

-- ---------- Optimisations de performance (advisor Supabase, 2026-09-12) ----------
-- Sans impact sur la sécurité — appliquées à la suite du correctif
-- critique ci-dessus, en profitant d'être déjà dans les policies.

-- `auth.uid()` appelé nu dans une policy RLS est réévalué à CHAQUE ligne.
-- L'envelopper dans `(select auth.uid())` permet au planificateur de ne
-- l'évaluer qu'une fois par requête (InitPlan) — même résultat, juste plus
-- rapide à l'échelle. Chaque condition ci-dessous est rigoureusement
-- identique à l'originale (vérifiée via pg_policies avant d'écrire ce
-- correctif), seul l'appel à auth.uid() change. Revérifié en réel de bout
-- en bout après coup (création de tournoi, inscription, confirmation,
-- bracket, verdict manuel, litige ouvert et résolu) avec un compte de
-- test : rien de cassé.
alter policy "verifier son propre statut admin" on admins
  using (profile_id = (select auth.uid()));
alter policy "admin resout tous les litiges" on disputes
  using (exists (select 1 from admins where admins.profile_id = (select auth.uid())));
alter policy "admin voit tous les litiges" on disputes
  using (exists (select 1 from admins where admins.profile_id = (select auth.uid())));
alter policy "litige visible par les concernes" on disputes
  using (
    (ouvert_par = (select auth.uid()))
    or exists (select 1 from match_participants mp where mp.match_id = disputes.match_id and mp.profile_id = (select auth.uid()))
    or exists (select 1 from matches m join tournaments t on t.id = m.tournament_id where m.id = disputes.match_id and t.organisateur_id = (select auth.uid()))
  );
alter policy "organisateur resout le litige" on disputes
  using (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id where m.id = disputes.match_id and t.organisateur_id = (select auth.uid())));
alter policy "un participant ouvre un litige" on disputes
  with check (
    (ouvert_par = (select auth.uid()))
    and exists (select 1 from match_participants mp where mp.match_id = disputes.match_id and mp.profile_id = (select auth.uid()))
  );
alter policy "organisateur gere les participants" on match_participants
  with check (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id where m.id = match_participants.match_id and t.organisateur_id = (select auth.uid())));
alter policy "organisateur modifie les participants" on match_participants
  using (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id where m.id = match_participants.match_id and t.organisateur_id = (select auth.uid())));
alter policy "organisateur gere les matchs de son tournoi" on matches
  with check (exists (select 1 from tournaments t where t.id = matches.tournament_id and t.organisateur_id = (select auth.uid())));
alter policy "organisateur modifie les matchs de son tournoi" on matches
  using (exists (select 1 from tournaments t where t.id = matches.tournament_id and t.organisateur_id = (select auth.uid())));
alter policy "profil modifiable par son proprietaire" on profiles
  using ((select auth.uid()) = id);
alter policy "un joueur gere ses propres abonnements push" on push_subscriptions
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
alter policy "joueur ou organisateur modifie l inscription" on registrations
  using (
    (profile_id = (select auth.uid()))
    or exists (select 1 from tournaments t where t.id = registrations.tournament_id and t.organisateur_id = (select auth.uid()))
  );
alter policy "joueur s inscrit lui meme" on registrations
  with check (profile_id = (select auth.uid()));
alter policy "capitaine invite un membre" on team_members
  with check (exists (select 1 from teams tm where tm.id = team_members.team_id and tm.capitaine_id = (select auth.uid())));
alter policy "membre accepte ou capitaine gere" on team_members
  using (
    (profile_id = (select auth.uid()))
    or exists (select 1 from teams tm where tm.id = team_members.team_id and tm.capitaine_id = (select auth.uid()))
  );
alter policy "membre quitte ou capitaine retire" on team_members
  using (
    (profile_id = (select auth.uid()))
    or exists (select 1 from teams tm where tm.id = team_members.team_id and tm.capitaine_id = (select auth.uid()))
  );
alter policy "capitaine cree son equipe" on teams
  with check (capitaine_id = (select auth.uid()));
alter policy "capitaine modifie son equipe" on teams
  using (capitaine_id = (select auth.uid()));
alter policy "organisateur cree son tournoi" on tournaments
  with check (organisateur_id = (select auth.uid()));
alter policy "organisateur modifie son tournoi" on tournaments
  using (organisateur_id = (select auth.uid()));

-- Index manquants sur des clés étrangères (ralentit les JOIN et les
-- suppressions en cascade à l'échelle). Pur ajout, aucun changement de
-- comportement.
create index if not exists disputes_match_id_idx on disputes (match_id);
create index if not exists disputes_ouvert_par_idx on disputes (ouvert_par);
create index if not exists disputes_resolu_par_idx on disputes (resolu_par);
create index if not exists match_participants_profile_id_idx on match_participants (profile_id);
create index if not exists match_verdicts_decide_par_idx on match_verdicts (decide_par);
create index if not exists match_verdicts_gagnant_id_idx on match_verdicts (gagnant_id);
create index if not exists matches_match_suivant_id_idx on matches (match_suivant_id);
create index if not exists rating_events_adversaire_id_idx on rating_events (adversaire_id);
create index if not exists rating_events_game_id_idx on rating_events (game_id);
create index if not exists rating_events_match_id_idx on rating_events (match_id);
create index if not exists rating_events_season_id_idx on rating_events (season_id);
create index if not exists ratings_season_id_idx on ratings (season_id);
create index if not exists registrations_profile_id_idx on registrations (profile_id);
create index if not exists team_members_profile_id_idx on team_members (profile_id);
create index if not exists teams_capitaine_id_idx on teams (capitaine_id);
create index if not exists teams_game_id_idx on teams (game_id);
create index if not exists tiers_game_id_idx on tiers (game_id);
create index if not exists tournaments_organisateur_id_idx on tournaments (organisateur_id);
create index if not exists tournaments_season_id_idx on tournaments (season_id);

-- ---------- Temps réel (2026-09-12) ----------
-- Bracket/match/inscriptions/litiges vivaient uniquement en rechargement de
-- page. Ajout à la publication `supabase_realtime` — la lecture des
-- événements reste filtrée par les policies SELECT déjà en place ci-dessus
-- (publiques pour matches/match_participants/match_verdicts/registrations,
-- restreinte aux concernés + admin pour disputes), donc aucune nouvelle
-- policy n'est nécessaire pour ce changement.
alter publication supabase_realtime add table
  matches, match_participants, match_verdicts, registrations, disputes;

-- ---------- Recherche de coéquipiers (2026-09-12) ----------
-- Dernier point de la demande "matchmaking" du 12/09 — un joueur s'annonce
-- disponible pour rejoindre une équipe, visible de tous (comme les
-- inscriptions/équipes). Auto-gérée : chaque joueur ne touche que sa
-- propre ligne (`for all`, comme push_subscriptions), une seule annonce
-- possible par joueur (profile_id en clé primaire — republier revient à
-- mettre à jour la même ligne, pas à en empiler une nouvelle).
create table recherches_coequipiers (
  profile_id  uuid primary key references profiles(id) on delete cascade,
  message     text check (char_length(message) <= 200),
  cree_le     timestamptz not null default now()
);

alter table recherches_coequipiers enable row level security;

create policy "annonces lisibles par tous"
  on recherches_coequipiers for select using (true);

create policy "un joueur gere sa propre annonce"
  on recherches_coequipiers for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---------- Discord : capture de l'identifiant à l'inscription (2026-09-12) ----------
-- handle_new_user (§1) republié en entier : `create or replace function`
-- ne réécrit pas la fonction par petits bouts. Ajoute uniquement la
-- capture de discord_id pour un compte créé via l'OAuth Discord — colonne
-- déjà présente dans le schéma (§1) mais jamais écrite faute d'intégration
-- Discord réelle jusqu'ici. Ne sert PAS à choisir le pseudo par défaut :
-- le nom d'affichage Discord n'est pas unique (contrainte `pseudo unique`
-- ci-dessus), l'utiliser directement ferait échouer toute la création de
-- compte au premier doublon de nom.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pseudo text;
  v_slug text;
  v_discord_id text;
begin
  v_pseudo := new.raw_user_meta_data->>'pseudo';
  v_slug := new.raw_user_meta_data->>'slug';

  if v_pseudo is null or v_slug is null then
    v_pseudo := 'Joueur-' || substr(new.id::text, 1, 8);
    v_slug := lower(v_pseudo);
  end if;

  if new.raw_app_meta_data->>'provider' = 'discord' then
    v_discord_id := coalesce(
      new.raw_user_meta_data->>'provider_id',
      new.raw_user_meta_data->>'sub'
    );
  end if;

  insert into public.profiles (id, pseudo, slug, discord_id)
  values (new.id, v_pseudo, v_slug, v_discord_id);
  return new;
end;
$$;

-- Non corrigé délibérément : l'advisor signale aussi des policies
-- permissives redondantes sur `disputes` (admin + participant/organisateur
-- se chevauchent pour SELECT/UPDATE) et un index `ratings` non encore
-- utilisé (normal, aucun vrai trafic de classement pour l'instant, pas une
-- raison de le supprimer). Fusionner les policies redondantes réduirait la
-- lisibilité pour un gain de performance nul à l'échelle actuelle — à
-- reconsidérer si le site a un jour un vrai volume de trafic.

-- ---------- Tournois automatiques (2026-09-24) ----------
-- Tournoi quotidien créé, lancé ou annulé par la tâche planifiée
-- /api/cron/tournois-auto (src/lib/tournois-auto/). creneau_auto = clé du
-- créneau (src/lib/tournois-auto/creneaux.ts) ; nul pour un tournoi créé
-- par un organisateur.
alter table public.tournaments add column creneau_auto text;

-- Un seul tournoi par créneau et par heure de début, même si l'adresse
-- (slug) changeait un jour.
create unique index tournaments_creneau_auto_debut_key
  on public.tournaments (creneau_auto, debute_le)
  where creneau_auto is not null;

-- Rappels déjà envoyés : la tâche réserve la ligne avant d'envoyer, un
-- joueur ne reçoit jamais deux fois le même rappel (CLAUDE.md §6.4).
create table public.rappels_tournoi (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  type          text not null check (type in ('annonce', 'checkin_ouvert', 'dernier_appel')),
  envoye_le     timestamptz not null default now(),
  primary key (tournament_id, type)
);

-- Aucune policy : lue et écrite uniquement par le serveur (service_role).
alter table public.rappels_tournoi enable row level security;

-- Bye d'un tournoi automatique, enregistré au démarrage par la tâche
-- planifiée. Pendant d'enregistrer_verdict_manuel, qui exige un
-- organisateur connecté (auth.uid()) — ici personne n'est connecté.
-- Réservée au service_role, et ne sait faire QU'UN bye : elle revérifie
-- elle-même qu'il n'y a qu'un joueur dans le match et qu'aucun adversaire
-- ne peut encore arriver (bug #2 de src/lib/bracket.ts, revérifié côté
-- base). Verdict de niveau 1 (manuel), jamais compté au classement.
create or replace function public.enregistrer_bye_automatique(p_match_id uuid, p_gagnant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creneau text;
begin
  select t.creneau_auto
  into v_creneau
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if not found then
    raise exception 'MATCH_INTROUVABLE';
  end if;

  if v_creneau is null then
    raise exception 'TOURNOI_NON_AUTOMATIQUE';
  end if;

  -- Déjà résolu (relance de la tâche) : rien à refaire.
  if exists (select 1 from public.match_verdicts where match_id = p_match_id) then
    return;
  end if;

  if (select count(*) from public.match_participants where match_id = p_match_id) <> 1
     or not exists (
       select 1 from public.match_participants
       where match_id = p_match_id and profile_id = p_gagnant_id
     ) then
    raise exception 'PAS_UN_BYE';
  end if;

  if exists (
    select 1
    from public.matches precedent
    where precedent.match_suivant_id = p_match_id
      and precedent.statut <> 'termine'
      and exists (select 1 from public.match_participants p where p.match_id = precedent.id)
  ) then
    raise exception 'ADVERSAIRE_ATTENDU';
  end if;

  insert into public.match_verdicts (match_id, niveau, gagnant_id, decide_par, motif, est_definitif)
  values (
    p_match_id,
    'manuel',
    p_gagnant_id,
    null,
    'Bye — moins d''inscrits confirmés que de places dans le bracket.',
    true
  );

  perform public.avancer_vainqueur(p_match_id, p_gagnant_id);
end;
$$;

revoke all on function public.enregistrer_bye_automatique(uuid, uuid) from public, anon, authenticated;
grant execute on function public.enregistrer_bye_automatique(uuid, uuid) to service_role;

-- ---------- Tâches planifiées dans la base (2026-09-24) ----------
-- À appliquer APRÈS le déploiement du code des tournois automatiques.
-- Le plan gratuit de Vercel limite ses tâches planifiées à une par jour
-- (vercel.json). pg_cron (planificateur intégré à Postgres, gratuit sur
-- Supabase) appelle donc ces deux routes toutes les 5 minutes, via pg_net
-- (requêtes HTTP depuis la base) :
-- - /api/cron/tournois-auto : création, check-in, rappels, démarrage ;
-- - /api/cron/recherche-resultats : rapprochement niveau 2, sans lequel
--   un tournoi du soir n'avancerait qu'une fois par jour.
-- Le secret CRON_SECRET n'est jamais écrit ici ni dans Git : il est rangé
-- dans le coffre-fort chiffré de Supabase (Vault) par le porteur du
-- projet lui-même, depuis l'éditeur SQL de Supabase :
--   select vault.create_secret('<valeur de CRON_SECRET sur Vercel>', 'najarena_cron_secret');
-- Sans ce secret, les appels partent avec une autorisation vide et sont
-- simplement refusés (401), sans effet.
-- [supabase-uniquement:debut] (pg_cron, pg_net et Vault n'existent que sur
-- Supabase : scripts/tester-base.sh saute ce bloc sur une base de test)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'najarena-tournois-auto',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://najarena.vercel.app/api/cron/tournois-auto',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'najarena_cron_secret'), '')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

select cron.schedule(
  'najarena-recherche-resultats',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://najarena.vercel.app/api/cron/recherche-resultats',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'najarena_cron_secret'), '')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
-- [supabase-uniquement:fin]

-- ---------- Liaison Riot réservée au serveur (2026-09-28, audit C2) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit :
-- src/lib/riot-actions.ts appelle la nouvelle signature (p_profile_id).
-- lier_compte_riot était appelable directement par tout compte connecté,
-- avec des paramètres choisis par lui : puuid visé, nom affiché ET icône-
-- défi. En indiquant l'icône que la victime porte déjà, verifierRiotId
-- (src/lib/riot-actions.ts) confirmait un compte Riot qui n'était pas le
-- sien, sans aucun changement en jeu ; le nom affiché pouvait aussi être
-- faux. Désormais :
-- - la fonction n'est plus appelable que par le service_role, depuis le
--   serveur Next.js, avec le puuid et le Riot ID renvoyés par l'API Riot
--   et une icône-défi tirée par le serveur (toujours différente de
--   l'icône portée au moment de la liaison) ;
-- - le profil est un paramètre (auth.uid() est vide pour le service_role),
--   fourni par le serveur après lecture de la session ;
-- - un seul compte principal par joueur et par jeu : le profil public et
--   le rapprochement niveau 2 lisent ce compte-là (plusieurs comptes
--   « principaux » cassaient l'affichage du profil et rendaient le
--   rapprochement aléatoire).
drop function if exists public.lier_compte_riot(smallint, text, text, text, text, smallint);

-- Données existantes : un joueur qui a lié plusieurs comptes garde comme
-- principal le plus récemment vérifié (à défaut, le dernier lié).
with classes as (
  select id,
         row_number() over (
           partition by profile_id, game_id
           order by verifie_le desc nulls last, derniere_sync_le desc nulls last, id
         ) as rang
  from public.game_accounts
  where est_principal
)
update public.game_accounts g
set est_principal = false
from classes c
where g.id = c.id and c.rang > 1;

create unique index if not exists game_accounts_un_principal_par_jeu
  on public.game_accounts (profile_id, game_id)
  where est_principal;

create or replace function public.lier_compte_riot(
  p_profile_id uuid,
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
begin
  -- Le nouveau compte devient le principal : les autres comptes de ce
  -- joueur pour ce jeu cessent de l'être (annulé avec le reste si la
  -- liaison échoue plus bas).
  update public.game_accounts
  set est_principal = false
  where profile_id = p_profile_id
    and game_id = p_game_id
    and puuid <> p_puuid
    and est_principal;

  insert into public.game_accounts (
    profile_id, game_id, puuid, riot_game_name, riot_tag_line, region,
    est_principal, defi_icone_id, methode_verification
  )
  values (
    p_profile_id, p_game_id, p_puuid, p_riot_game_name, p_riot_tag_line, p_region,
    true, p_defi_icone_id, 'icone_profil'
  )
  on conflict (game_id, puuid) do update set
    riot_game_name = excluded.riot_game_name,
    riot_tag_line = excluded.riot_tag_line,
    region = excluded.region,
    est_principal = true,
    defi_icone_id = excluded.defi_icone_id,
    methode_verification = 'icone_profil',
    verifie_le = null
  -- Compte déjà lié à un autre profil : aucune ligne touchée, refus.
  -- Vérifié dans la même instruction que l'écriture : deux liaisons
  -- simultanées du même compte ne peuvent pas passer toutes les deux.
  where public.game_accounts.profile_id = p_profile_id;

  if not found then
    raise exception 'RIOT_ACCOUNT_TAKEN';
  end if;
end;
$$;

revoke execute on function public.lier_compte_riot(uuid, smallint, text, text, text, text, smallint) from public, anon, authenticated;
grant execute on function public.lier_compte_riot(uuid, smallint, text, text, text, text, smallint) to service_role;

-- ---------- Règles appliquées par la base, plus seulement par les pages (2026-09-28, audit E1, M1 à M4) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit :
-- inscription et check-in appellent s_inscrire_tournoi et confirmer_presence.
-- Le navigateur de chaque visiteur connaît l'adresse de la base et sa clé
-- publique : toute règle vérifiée seulement dans une action du site
-- (src/lib/*-actions.ts) peut être contournée par un appel direct. Les
-- règles ci-dessous passent donc dans la base elle-même.
--
-- Principe des déclencheurs de contrôle : ils ne s'appliquent qu'aux
-- écritures directes d'un compte connecté (current_user = 'authenticated').
-- Le serveur (service_role) et les fonctions security definer (qui
-- s'exécutent sous leur propriétaire) n'y sont pas soumis — ce sont déjà
-- des chemins contrôlés. Ces fonctions de déclencheur ne doivent donc
-- JAMAIS être déclarées security definer : current_user y deviendrait le
-- propriétaire et le contrôle ne s'appliquerait plus à personne.

-- ===== 1. Inscriptions et check-in (E1) =====
-- Avant : un joueur pouvait créer son inscription à n'importe quel tournoi
-- (fermé, plein, commencé), se confirmer hors check-in, et modifier toutes
-- les colonnes de son inscription (tête de série, rating à l'inscription,
-- tournoi). Deux inscriptions simultanées pouvaient dépasser la capacité.
drop policy "joueur s inscrit lui meme" on public.registrations;
drop policy "joueur ou organisateur modifie l inscription" on public.registrations;

-- L'organisateur garde la main sur le statut (confirmer, marquer absent)
-- depuis son cockpit — et sur rien d'autre (droits par colonne ci-dessous).
create policy "organisateur modifie l inscription"
  on public.registrations for update using (
    exists (
      select 1 from public.tournaments t
      where t.id = registrations.tournament_id
        and t.organisateur_id = (select auth.uid())
    )
  );

revoke insert, update, delete on public.registrations from anon, authenticated;
grant update (statut, confirme_le) on public.registrations to authenticated;

-- Seule porte d'entrée pour s'inscrire : tout est vérifié en une opération,
-- sous verrou de la ligne du tournoi (deux inscriptions simultanées ne
-- peuvent plus dépasser la capacité).
create or replace function public.s_inscrire_tournoi(p_tournament_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_tournoi record;
  v_inscrits int;
  v_rating int;
  v_id uuid;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select id, statut, capacite, game_id, season_id
  into v_tournoi
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;

  if v_tournoi.statut <> 'ouvert' then
    raise exception 'INSCRIPTIONS_FERMEES';
  end if;

  if exists (
    select 1 from public.registrations
    where tournament_id = p_tournament_id and profile_id = v_joueur
  ) then
    raise exception 'DEJA_INSCRIT';
  end if;

  select count(*) into v_inscrits
  from public.registrations
  where tournament_id = p_tournament_id and statut <> 'retire';

  if v_inscrits >= v_tournoi.capacite then
    raise exception 'TOURNOI_COMPLET';
  end if;

  -- « Rating à l'inscription » : preuve du niveau au moment T, prévue dès
  -- le schéma V1 mais jamais remplie jusqu'ici. Nul pour un joueur sans
  -- rating cette saison.
  select round(r.rating)::int
  into v_rating
  from public.ratings r
  where r.profile_id = v_joueur
    and r.game_id = v_tournoi.game_id
    and r.season_id = coalesce(
      v_tournoi.season_id,
      (select s.id from public.seasons s where s.game_id = v_tournoi.game_id and s.est_courante limit 1)
    );

  insert into public.registrations (tournament_id, profile_id, rating_a_inscription)
  values (p_tournament_id, v_joueur, v_rating)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.s_inscrire_tournoi(uuid) from public, anon;
grant execute on function public.s_inscrire_tournoi(uuid) to authenticated;

-- Check-in par le joueur, seulement dans la fenêtre prévue (même règle que
-- src/lib/checkin.ts). Le verrou partagé sur le tournoi empêche un check-in
-- de se glisser pendant le démarrage du bracket : soit il est enregistré
-- avant que la liste des confirmés soit lue, soit il est refusé.
create or replace function public.confirmer_presence(p_tournament_id uuid)
returns boolean -- faux : aucune inscription en attente de check-in
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_statut public.tournament_status;
  v_checkin timestamptz;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select statut, checkin_ouvre_le
  into v_statut, v_checkin
  from public.tournaments
  where id = p_tournament_id
  for share;

  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;

  if not (v_statut = 'checkin' or (v_statut = 'ouvert' and v_checkin <= now())) then
    raise exception 'CHECKIN_FERME';
  end if;

  update public.registrations
  set statut = 'confirme', confirme_le = now()
  where tournament_id = p_tournament_id
    and profile_id = v_joueur
    and statut = 'inscrit';

  return found;
end;
$$;

revoke execute on function public.confirmer_presence(uuid) from public, anon;
grant execute on function public.confirmer_presence(uuid) to authenticated;

-- ===== 2. Tournois (M3) =====
-- Avant : l'organisateur pouvait modifier toutes les colonnes de son
-- tournoi par appel direct — 128 places, Best-of 3/5, logo et couleur sans
-- l'offre Organisateur ; format, capacité et dates après la première
-- inscription ; statut « terminé » avant la fin (plus aucun point écrit).
create or replace function public.controler_ecriture_tournoi()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_organisateur_premium boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  select exists (
    select 1 from public.comptes_offres
    where profile_id = auth.uid() and offre = 'organisateur'
  ) into v_organisateur_premium;

  if tg_op = 'INSERT' then
    if new.statut not in ('brouillon', 'ouvert') then
      raise exception 'STATUT_INITIAL_INVALIDE';
    end if;
    if new.creneau_auto is not null or new.verrouille_le is not null then
      raise exception 'CHAMP_RESERVE';
    end if;
    if (new.capacite = 128 or new.best_of > 1 or new.logo_url is not null or new.couleur_accent is not null)
       and not v_organisateur_premium then
      raise exception 'OFFRE_ORGANISATEUR_REQUISE';
    end if;
    return new;
  end if;

  -- Réglages figés après la création (aucun écran ne les modifie ; le
  -- serveur, lui, n'est pas concerné — ex. capacité ajustée au démarrage
  -- d'un tournoi automatique).
  if (new.game_id, new.season_id, new.organisateur_id, new.slug, new.nom, new.format,
      new.type_bracket, new.best_of, new.capacite, new.region, new.rating_min,
      new.rating_max, new.compte_pour_classement, new.debute_le, new.checkin_ouvre_le,
      new.verrouille_le, new.cree_le, new.creneau_auto)
     is distinct from
     (old.game_id, old.season_id, old.organisateur_id, old.slug, old.nom, old.format,
      old.type_bracket, old.best_of, old.capacite, old.region, old.rating_min,
      old.rating_max, old.compte_pour_classement, old.debute_le, old.checkin_ouvre_le,
      old.verrouille_le, old.cree_le, old.creneau_auto) then
    raise exception 'CHAMP_NON_MODIFIABLE';
  end if;

  -- « Terminé » n'est écrit que par la clôture (serveur), une fois les
  -- points de chaque joueur enregistrés.
  if new.statut is distinct from old.statut and not (
       (old.statut = 'brouillon' and new.statut = 'ouvert')
    or (old.statut = 'ouvert' and new.statut = 'checkin')
    or (old.statut in ('ouvert', 'checkin') and new.statut = 'en_cours')
    or (old.statut in ('brouillon', 'ouvert', 'checkin') and new.statut = 'annule')
  ) then
    raise exception 'CHANGEMENT_DE_STATUT_INTERDIT';
  end if;

  if ((new.logo_url is not null and new.logo_url is distinct from old.logo_url)
      or (new.couleur_accent is not null and new.couleur_accent is distinct from old.couleur_accent))
     and not v_organisateur_premium then
    raise exception 'OFFRE_ORGANISATEUR_REQUISE';
  end if;

  return new;
end;
$$;

revoke execute on function public.controler_ecriture_tournoi() from public, anon, authenticated;

create trigger controle_ecriture_tournoi
  before insert or update on public.tournaments
  for each row execute function public.controler_ecriture_tournoi();

-- ===== 3. Matchs et participants (M3) =====
-- Avant : l'organisateur pouvait avancer l'heure de début d'un match (et
-- faire retenir une ancienne partie entre les deux joueurs comme résultat
-- officiel), déclarer lui-même un gagnant sans verdict, ou placer dans le
-- bracket un joueur jamais inscrit. Il garde ce dont la génération du
-- bracket a besoin (src/lib/bracket-construction.ts) : créer les matchs
-- vides, placer au tour 1 les joueurs confirmés, lancer un match à l'heure
-- présente.
create or replace function public.controler_ecriture_match()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.statut <> 'en_attente' or new.demarre_le is not null or new.code_tournoi is not null then
      raise exception 'CHAMP_RESERVE';
    end if;
    return new;
  end if;

  if (new.tournament_id, new.tour, new.position, new.match_suivant_id, new.code_tournoi)
     is distinct from
     (old.tournament_id, old.tour, old.position, old.match_suivant_id, old.code_tournoi) then
    raise exception 'CHAMP_NON_MODIFIABLE';
  end if;

  if new.statut is distinct from old.statut
     and not (old.statut = 'en_attente' and new.statut = 'en_cours') then
    raise exception 'CHANGEMENT_DE_STATUT_INTERDIT';
  end if;

  -- L'heure de début ouvre la fenêtre de recherche de la partie Riot : elle
  -- ne peut être que « maintenant », et une seule fois.
  if new.demarre_le is distinct from old.demarre_le and not (
       old.demarre_le is null
       and new.demarre_le between now() - interval '2 minutes' and now() + interval '2 minutes'
  ) then
    raise exception 'HEURE_DE_DEBUT_RESERVEE';
  end if;

  return new;
end;
$$;

revoke execute on function public.controler_ecriture_match() from public, anon, authenticated;

create trigger controle_ecriture_match
  before insert or update on public.matches
  for each row execute function public.controler_ecriture_match();

-- Vainqueur et score ne s'écrivent que par un verdict (fonctions security
-- definer) : plus aucune modification directe.
drop policy "organisateur modifie les participants" on public.match_participants;
revoke update, delete on public.match_participants from anon, authenticated;

create or replace function public.controler_placement_joueur()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tournoi uuid;
  v_tour smallint;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  select tournament_id, tour into v_tournoi, v_tour
  from public.matches
  where id = new.match_id;

  if v_tour <> 1 or new.est_gagnant is not null or new.score <> 0 then
    raise exception 'CHAMP_RESERVE';
  end if;

  if not exists (
    select 1 from public.registrations
    where tournament_id = v_tournoi and profile_id = new.profile_id and statut = 'confirme'
  ) then
    raise exception 'JOUEUR_NON_CONFIRME';
  end if;

  if (select count(*) from public.match_participants where match_id = new.match_id) >= 2 then
    raise exception 'MATCH_COMPLET';
  end if;

  if exists (
    select 1
    from public.match_participants mp
    join public.matches m on m.id = mp.match_id
    where m.tournament_id = v_tournoi and mp.profile_id = new.profile_id
  ) then
    raise exception 'JOUEUR_DEJA_PLACE';
  end if;

  return new;
end;
$$;

revoke execute on function public.controler_placement_joueur() from public, anon, authenticated;

create trigger controle_placement_joueur
  before insert on public.match_participants
  for each row execute function public.controler_placement_joueur();

-- ===== 4. Équipes (M1, M3) =====
-- Avant : un capitaine pouvait inscrire quelqu'un comme membre « accepté »
-- sans son accord ; un invité pouvait déplacer sa ligne vers une autre
-- équipe et s'y déclarer accepté ; aucune limite d'effectif dans la base ;
-- logo et couleur d'équipe modifiables sans l'offre Vérifié.
create or replace function public.controler_membre_equipe()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_capitaine uuid;
  v_effectif int;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'UPDATE' and (new.team_id, new.profile_id) is distinct from (old.team_id, old.profile_id) then
    raise exception 'CHAMP_NON_MODIFIABLE';
  end if;

  select capitaine_id into v_capitaine from public.teams where id = new.team_id;

  if tg_op = 'UPDATE' and new.role is distinct from old.role and v_capitaine <> auth.uid() then
    raise exception 'ROLE_FIXE_PAR_LE_CAPITAINE';
  end if;

  -- Une acceptation n'est faite que par le joueur concerné (le capitaine
  -- s'ajoute lui-même, déjà accepté, à la création de l'équipe).
  if new.accepte_le is not null and (tg_op = 'INSERT' or old.accepte_le is null) then
    if new.profile_id <> auth.uid() then
      raise exception 'ACCEPTATION_PAR_LE_JOUEUR';
    end if;

    -- 5 joueurs maximum : même limite que TAILLE_MAX_EQUIPE (src/lib/equipe.ts).
    select count(*) into v_effectif
    from public.team_members
    where team_id = new.team_id and accepte_le is not null;

    if v_effectif >= 5 then
      raise exception 'EQUIPE_COMPLETE';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.controler_membre_equipe() from public, anon, authenticated;

create trigger controle_membre_equipe
  before insert or update on public.team_members
  for each row execute function public.controler_membre_equipe();

create or replace function public.controler_ecriture_equipe()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'UPDATE' and (new.game_id, new.slug, new.nom, new.tag, new.capitaine_id, new.cree_le)
     is distinct from (old.game_id, old.slug, old.nom, old.tag, old.capitaine_id, old.cree_le) then
    raise exception 'CHAMP_NON_MODIFIABLE';
  end if;

  if ((new.logo_url is not null and (tg_op = 'INSERT' or new.logo_url is distinct from old.logo_url))
      or (new.couleur_accent is not null and (tg_op = 'INSERT' or new.couleur_accent is distinct from old.couleur_accent)))
     and not exists (
       select 1 from public.comptes_offres
       where profile_id = auth.uid() and offre in ('verifie', 'elite', 'organisateur')
     ) then
    raise exception 'OFFRE_VERIFIE_REQUISE';
  end if;

  return new;
end;
$$;

revoke execute on function public.controler_ecriture_equipe() from public, anon, authenticated;

create trigger controle_ecriture_equipe
  before insert or update on public.teams
  for each row execute function public.controler_ecriture_equipe();

-- ===== 5. Messagerie (M2) =====
-- Avant : la règle prévue pour « marquer comme lu » permettait de réécrire
-- toute la ligne, contenu et expéditeur compris, y compris les messages de
-- l'autre personne.
drop policy "participants marquent un message lu" on public.messages;

create policy "le destinataire marque un message lu"
  on public.messages for update using (
    expediteur_id <> (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.profile_a, c.profile_b)
    )
  );

revoke update, delete on public.messages from anon, authenticated;
grant update (lu_le) on public.messages to authenticated;

-- ===== 6. Profils (M4) =====
-- Avant : discord_id (identifiant Discord, lisible par tous) et slug
-- (adresse publique du CV) étaient modifiables par leur propriétaire. Aucun
-- écran ne modifie un profil aujourd'hui ; une future page « Mon profil »
-- passera par une action serveur qui ne touchera que le pseudo, le pays et
-- l'avatar.
revoke update, delete on public.profiles from anon, authenticated;

-- L'identifiant Discord ne sert qu'au serveur (messages privés du bot) :
-- il n'est plus lisible par le public.
revoke select on public.profiles from anon, authenticated;
grant select (id, pseudo, slug, avatar_url, pays, created_at) on public.profiles to anon, authenticated;

-- ===== 7. Litiges =====
-- L'organisateur (ou un admin) écrit la résolution — il ne peut plus
-- réécrire le motif rédigé par le joueur.
revoke update, delete on public.disputes from anon, authenticated;
grant update (resolution, resolu_par, resolu_le) on public.disputes to authenticated;

-- ---------- Compte Riot vérifié exigé pour s'inscrire (2026-09-28, audit E2) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (messages d'erreur COMPTE_RIOT_REQUIS / REGION_DIFFERENTE).
-- La lecture automatique d'un résultat (niveau 2) a besoin du compte Riot
-- vérifié des deux joueurs, dans la même région. Un joueur inscrit sans ce
-- compte envoyait chacun de ses matchs en litige, puis en verdict manuel,
-- donc hors classement — alors que la page du tournoi annonce « résultats
-- vérifiés automatiquement ». Même fonction qu'au-dessus, une vérification
-- de plus.
create or replace function public.s_inscrire_tournoi(p_tournament_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_tournoi record;
  v_compte record;
  v_inscrits int;
  v_rating int;
  v_id uuid;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select id, statut, capacite, game_id, season_id, region
  into v_tournoi
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;

  if v_tournoi.statut <> 'ouvert' then
    raise exception 'INSCRIPTIONS_FERMEES';
  end if;

  if exists (
    select 1 from public.registrations
    where tournament_id = p_tournament_id and profile_id = v_joueur
  ) then
    raise exception 'DEJA_INSCRIT';
  end if;

  select count(*) into v_inscrits
  from public.registrations
  where tournament_id = p_tournament_id and statut <> 'retire';

  if v_inscrits >= v_tournoi.capacite then
    raise exception 'TOURNOI_COMPLET';
  end if;

  select region, verifie_le
  into v_compte
  from public.game_accounts
  where profile_id = v_joueur and game_id = v_tournoi.game_id and est_principal;

  if not found or v_compte.verifie_le is null then
    raise exception 'COMPTE_RIOT_REQUIS';
  end if;

  if v_compte.region <> v_tournoi.region then
    raise exception 'REGION_DIFFERENTE';
  end if;

  select round(r.rating)::int
  into v_rating
  from public.ratings r
  where r.profile_id = v_joueur
    and r.game_id = v_tournoi.game_id
    and r.season_id = coalesce(
      v_tournoi.season_id,
      (select s.id from public.seasons s where s.game_id = v_tournoi.game_id and s.est_courante limit 1)
    );

  insert into public.registrations (tournament_id, profile_id, rating_a_inscription)
  values (p_tournament_id, v_joueur, v_rating)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.s_inscrire_tournoi(uuid) from public, anon;
grant execute on function public.s_inscrire_tournoi(uuid) to authenticated;

-- ---------- Défaite reconnue (2026-09-28, audit N3 et M8) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Un match sans résultat retrouvé bloquait son tournoi jusqu'à
-- l'intervention d'un organisateur (pour les tournois automatiques : un
-- administrateur présent à 21h). Le perdant peut désormais reconnaître sa
-- défaite en un clic :
-- - match en cours : on laisse encore 20 minutes à l'historique Riot. Si la
--   partie y est retrouvée, le verdict est de niveau 2 et compte au
--   classement ; sinon, la tâche de recherche tranche au niveau 1
--   (manuel, hors classement), motif public « Défaite reconnue par … » ;
-- - match déjà en litige : tranché tout de suite, au niveau 1.
-- La parole du perdant ne compte jamais au classement : seule la partie
-- Riot le fait.
alter table public.matches add column if not exists defaite_reconnue_par uuid references public.profiles(id);
alter table public.matches add column if not exists defaite_reconnue_le timestamptz;
create index if not exists matches_defaite_reconnue_par_idx on public.matches (defaite_reconnue_par);

-- Ces deux colonnes ne s'écrivent que par reconnaitre_defaite : ajoutées
-- aux colonnes figées du contrôle des écritures directes (même fonction
-- qu'au-dessus, republiée en entier).
create or replace function public.controler_ecriture_match()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.statut <> 'en_attente' or new.demarre_le is not null or new.code_tournoi is not null
       or new.defaite_reconnue_par is not null or new.defaite_reconnue_le is not null then
      raise exception 'CHAMP_RESERVE';
    end if;
    return new;
  end if;

  if (new.tournament_id, new.tour, new.position, new.match_suivant_id, new.code_tournoi,
      new.defaite_reconnue_par, new.defaite_reconnue_le)
     is distinct from
     (old.tournament_id, old.tour, old.position, old.match_suivant_id, old.code_tournoi,
      old.defaite_reconnue_par, old.defaite_reconnue_le) then
    raise exception 'CHAMP_NON_MODIFIABLE';
  end if;

  if new.statut is distinct from old.statut
     and not (old.statut = 'en_attente' and new.statut = 'en_cours') then
    raise exception 'CHANGEMENT_DE_STATUT_INTERDIT';
  end if;

  if new.demarre_le is distinct from old.demarre_le and not (
       old.demarre_le is null
       and new.demarre_le between now() - interval '2 minutes' and now() + interval '2 minutes'
  ) then
    raise exception 'HEURE_DE_DEBUT_RESERVEE';
  end if;

  return new;
end;
$$;

-- Verdict tiré d'une défaite reconnue. Réservée au service_role (tâche de
-- recherche) et à reconnaitre_defaite ci-dessous ; idempotente.
create or replace function public.enregistrer_defaite_reconnue(p_match_id uuid)
returns boolean -- true si écrit, false si le match était déjà décidé
language plpgsql
security definer set search_path = public
as $$
declare
  v_perdant uuid;
  v_gagnant uuid;
  v_pseudo text;
begin
  select defaite_reconnue_par into v_perdant
  from public.matches
  where id = p_match_id
  for update;

  if v_perdant is null then
    raise exception 'AUCUNE_DEFAITE_RECONNUE';
  end if;

  if exists (select 1 from public.match_verdicts where match_id = p_match_id and est_definitif) then
    return false;
  end if;

  select profile_id into v_gagnant
  from public.match_participants
  where match_id = p_match_id and profile_id <> v_perdant;

  select pseudo into v_pseudo from public.profiles where id = v_perdant;

  insert into public.match_verdicts (match_id, niveau, gagnant_id, decide_par, motif, est_definitif)
  values (
    p_match_id,
    'manuel',
    v_gagnant,
    null,
    'Défaite reconnue par ' || coalesce(v_pseudo, 'le joueur') || ' — partie non retrouvée dans l''historique Riot.',
    true
  );

  perform public.avancer_vainqueur(p_match_id, v_gagnant);
  return true;
end;
$$;

revoke all on function public.enregistrer_defaite_reconnue(uuid) from public, anon, authenticated;
grant execute on function public.enregistrer_defaite_reconnue(uuid) to service_role;

-- Appelée par le joueur qui a perdu. Renvoie 'en_attente' (la recherche Riot
-- a encore 20 minutes) ou 'tranche' (match déjà en litige : verdict posé).
create or replace function public.reconnaitre_defaite(p_match_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_statut public.match_status;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select statut into v_statut
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'MATCH_INTROUVABLE';
  end if;

  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and profile_id = v_joueur
  ) then
    raise exception 'NON_PARTICIPANT';
  end if;

  if (select count(*) from public.match_participants where match_id = p_match_id) <> 2 then
    raise exception 'ADVERSAIRE_ABSENT';
  end if;

  if v_statut not in ('en_cours', 'litige')
     or exists (select 1 from public.match_verdicts where match_id = p_match_id and est_definitif) then
    raise exception 'MATCH_DEJA_DECIDE';
  end if;

  update public.matches
  set defaite_reconnue_par = v_joueur, defaite_reconnue_le = now()
  where id = p_match_id and defaite_reconnue_par is null;

  if not found then
    raise exception 'DEFAITE_DEJA_RECONNUE';
  end if;

  if v_statut = 'litige' then
    perform public.enregistrer_defaite_reconnue(p_match_id);
    return 'tranche';
  end if;

  return 'en_attente';
end;
$$;

revoke execute on function public.reconnaitre_defaite(uuid) from public, anon;
grant execute on function public.reconnaitre_defaite(uuid) to authenticated;

-- ---------- Clôture de tournoi à l'abri des exécutions simultanées (2026-09-28, audit M16) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (src/lib/classement-actions.ts reconnaît ETAT_DE_DEPART_PERIME).
-- 1. La garde « déjà crédité » vérifiait puis écrivait sans verrou : deux
--    clôtures simultanées du même tournoi pouvaient journaliser deux fois
--    le même joueur. Une contrainte d'unicité rend le double crédit
--    impossible, quelle que soit la chronologie. (Si sa création échoue,
--    c'est qu'un doublon existe déjà dans le journal : le signaler au
--    porteur du projet, ne jamais supprimer de ligne — le journal est
--    immuable, CLAUDE.md §4.)
-- 2. Chaque clôture écrit un rating absolu calculé à partir de l'état lu
--    avant le calcul. Si un autre tournoi du même joueur a été clôturé
--    entre-temps, cet état est périmé : écrire effacerait l'autre résultat
--    et le journal public ne se suivrait plus (« rating avant » ≠ « rating
--    après » précédent). La fonction verrouille la ligne du joueur et
--    refuse un état de départ périmé (ETAT_DE_DEPART_PERIME) ; la clôture
--    est alors reprise au passage suivant de la tâche, à partir de l'état
--    à jour.
create unique index if not exists rating_events_un_credit_par_tournoi
  on public.rating_events (tournament_id, profile_id)
  where motif = 'tournoi';

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
declare
  v_actuel record;
begin
  if exists (
    select 1 from rating_events
    where profile_id = p_profile_id and tournament_id = p_tournament_id
  ) then
    return false;
  end if;

  -- Ligne du joueur créée si besoin (valeurs de départ Glicko-2), puis
  -- verrouillée jusqu'à la fin de l'écriture.
  insert into ratings (profile_id, game_id, season_id)
  values (p_profile_id, p_game_id, p_season_id)
  on conflict (profile_id, game_id, season_id) do nothing;

  select rating, rd into v_actuel
  from ratings
  where profile_id = p_profile_id and game_id = p_game_id and season_id = p_season_id
  for update;

  if v_actuel.rating <> p_rating_avant or v_actuel.rd <> p_rd_avant then
    raise exception 'ETAT_DE_DEPART_PERIME';
  end if;

  insert into rating_events (
    profile_id, game_id, season_id, tournament_id, match_id, motif,
    rating_avant, rd_avant, rating_apres, rd_apres, adversaire_id
  ) values (
    p_profile_id, p_game_id, p_season_id, p_tournament_id, null, p_motif,
    p_rating_avant, p_rd_avant, p_rating_apres, p_rd_apres, null
  );

  update ratings set
    rating = p_rating_apres,
    rd = p_rd_apres,
    volatilite = p_volatilite_apres,
    matchs_joues = matchs_joues + p_matchs_comptes,
    maj_le = now()
  where profile_id = p_profile_id and game_id = p_game_id and season_id = p_season_id;

  return true;
end;
$$;

revoke execute on function public.cloturer_rating_joueur from public, anon, authenticated;

-- ---------- Alerte « clé Riot expirée » (2026-09-28, audit E13) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- La tâche des tournois automatiques contrôle la clé API Riot dans les
-- 6 heures qui précèdent chaque tournoi et prévient l'organisateur une fois
-- par tournoi : même mécanisme de réservation que les rappels (une ligne
-- par tournoi et par type).
alter table public.rappels_tournoi drop constraint if exists rappels_tournoi_type_check;
alter table public.rappels_tournoi add constraint rappels_tournoi_type_check
  check (type in ('annonce', 'checkin_ouvert', 'dernier_appel', 'cle_riot_invalide'));

-- ---------- Désinscription, brouillons privés (2026-09-28, audit M7 et F2) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- 1. Un joueur ne pouvait pas se désinscrire (le statut « retiré » n'était
--    jamais utilisé). se_desinscrire le permet tant que le tournoi n'a pas
--    commencé ; sa place est libérée (les inscriptions « retirées » ne
--    comptent pas dans la capacité) et il peut se réinscrire ensuite.
-- 2. Les brouillons de tournoi, annoncés « non visibles publiquement »,
--    restaient lisibles de tous par appel direct à la base : seul leur
--    organisateur les voit désormais.
create or replace function public.se_desinscrire(p_tournament_id uuid)
returns boolean -- faux : aucune inscription active à retirer
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_statut public.tournament_status;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  -- Verrou partagé : une désinscription ne se glisse pas pendant la
  -- génération du bracket (même principe que confirmer_presence).
  select statut into v_statut
  from public.tournaments
  where id = p_tournament_id
  for share;

  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;

  if v_statut not in ('ouvert', 'checkin') then
    raise exception 'DESINSCRIPTION_FERMEE';
  end if;

  update public.registrations
  set statut = 'retire', confirme_le = null
  where tournament_id = p_tournament_id
    and profile_id = v_joueur
    and statut in ('inscrit', 'confirme');

  return found;
end;
$$;

revoke execute on function public.se_desinscrire(uuid) from public, anon;
grant execute on function public.se_desinscrire(uuid) to authenticated;

-- Réinscription après un retrait : même fonction qu'au-dessus, qui réactive
-- l'inscription retirée au lieu de la refuser comme un doublon.
create or replace function public.s_inscrire_tournoi(p_tournament_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_tournoi record;
  v_compte record;
  v_existante_id uuid;
  v_existante_statut public.registration_status;
  v_inscrits int;
  v_rating int;
  v_id uuid;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select id, statut, capacite, game_id, season_id, region
  into v_tournoi
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;

  if v_tournoi.statut <> 'ouvert' then
    raise exception 'INSCRIPTIONS_FERMEES';
  end if;

  select id, statut
  into v_existante_id, v_existante_statut
  from public.registrations
  where tournament_id = p_tournament_id and profile_id = v_joueur;

  if v_existante_id is not null and v_existante_statut <> 'retire' then
    raise exception 'DEJA_INSCRIT';
  end if;

  select count(*) into v_inscrits
  from public.registrations
  where tournament_id = p_tournament_id and statut <> 'retire';

  if v_inscrits >= v_tournoi.capacite then
    raise exception 'TOURNOI_COMPLET';
  end if;

  select region, verifie_le
  into v_compte
  from public.game_accounts
  where profile_id = v_joueur and game_id = v_tournoi.game_id and est_principal;

  if not found or v_compte.verifie_le is null then
    raise exception 'COMPTE_RIOT_REQUIS';
  end if;

  if v_compte.region <> v_tournoi.region then
    raise exception 'REGION_DIFFERENTE';
  end if;

  select round(r.rating)::int
  into v_rating
  from public.ratings r
  where r.profile_id = v_joueur
    and r.game_id = v_tournoi.game_id
    and r.season_id = coalesce(
      v_tournoi.season_id,
      (select s.id from public.seasons s where s.game_id = v_tournoi.game_id and s.est_courante limit 1)
    );

  if v_existante_id is not null then
    update public.registrations
    set statut = 'inscrit', inscrit_le = now(), confirme_le = null, seed = null, rating_a_inscription = v_rating
    where id = v_existante_id;
    return v_existante_id;
  end if;

  insert into public.registrations (tournament_id, profile_id, rating_a_inscription)
  values (p_tournament_id, v_joueur, v_rating)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.s_inscrire_tournoi(uuid) from public, anon;
grant execute on function public.s_inscrire_tournoi(uuid) to authenticated;

drop policy "tournois lisibles par tous" on public.tournaments;
create policy "tournois publies lisibles par tous"
  on public.tournaments for select using (
    statut <> 'brouillon' or organisateur_id = (select auth.uid())
  );

-- ---------- Profil modifiable, visites anonymes (2026-09-28, audit E7, M10) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Aucun écran ne permettait de changer son pseudo ni son pays : un compte
-- créé via Discord gardait à vie un pseudo « Joueur-1a2b3c4d » sur son CV.
-- - modifier_mon_profil : pseudo (mêmes règles qu'à l'inscription, unique
--   sans tenir compte des majuscules), pays, préférence de visite. Le
--   premier changement est libre (quitter le pseudo automatique), ensuite un
--   tous les 30 jours au plus, pour qu'un CV ne change pas d'identité à
--   volonté. Les pseudos « Joueur-xxxxxxxx » restent réservés aux comptes
--   qui n'ont pas encore choisi le leur.
-- - anciens_slugs : l'ancienne adresse d'un CV redirige vers la nouvelle
--   (liens déjà partagés, référencement), et ne peut pas être reprise par
--   quelqu'un d'autre.
-- - visites_anonymes : ne pas apparaître dans « Qui a consulté mon profil »
--   (offre Vérifié), un traitement jusqu'ici ni annoncé ni refusable.
alter table public.profiles add column if not exists pseudo_modifie_le timestamptz;
alter table public.profiles add column if not exists visites_anonymes boolean not null default false;
-- Colonnes privées : pas de grant select (voir mes_reglages_profil).

create table if not exists public.anciens_slugs (
  slug        text primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  remplace_le timestamptz not null default now()
);
create index if not exists anciens_slugs_profile_id_idx on public.anciens_slugs (profile_id);
alter table public.anciens_slugs enable row level security;
create policy "anciennes adresses lisibles par tous" on public.anciens_slugs for select using (true);
-- Aucune policy d'écriture : seule modifier_mon_profil y écrit.
revoke insert, update, delete on public.anciens_slugs from anon, authenticated;

create or replace function public.modifier_mon_profil(p_pseudo text, p_pays text, p_visites_anonymes boolean)
returns text -- adresse (slug) du profil après modification
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_actuel record;
  v_pseudo text := btrim(coalesce(p_pseudo, ''));
  v_pays text := nullif(btrim(coalesce(p_pays, '')), '');
  v_slug text;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select pseudo, slug, pseudo_modifie_le into v_actuel
  from public.profiles
  where id = v_joueur
  for update;

  -- Mêmes règles qu'à l'inscription (src/lib/auth-actions.ts, PSEUDO_REGEX).
  if v_pseudo !~ '^[a-zA-Z0-9 _-]{3,20}$' then
    raise exception 'PSEUDO_INVALIDE';
  end if;

  if v_pays is not null and (char_length(v_pays) > 40 or v_pays !~ '^[[:alpha:] ''-]+$') then
    raise exception 'PAYS_INVALIDE';
  end if;

  -- Même calcul que slugifier (src/lib/slug.ts) pour un pseudo ASCII.
  v_slug := btrim(regexp_replace(lower(v_pseudo), '[^a-z0-9]+', '-', 'g'), '-');
  if v_slug = '' then
    raise exception 'PSEUDO_INVALIDE';
  end if;

  if v_pseudo <> v_actuel.pseudo then
    if v_pseudo ~* '^joueur-[0-9a-f]{8}$' then
      raise exception 'PSEUDO_RESERVE';
    end if;

    if v_actuel.pseudo_modifie_le > now() - interval '30 days' then
      raise exception 'PSEUDO_RECEMMENT_MODIFIE';
    end if;

    if exists (
         select 1 from public.profiles
         where id <> v_joueur and (lower(pseudo) = lower(v_pseudo) or slug = v_slug)
       )
       or exists (select 1 from public.anciens_slugs where slug = v_slug and profile_id <> v_joueur) then
      raise exception 'PSEUDO_PRIS';
    end if;

    if v_slug <> v_actuel.slug then
      insert into public.anciens_slugs (slug, profile_id)
      values (v_actuel.slug, v_joueur)
      on conflict (slug) do nothing;
      -- Retour à une ancienne adresse du même joueur : elle redevient la sienne.
      delete from public.anciens_slugs where slug = v_slug and profile_id = v_joueur;
    end if;

    update public.profiles
    set pseudo = v_pseudo, slug = v_slug, pseudo_modifie_le = now()
    where id = v_joueur;
  end if;

  update public.profiles
  set pays = v_pays, visites_anonymes = coalesce(p_visites_anonymes, false)
  where id = v_joueur;

  -- Passer en anonyme efface aussi les visites déjà enregistrées.
  if coalesce(p_visites_anonymes, false) then
    delete from public.vues_profil where vu_par = v_joueur;
  end if;

  return v_slug;
end;
$$;

revoke execute on function public.modifier_mon_profil(text, text, boolean) from public, anon;
grant execute on function public.modifier_mon_profil(text, text, boolean) to authenticated;

-- handle_new_user est republiée plus bas (« Consentement enregistré »),
-- avec les règles de pseudo et d'ancienne adresse décrites ici.

-- Réglages privés du joueur connecté (page « Modifier mon profil ») :
-- personne d'autre ne sait qui navigue en anonyme.
create or replace function public.mes_reglages_profil()
returns table (pseudo_modifie_le timestamptz, visites_anonymes boolean)
language sql stable
security definer set search_path = public
as $$
  select p.pseudo_modifie_le, p.visites_anonymes
  from public.profiles p
  where p.id = (select auth.uid());
$$;
revoke execute on function public.mes_reglages_profil() from public, anon;
grant execute on function public.mes_reglages_profil() to authenticated;

create or replace function public.visites_anonymes_actives()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select visites_anonymes from public.profiles where id = (select auth.uid())), false);
$$;
revoke execute on function public.visites_anonymes_actives() from public, anon;
grant execute on function public.visites_anonymes_actives() to authenticated;

-- Mêmes règles vérifiées par la table elle-même pour toute nouvelle écriture
-- (not valid : les comptes existants ne sont pas contrôlés rétroactivement,
-- mais une ligne non conforme ne pourrait plus être modifiée). Avant
-- d'appliquer, lister les exceptions et les corriger à la main :
--   select id, pseudo, slug from public.profiles
--   where pseudo !~ '^[a-zA-Z0-9 _-]{3,20}$' or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';
alter table public.profiles drop constraint if exists profiles_pseudo_format;
alter table public.profiles add constraint profiles_pseudo_format
  check (pseudo ~ '^[a-zA-Z0-9 _-]{3,20}$') not valid;
alter table public.profiles drop constraint if exists profiles_slug_format;
alter table public.profiles add constraint profiles_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;

-- Un joueur qui a choisi l'anonymat n'enregistre plus ses visites.
alter policy "un joueur enregistre sa propre visite" on public.vues_profil
  with check ((select auth.uid()) = vu_par and not (select public.visites_anonymes_actives()));
alter policy "un joueur met a jour sa propre visite" on public.vues_profil
  using ((select auth.uid()) = vu_par and not (select public.visites_anonymes_actives()));

-- ---------- Suspension de compte (2026-09-28, audit M14) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Les CGU annoncent qu'un compte peut être suspendu ; aucun outil ne le
-- permettait. La suspension (page /admin) coupe la connexion (bannissement
-- côté Supabase Auth, fait par le serveur), retire le joueur des tournois
-- pas encore commencés, et la base refuse toute inscription ou tout
-- check-in tant qu'elle n'est pas levée. Historique conservé (qui, quand,
-- pourquoi), lisible par les seuls administrateurs.
create table if not exists public.suspensions (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  motif         text not null check (char_length(motif) between 3 and 500),
  suspendu_par  uuid references public.profiles(id) on delete set null,
  suspendu_le   timestamptz not null default now(),
  levee_par     uuid references public.profiles(id) on delete set null,
  levee_le      timestamptz
);
create unique index if not exists suspensions_une_active_par_joueur
  on public.suspensions (profile_id) where levee_le is null;
create index if not exists suspensions_suspendu_par_idx on public.suspensions (suspendu_par);
create index if not exists suspensions_levee_par_idx on public.suspensions (levee_par);
alter table public.suspensions enable row level security;
create policy "les administrateurs lisent les suspensions" on public.suspensions
  for select using (exists (select 1 from public.admins a where a.profile_id = (select auth.uid())));
-- Écriture réservée au serveur (actions de /admin, client service_role).
revoke insert, update, delete on public.suspensions from anon, authenticated;

-- S'applique à toute écriture, quel que soit l'auteur (s_inscrire_tournoi,
-- confirmer_presence, organisateur, serveur) : contrairement aux fonctions
-- de contrôle plus haut, elle ne dépend pas de current_user, et peut donc
-- être security definer pour lire la table des suspensions, que personne
-- d'autre que les administrateurs ne voit.
create or replace function public.refuser_compte_suspendu()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.statut in ('inscrit', 'confirme')
     and (tg_op = 'INSERT' or new.statut is distinct from old.statut)
     and exists (select 1 from public.suspensions where profile_id = new.profile_id and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;
  return new;
end;
$$;
revoke execute on function public.refuser_compte_suspendu() from public, anon, authenticated;

drop trigger if exists registrations_refuser_compte_suspendu on public.registrations;
create trigger registrations_refuser_compte_suspendu
  before insert or update of statut on public.registrations
  for each row execute function public.refuser_compte_suspendu();

-- ---------- Consentement enregistré (2026-09-28, audit M10) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- La confirmation d'âge et l'acceptation des CGU étaient demandées mais
-- jamais conservées : impossible de prouver quand, et sur quelle version,
-- un joueur les avait acceptées. Colonnes privées (aucun grant de lecture).
alter table public.profiles add column if not exists consentement_le timestamptz;
alter table public.profiles add column if not exists consentement_version text;

-- Création du profil à l'inscription, durcie :
-- - pseudo soumis aux mêmes règles que partout ailleurs, et adresse (slug)
--   recalculée ici plutôt que reçue telle quelle : l'API d'inscription de
--   Supabase peut être appelée directement, sans passer par le formulaire,
--   avec n'importe quel « pseudo » (du HTML dans un e-mail) ou « slug »
--   (« ../admin ») — audit M5. Pseudo refusé → pseudo automatique, que le
--   joueur change ensuite depuis « Modifier mon profil » ;
-- - une ancienne adresse de CV n'est pas reprise par un nouveau compte
--   (l'inscription le vérifie aussi, pour afficher un message clair) ;
-- - date et version des CGU acceptées (case cochée à l'inscription),
--   transmises par le formulaire.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pseudo text;
  v_slug text;
  v_discord_id text;
  v_automatique boolean := false;
  v_version_cgu text;
begin
  v_pseudo := btrim(new.raw_user_meta_data->>'pseudo');

  if v_pseudo is null
     or v_pseudo !~ '^[a-zA-Z0-9 _-]{3,20}$'
     or v_pseudo ~* '^joueur-[0-9a-f]{8}$'
     or btrim(regexp_replace(lower(v_pseudo), '[^a-z0-9]+', '-', 'g'), '-') = '' then
    v_pseudo := 'Joueur-' || substr(new.id::text, 1, 8);
    v_automatique := true;
  end if;
  -- Même calcul que slugifier (src/lib/slug.ts) pour un pseudo ASCII.
  v_slug := btrim(regexp_replace(lower(v_pseudo), '[^a-z0-9]+', '-', 'g'), '-');

  if exists (select 1 from public.anciens_slugs where slug = v_slug) then
    if not v_automatique then
      raise exception 'PSEUDO_PRIS';
    end if;
    -- Pseudo automatique déjà porté puis quitté par un autre joueur
    -- (identifiants qui commencent pareil) : on prend la fin de
    -- l'identifiant plutôt que d'empêcher l'inscription.
    v_pseudo := 'Joueur-' || substr(new.id::text, 25, 8);
    v_slug := lower(v_pseudo);
  end if;

  if new.raw_app_meta_data->>'provider' = 'discord' then
    v_discord_id := coalesce(
      new.raw_user_meta_data->>'provider_id',
      new.raw_user_meta_data->>'sub'
    );
  end if;

  v_version_cgu := new.raw_user_meta_data->>'version_cgu';
  if v_version_cgu !~ '^\d{4}-\d{2}-\d{2}$' then
    v_version_cgu := null;
  end if;

  insert into public.profiles (id, pseudo, slug, discord_id, consentement_le, consentement_version)
  values (
    new.id, v_pseudo, v_slug, v_discord_id,
    case when v_version_cgu is not null then now() end,
    v_version_cgu
  );
  return new;
end;
$$;

-- Connexion via Discord : le compte est créé au retour de Discord, sans le
-- formulaire ; la page de retour enregistre alors le consentement donné
-- avant de partir (une seule fois, jamais réécrit).
create or replace function public.enregistrer_consentement(p_version text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if p_version is null or p_version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'VERSION_INVALIDE';
  end if;
  update public.profiles
  set consentement_le = now(), consentement_version = p_version
  where id = (select auth.uid()) and consentement_le is null;
  return found;
end;
$$;
revoke execute on function public.enregistrer_consentement(text) from public, anon;
grant execute on function public.enregistrer_consentement(text) to authenticated;

-- ---------- Logos : stockage verrouillé (2026-09-28, audit M6) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Avant : format et taille contrôlés dans le navigateur seulement, et tout
-- compte connecté pouvait déposer n'importe quel fichier dans l'espace
-- public « logos », y compris à l'emplacement du logo d'une autre équipe ;
-- le champ logo acceptait aussi n'importe quelle adresse extérieure.
-- - Taille (2 Mo) et formats (PNG, JPEG, WebP) appliqués par Supabase
--   Storage lui-même.
-- - Emplacement lié au propriétaire : equipe/{id}.{ext} pour le capitaine
--   de l'équipe, tournoi/{id}.{ext} pour l'organisateur du tournoi.
-- - teams.logo_url : uniquement une image de cet espace, à l'emplacement
--   de l'équipe ; couleur d'accent au format #RRGGBB. Les valeurs
--   existantes qui ne respectent pas ces formats sont effacées.
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'logos';

drop policy if exists "un proprietaire ajoute son propre logo" on storage.objects;
drop policy if exists "un proprietaire remplace son propre logo" on storage.objects;

create policy "un capitaine ou un organisateur depose son logo"
  on storage.objects for insert with check (
    bucket_id = 'logos'
    and owner = (select auth.uid())
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
    and (
      ((storage.foldername(name))[1] = 'equipe' and exists (
        select 1 from public.teams t
        where t.id::text = split_part(storage.filename(name), '.', 1)
          and t.capitaine_id = (select auth.uid())))
      or ((storage.foldername(name))[1] = 'tournoi' and exists (
        select 1 from public.tournaments t
        where t.id::text = split_part(storage.filename(name), '.', 1)
          and t.organisateur_id = (select auth.uid())))
    )
  );

create policy "un capitaine ou un organisateur remplace son logo"
  on storage.objects for update
  using (bucket_id = 'logos' and owner = (select auth.uid()))
  with check (
    bucket_id = 'logos'
    and owner = (select auth.uid())
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
    and (
      ((storage.foldername(name))[1] = 'equipe' and exists (
        select 1 from public.teams t
        where t.id::text = split_part(storage.filename(name), '.', 1)
          and t.capitaine_id = (select auth.uid())))
      or ((storage.foldername(name))[1] = 'tournoi' and exists (
        select 1 from public.tournaments t
        where t.id::text = split_part(storage.filename(name), '.', 1)
          and t.organisateur_id = (select auth.uid())))
    )
  );

update public.teams
set logo_url = null
where logo_url is not null
  and logo_url !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/logos/equipe/'
                   || id::text || '\.(png|jpg|jpeg|webp)(\?v=[0-9]+)?$');
update public.teams set couleur_accent = null
where couleur_accent is not null and couleur_accent !~ '^#[0-9a-fA-F]{6}$';

alter table public.teams drop constraint if exists teams_logo_url_stockage;
alter table public.teams add constraint teams_logo_url_stockage check (
  logo_url is null
  or logo_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/logos/equipe/'
                 || id::text || '\.(png|jpg|jpeg|webp)(\?v=[0-9]+)?$')
);
-- Même règle pour le futur logo de tournoi (champ pas encore affiché).
update public.tournaments
set logo_url = null
where logo_url is not null
  and logo_url !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/logos/tournoi/'
                   || id::text || '\.(png|jpg|jpeg|webp)(\?v=[0-9]+)?$');
alter table public.tournaments drop constraint if exists tournaments_logo_url_stockage;
alter table public.tournaments add constraint tournaments_logo_url_stockage check (
  logo_url is null
  or logo_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/logos/tournoi/'
                 || id::text || '\.(png|jpg|jpeg|webp)(\?v=[0-9]+)?$')
);
alter table public.teams drop constraint if exists teams_couleur_accent_format;
alter table public.teams add constraint teams_couleur_accent_format check (
  couleur_accent is null or couleur_accent ~ '^#[0-9a-fA-F]{6}$'
);

-- ---------- Assistant IA : limite par compte (2026-09-28, audit F2) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Chaque demande à l'assistant de création de tournoi coûte un appel payant
-- à l'API Anthropic ; il n'y avait aucune limite par personne. 10 demandes
-- par 24 heures et par compte ; seule la date de chaque demande est
-- gardée, 7 jours au plus.
create table if not exists public.appels_assistant_ia (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  cree_le     timestamptz not null default now()
);
create index if not exists appels_assistant_ia_profile_cree_le_idx
  on public.appels_assistant_ia (profile_id, cree_le);
alter table public.appels_assistant_ia enable row level security;
-- Aucune policy : seule reserver_appel_assistant_ia y écrit.
revoke all on public.appels_assistant_ia from anon, authenticated;

create or replace function public.reserver_appel_assistant_ia()
returns boolean -- false : limite du jour atteinte
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_nombre integer;
begin
  if v_joueur is null then
    return false;
  end if;

  -- Une demande à la fois par joueur : deux onglets ne dépassent pas la limite.
  perform 1 from public.profiles where id = v_joueur for update;

  delete from public.appels_assistant_ia where cree_le < now() - interval '7 days';

  select count(*) into v_nombre
  from public.appels_assistant_ia
  where profile_id = v_joueur and cree_le > now() - interval '24 hours';

  -- Même valeur que LIMITE_ASSISTANT_IA (src/lib/ia-actions.ts).
  if v_nombre >= 10 then
    return false;
  end if;

  insert into public.appels_assistant_ia (profile_id) values (v_joueur);
  return true;
end;
$$;
revoke execute on function public.reserver_appel_assistant_ia() from public, anon;
grant execute on function public.reserver_appel_assistant_ia() to authenticated;

-- ---------- Abonnement Stripe : portail client (2026-09-28) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Rien ne gardait l'identifiant client Stripe d'un abonné : impossible de
-- lui ouvrir le portail Stripe (changer de carte, télécharger ses
-- factures, résilier), obligatoire pour un abonnement résiliable en
-- ligne. Écrit par le webhook Stripe (client service_role) seulement.
create table if not exists public.abonnements_stripe (
  profile_id            uuid primary key references public.profiles(id) on delete cascade,
  client_stripe_id      text not null,
  abonnement_stripe_id  text,
  statut                text,
  maj_le                timestamptz not null default now()
);
alter table public.abonnements_stripe enable row level security;
-- Aucune policy : lecture par mon_abonnement_stripe, écriture par le serveur.
revoke all on public.abonnements_stripe from anon, authenticated;

create or replace function public.mon_abonnement_stripe()
returns table (statut text)
language sql stable
security definer set search_path = public
as $$
  select a.statut from public.abonnements_stripe a where a.profile_id = (select auth.uid());
$$;
revoke execute on function public.mon_abonnement_stripe() from public, anon;
grant execute on function public.mon_abonnement_stripe() to authenticated;

-- ---------- Suppression de compte en libre-service (2026-09-28, audit M17) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- La suppression se faisait par e-mail au fondateur. Désormais depuis
-- « Modifier mon profil ». Le compte n'est pas effacé mais anonymisé :
-- effacer la ligne du profil emporterait les résultats des adversaires,
-- les brackets et le journal public des points, qui ne se modifie jamais
-- (CLAUDE.md §4). Ce qui disparaît : pseudo (remplacé par
-- « Supprime-xxxxxxxxxxx »), pays, Discord, comptes Riot, rating (et donc
-- la place au classement), statistiques de partie, équipes dont on est le
-- seul membre, annonce, visites, liste de suivi, notifications, offre,
-- anciennes adresses. Ce qui reste, sous le pseudo anonyme : matchs joués,
-- journal des points, messages déjà envoyés, litiges.
-- Refusée tant qu'un engagement est en cours (tournoi joué ou organisé,
-- équipe avec d'autres membres, abonnement payant) : chaque refus dit quoi
-- faire. L'identité de connexion (e-mail) est ensuite effacée par le
-- serveur (suppression Supabase Auth « douce », qui garde la ligne).
alter table public.profiles add column if not exists supprime_le timestamptz;
grant select (supprime_le) on public.profiles to anon, authenticated;

create or replace function public.supprimer_mon_compte()
returns text -- pseudo anonyme du compte
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_profil record;
  v_pseudo text;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select pseudo, supprime_le into v_profil from public.profiles where id = v_joueur for update;
  if v_profil.supprime_le is not null then
    return v_profil.pseudo; -- déjà fait : une relance ne change rien
  end if;

  if exists (select 1 from public.admins where profile_id = v_joueur) then
    raise exception 'COMPTE_ADMINISTRATEUR';
  end if;
  -- Tournoi en cours, même éliminé : ses points sont calculés à la
  -- clôture, avec son rating comme adversaire.
  if exists (
    select 1
    from public.registrations r
    join public.tournaments t on t.id = r.tournament_id
    where r.profile_id = v_joueur
      and r.statut in ('inscrit', 'confirme')
      and t.statut = 'en_cours'
  ) or exists (
    select 1
    from public.match_participants mp
    join public.matches m on m.id = mp.match_id
    join public.tournaments t on t.id = m.tournament_id
    where mp.profile_id = v_joueur and t.statut = 'en_cours'
  ) then
    raise exception 'TOURNOI_EN_COURS';
  end if;
  if exists (
    select 1 from public.tournaments
    where organisateur_id = v_joueur and statut in ('ouvert', 'checkin', 'en_cours')
  ) then
    raise exception 'TOURNOI_ORGANISE_ACTIF';
  end if;
  if exists (
    select 1 from public.teams t
    where t.capitaine_id = v_joueur
      and exists (
        select 1 from public.team_members m
        where m.team_id = t.id and m.profile_id <> v_joueur and m.accepte_le is not null
      )
  ) then
    raise exception 'EQUIPE_AVEC_MEMBRES';
  end if;
  if exists (
    select 1 from public.abonnements_stripe
    where profile_id = v_joueur and statut in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete')
  ) then
    raise exception 'ABONNEMENT_ACTIF';
  end if;

  -- Tournois pas encore commencés : désinscription.
  update public.registrations r
  set statut = 'retire'
  from public.tournaments t
  where r.tournament_id = t.id
    and r.profile_id = v_joueur
    and r.statut in ('inscrit', 'confirme')
    and t.statut in ('ouvert', 'checkin');

  delete from public.tournaments where organisateur_id = v_joueur and statut = 'brouillon';
  -- Équipes dont on est le seul membre (les autres cas sont refusés plus haut).
  delete from public.teams where capitaine_id = v_joueur;
  delete from public.team_members where profile_id = v_joueur;
  delete from public.game_accounts where profile_id = v_joueur;
  delete from public.stats_match_joueur where profile_id = v_joueur;
  delete from public.ratings where profile_id = v_joueur;
  delete from public.comptes_offres where profile_id = v_joueur;
  delete from public.abonnements_stripe where profile_id = v_joueur;
  delete from public.vues_profil where profile_id = v_joueur or vu_par = v_joueur;
  delete from public.watchlist where recruteur_id = v_joueur or joueur_suivi_id = v_joueur;
  delete from public.push_subscriptions where profile_id = v_joueur;
  delete from public.recherches_coequipiers where profile_id = v_joueur;
  delete from public.appels_assistant_ia where profile_id = v_joueur;
  delete from public.anciens_slugs where profile_id = v_joueur;
  delete from public.login_attempts
  where email = (select lower(u.email) from auth.users u where u.id = v_joueur);

  -- 20 caractères : « Supprime- » + 11 caractères de l'identifiant.
  v_pseudo := 'Supprime-' || substr(replace(v_joueur::text, '-', ''), 1, 11);
  update public.profiles
  set pseudo = v_pseudo,
      slug = lower(v_pseudo),
      avatar_url = null,
      pays = null,
      discord_id = null,
      visites_anonymes = true,
      pseudo_modifie_le = null,
      supprime_le = now()
  where id = v_joueur;

  return v_pseudo;
end;
$$;
revoke execute on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ---------- Comptes Riot : délier, Riot ID non vérifiés privés (2026-09-28, audit M9) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- - Un Riot ID simplement saisi (pas encore vérifié) peut appartenir à
--   quelqu'un d'autre : il n'est plus lisible que par son propriétaire, y
--   compris par l'accès direct à la base (le CV ne l'affichait déjà plus).
-- - Délier son compte Riot (erreur de saisie, changement de compte) :
--   refusé tant qu'on est inscrit à un tournoi pas encore terminé, dont le
--   moteur a besoin de ce compte pour lire les résultats.
drop policy if exists "comptes de jeu lisibles par tous" on public.game_accounts;
create policy "comptes verifies lisibles par tous, le sien toujours"
  on public.game_accounts for select
  using (verifie_le is not null or profile_id = (select auth.uid()));

create or replace function public.delier_compte_riot(p_game_id smallint)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  if exists (
    select 1
    from public.registrations r
    join public.tournaments t on t.id = r.tournament_id
    where r.profile_id = v_joueur
      and r.statut in ('inscrit', 'confirme')
      and t.game_id = p_game_id
      and t.statut in ('ouvert', 'checkin', 'en_cours')
  ) then
    raise exception 'INSCRIT_A_UN_TOURNOI';
  end if;

  delete from public.game_accounts where profile_id = v_joueur and game_id = p_game_id;
  return found;
end;
$$;
revoke execute on function public.delier_compte_riot(smallint) from public, anon;
grant execute on function public.delier_compte_riot(smallint) to authenticated;

-- ---------- Tentatives de connexion par adresse IP (2026-09-28, audit F1) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- La limite « 5 échecs en 15 minutes » comptait par adresse e-mail seule :
-- n'importe qui pouvait bloquer la connexion d'un joueur en échouant
-- 5 fois avec son adresse. Elle compte désormais par e-mail ET adresse IP
-- (gardée 24 heures, comme le reste de la table).
alter table public.login_attempts add column if not exists ip text;
create index if not exists login_attempts_email_ip_cree_le_idx on public.login_attempts (email, ip, cree_le);

-- ---------- Registre des points scellé (2026-09-28, audit N8) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- « Ce journal est public et ne se modifie jamais » (CLAUDE.md §4) devient
-- démontrable : chaque ligne de rating_events porte l'empreinte (SHA-256)
-- de son contenu ET de la ligne précédente, comme les maillons d'une
-- chaîne. Modifier une ligne passée, même par l'équipe Najarena, changerait
-- son empreinte et toutes celles qui suivent ; l'empreinte du jour est
-- publiée sur Discord, n'importe qui peut donc refaire le calcul
-- (scripts/verifier-registre.mjs, page /registre).
-- Contenu scellé, dans cet ordre, séparé par « | » : numéro de ligne,
-- empreinte précédente (64 zéros pour la première), joueur, jeu, saison,
-- match, tournoi, motif, rating avant, RD avant, rating après, RD après
-- (2 décimales), adversaire, date en microsecondes depuis le 1er janvier
-- 1970 UTC. Champ vide : chaîne vide.
alter table public.rating_events add column if not exists numero bigint;
alter table public.rating_events add column if not exists empreinte_precedente text;
alter table public.rating_events add column if not exists empreinte text;

create or replace function public.contenu_scelle_rating_event(
  p_numero bigint,
  p_precedente text,
  p_profile_id uuid,
  p_game_id smallint,
  p_season_id uuid,
  p_match_id uuid,
  p_tournament_id uuid,
  p_motif text,
  p_rating_avant numeric,
  p_rd_avant numeric,
  p_rating_apres numeric,
  p_rd_apres numeric,
  p_adversaire_id uuid,
  p_cree_le timestamptz
)
returns text
language sql immutable
set search_path = public
as $$
  select concat(
    p_numero::text, '|',
    p_precedente, '|',
    p_profile_id::text, '|',
    p_game_id::text, '|',
    p_season_id::text, '|',
    coalesce(p_match_id::text, ''), '|',
    coalesce(p_tournament_id::text, ''), '|',
    p_motif, '|',
    round(p_rating_avant, 2)::text, '|',
    round(p_rd_avant, 2)::text, '|',
    round(p_rating_apres, 2)::text, '|',
    round(p_rd_apres, 2)::text, '|',
    coalesce(p_adversaire_id::text, ''), '|',
    ((extract(epoch from p_cree_le) * 1000000)::bigint)::text
  );
$$;

create or replace function public.empreinte_rating_event(p_contenu text)
returns text
language sql immutable
set search_path = public
as $$
  select encode(sha256(convert_to(p_contenu, 'UTF8')), 'hex');
$$;

-- Lignes déjà écrites : scellées dans l'ordre où elles ont été écrites.
do $$
declare
  r record;
  v_precedente text := repeat('0', 64);
  v_numero bigint := 0;
begin
  for r in select * from public.rating_events where numero is null order by id loop
    v_numero := v_numero + 1;
    update public.rating_events
    set numero = v_numero,
        empreinte_precedente = v_precedente,
        empreinte = public.empreinte_rating_event(public.contenu_scelle_rating_event(
          v_numero, v_precedente, r.profile_id, r.game_id, r.season_id, r.match_id, r.tournament_id,
          r.motif, r.rating_avant, r.rd_avant, r.rating_apres, r.rd_apres, r.adversaire_id, r.cree_le))
    where id = r.id
    returning empreinte into v_precedente;
  end loop;
end;
$$;

alter table public.rating_events alter column numero set not null;
alter table public.rating_events alter column empreinte_precedente set not null;
alter table public.rating_events alter column empreinte set not null;
create unique index if not exists rating_events_numero_idx on public.rating_events (numero);

-- Chaque nouvelle ligne est scellée à la suite de la dernière. Le verrou
-- met les écritures simultanées en file : deux lignes ne peuvent pas
-- s'accrocher au même maillon.
create or replace function public.sceller_rating_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_derniere record;
begin
  perform pg_advisory_xact_lock(hashtext('najarena.registre_des_points'));

  select numero, empreinte into v_derniere
  from public.rating_events
  order by numero desc
  limit 1;

  new.numero := coalesce(v_derniere.numero, 0) + 1;
  new.empreinte_precedente := coalesce(v_derniere.empreinte, repeat('0', 64));
  new.empreinte := public.empreinte_rating_event(public.contenu_scelle_rating_event(
    new.numero, new.empreinte_precedente, new.profile_id, new.game_id, new.season_id, new.match_id,
    new.tournament_id, new.motif, new.rating_avant, new.rd_avant, new.rating_apres, new.rd_apres,
    new.adversaire_id, new.cree_le));
  return new;
end;
$$;
revoke execute on function public.sceller_rating_event() from public, anon, authenticated;

drop trigger if exists rating_events_sceller on public.rating_events;
create trigger rating_events_sceller
  before insert on public.rating_events
  for each row execute function public.sceller_rating_event();

-- Et plus aucune ligne ne peut être modifiée ni effacée, par personne.
create or replace function public.refuser_modification_registre()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'REGISTRE_IMMUABLE';
end;
$$;
revoke execute on function public.refuser_modification_registre() from public, anon, authenticated;

drop trigger if exists rating_events_immuable on public.rating_events;
create trigger rating_events_immuable
  before update or delete on public.rating_events
  for each row execute function public.refuser_modification_registre();
drop trigger if exists rating_events_immuable_truncate on public.rating_events;
create trigger rating_events_immuable_truncate
  before truncate on public.rating_events
  for each statement execute function public.refuser_modification_registre();

-- Vérification de toute la chaîne (page /registre).
create or replace function public.verifier_registre()
returns table (lignes bigint, derniere_empreinte text, premiere_rupture bigint)
language plpgsql stable
set search_path = public
as $$
declare
  r record;
  v_precedente text := repeat('0', 64);
  v_attendu bigint := 0;
  v_rupture bigint;
begin
  for r in select * from public.rating_events order by numero loop
    v_attendu := v_attendu + 1;
    if v_rupture is null and (
      r.numero <> v_attendu
      or r.empreinte_precedente <> v_precedente
      or r.empreinte <> public.empreinte_rating_event(public.contenu_scelle_rating_event(
           r.numero, v_precedente, r.profile_id, r.game_id, r.season_id, r.match_id, r.tournament_id,
           r.motif, r.rating_avant, r.rd_avant, r.rating_apres, r.rd_apres, r.adversaire_id, r.cree_le))
    ) then
      v_rupture := r.numero;
    end if;
    v_precedente := r.empreinte;
  end loop;
  return query select v_attendu, case when v_attendu > 0 then v_precedente end, v_rupture;
end;
$$;
grant execute on function public.verifier_registre() to anon, authenticated;

-- Le registre tel qu'il est scellé, pour le téléchargement public : nombres
-- et date déjà dans leur forme scellée (texte), pour que n'importe quel
-- outil refasse le calcul sans conversion.
create or replace view public.registre_public
with (security_invoker = true)
as
select
  numero,
  empreinte_precedente,
  empreinte,
  profile_id,
  game_id,
  season_id,
  match_id,
  tournament_id,
  motif,
  round(rating_avant, 2)::text as rating_avant,
  round(rd_avant, 2)::text as rd_avant,
  round(rating_apres, 2)::text as rating_apres,
  round(rd_apres, 2)::text as rd_apres,
  adversaire_id,
  cree_le,
  ((extract(epoch from cree_le) * 1000000)::bigint)::text as cree_le_us
from public.rating_events;
grant select on public.registre_public to anon, authenticated;

-- Empreinte publiée chaque soir sur Discord (tâche des tournois
-- automatiques) : une ligne par jour, écrite par le serveur seulement.
create table if not exists public.empreintes_publiees (
  jour        date primary key,
  numero      bigint not null,
  empreinte   text not null,
  publiee_le  timestamptz not null default now()
);
alter table public.empreintes_publiees enable row level security;
create policy "empreintes publiees lisibles par tous" on public.empreintes_publiees for select using (true);
revoke insert, update, delete on public.empreintes_publiees from anon, authenticated;

-- ---------- Certificat de niveau vérifiable (2026-09-28, audit N9) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Un joueur émet un lien daté : « au 28/09/2026, 1 720 ± 60, 34 matchs
-- vérifiés, palier Diamant ». L'instantané est calculé par la base (jamais
-- saisi), figé (aucune modification possible) et adossé à la ligne du
-- registre des points scellé à cet instant : il remplace la capture
-- d'écran, falsifiable. Lecture par le code seulement (pas de liste
-- publique des certificats) ; 5 émissions par jour et par joueur.
create table if not exists public.certificats (
  code               text primary key,
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  game_id            smallint not null references public.games(id),
  cree_le            timestamptz not null default now(),
  saison             text,
  rating             numeric(7,2) not null,
  rd                 numeric(6,2) not null,
  est_classe         boolean not null,
  palier             text,
  matchs_verifies    integer not null,
  victoires          integer not null,
  registre_numero    bigint,
  registre_empreinte text
);
create index if not exists certificats_profile_cree_le_idx on public.certificats (profile_id, cree_le);
alter table public.certificats enable row level security;
create policy "un joueur voit ses propres certificats" on public.certificats
  for select using ((select auth.uid()) = profile_id);
revoke insert, update, delete on public.certificats from anon, authenticated;

create or replace function public.emettre_certificat(p_game_id smallint default 1)
returns text -- code du certificat
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_saison record;
  v_rating record;
  v_palier text;
  v_matchs integer;
  v_victoires integer;
  v_registre record;
  v_code text;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  -- Une émission à la fois par joueur, et 5 par jour au plus.
  perform 1 from public.profiles where id = v_joueur for update;
  if (select count(*) from public.certificats
      where profile_id = v_joueur and cree_le > now() - interval '24 hours') >= 5 then
    raise exception 'LIMITE_CERTIFICATS';
  end if;

  select id, coalesce(nom, 'Saison ' || numero) as nom into v_saison
  from public.seasons where game_id = p_game_id and est_courante;

  select rating, rd, est_classe into v_rating
  from public.ratings
  where profile_id = v_joueur and game_id = p_game_id and season_id = v_saison.id;
  if v_rating is null then
    raise exception 'AUCUN_RATING';
  end if;

  if v_rating.est_classe then
    select nom into v_palier from public.tiers
    where game_id = p_game_id and rating_min <= v_rating.rating
    order by rating_min desc limit 1;
  end if;

  -- Matchs vérifiés dans la donnée Riot (niveaux 2 et 3), jamais les verdicts manuels.
  select count(*), count(*) filter (where mp.est_gagnant)
  into v_matchs, v_victoires
  from public.match_participants mp
  join public.matches m on m.id = mp.match_id
  join public.tournaments t on t.id = m.tournament_id
  join public.match_verdicts v on v.match_id = mp.match_id and v.est_definitif
  where mp.profile_id = v_joueur and t.game_id = p_game_id and v.niveau <> 'manuel';

  select numero, empreinte into v_registre
  from public.rating_events order by numero desc limit 1;

  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.certificats (
    code, profile_id, game_id, saison, rating, rd, est_classe, palier,
    matchs_verifies, victoires, registre_numero, registre_empreinte
  ) values (
    v_code, v_joueur, p_game_id, v_saison.nom, v_rating.rating, v_rating.rd, v_rating.est_classe, v_palier,
    v_matchs, v_victoires, v_registre.numero, v_registre.empreinte
  );
  return v_code;
end;
$$;
revoke execute on function public.emettre_certificat(smallint) from public, anon;
grant execute on function public.emettre_certificat(smallint) to authenticated;

-- Lecture d'un certificat par son code (page /certificat/[code]).
create or replace function public.lire_certificat(p_code text)
returns table (
  code text, cree_le timestamptz, saison text, rating numeric, rd numeric, est_classe boolean,
  palier text, matchs_verifies integer, victoires integer, registre_numero bigint,
  registre_empreinte text, profile_id uuid, pseudo text, slug text, compte_supprime boolean
)
language sql stable
security definer set search_path = public
as $$
  select c.code, c.cree_le, c.saison, c.rating, c.rd, c.est_classe, c.palier, c.matchs_verifies,
         c.victoires, c.registre_numero, c.registre_empreinte, c.profile_id, p.pseudo, p.slug,
         p.supprime_le is not null
  from public.certificats c
  join public.profiles p on p.id = c.profile_id
  where c.code = p_code;
$$;
grant execute on function public.lire_certificat(text) to anon, authenticated;

-- Figé, comme le registre : aucune retouche ni suppression (hors
-- suppression du compte, qui efface ses certificats par cascade).
create or replace function public.refuser_modification_certificat()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'CERTIFICAT_IMMUABLE';
end;
$$;
revoke execute on function public.refuser_modification_certificat() from public, anon, authenticated;
drop trigger if exists certificats_immuables on public.certificats;
create trigger certificats_immuables
  before update on public.certificats
  for each row execute function public.refuser_modification_certificat();

-- ---------- Récap de la semaine (2026-09-28, audit N17) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Chaque lundi, la tâche des tournois automatiques calcule le récap de la
-- semaine précédente (page /lol/semaine/[lundi]) et le publie sur Discord,
-- une seule fois ; une semaine sans tournoi clôturé n'est jamais annoncée.
create table if not exists public.recaps_semaine (
  semaine    date primary key, -- lundi de la semaine racontée
  annonce    boolean not null, -- false : semaine vide, rien publié
  publie_le  timestamptz not null default now()
);
alter table public.recaps_semaine enable row level security;
create policy "recaps lisibles par tous" on public.recaps_semaine for select using (true);
revoke insert, update, delete on public.recaps_semaine from anon, authenticated;

-- ---------- Tournoi classé : critères publics (2026-09-28, audit E12 et N12) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (src/lib/classement-actions.ts appelle figer_classement_tournoi).
-- Avant : tout tournoi comptait au classement, même à 4 amis dans un
-- tournoi créé la veille — des parties réelles mais arrangées pouvaient
-- gonfler un rating tout en portant le badge « vérifié ». Désormais un
-- tournoi ne compte que s'il est officiel (tournoi quotidien automatique)
-- ou s'il remplit tous ces critères publics :
-- - au moins 8 joueurs au départ du bracket ;
-- - publié (inscriptions ouvertes) au moins 24 h avant son début ;
-- - son organisateur ne joue pas dedans ;
-- - l'organisateur ne l'a pas déclaré « amical ».
-- Mêmes seuils que src/lib/tournoi-classe.ts (affichage). La décision est
-- figée à la clôture (colonne classe) et ne change plus ensuite.
alter table public.tournaments add column if not exists publie_le timestamptz;
alter table public.tournaments add column if not exists classe boolean;

-- Tournois déjà publiés : leur date de publication n'a pas été gardée, la
-- création fait foi. Tournois déjà clôturés : classés s'ils ont réellement
-- crédité des points.
update public.tournaments set publie_le = cree_le where statut <> 'brouillon' and publie_le is null;
update public.tournaments t
set classe = exists (
  select 1 from public.rating_events e where e.tournament_id = t.id and e.motif = 'tournoi'
)
where t.statut = 'termine' and t.classe is null;

-- Heure de publication posée par la base elle-même, jamais par l'appelant ;
-- la décision « classé » n'est écrite que par figer_classement_tournoi, et
-- jamais changée une fois écrite. Déclencheur sans security definer : il
-- doit voir le vrai appelant (current_user).
create or replace function public.controler_classement_tournoi()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.publie_le := case when new.statut = 'brouillon' then null else now() end;
    if current_user = 'authenticated' and new.classe is not null then
      raise exception 'CHAMP_RESERVE';
    end if;
    return new;
  end if;

  if old.statut = 'brouillon' and new.statut = 'ouvert' then
    new.publie_le := now();
  else
    new.publie_le := old.publie_le;
  end if;

  if new.classe is distinct from old.classe then
    if old.classe is not null then
      raise exception 'CLASSEMENT_FIGE';
    end if;
    if current_user = 'authenticated' then
      raise exception 'CHAMP_NON_MODIFIABLE';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.controler_classement_tournoi() from public, anon, authenticated;

drop trigger if exists controle_classement_tournoi on public.tournaments;
create trigger controle_classement_tournoi
  before insert or update on public.tournaments
  for each row execute function public.controler_classement_tournoi();

-- Les critères, lisibles par tous (page du tournoi). Sous l'identité de
-- l'appelant : un brouillon reste invisible pour qui n'en est pas
-- l'organisateur.
create or replace function public.criteres_tournoi_classe(p_tournament_id uuid)
returns table (
  officiel boolean,
  amical boolean,
  publie_a_temps boolean,
  joueurs_au_depart integer,
  organisateur_joue boolean,
  classe boolean
)
language sql
stable
set search_path = public
as $$
  select
    c.officiel,
    c.amical,
    c.publie_a_temps,
    c.joueurs,
    c.orga,
    not c.amical and (c.officiel or (c.publie_a_temps and c.joueurs >= 8 and not c.orga))
  from (
    select
      t.creneau_auto is not null as officiel,
      not t.compte_pour_classement as amical,
      coalesce(t.publie_le <= t.debute_le - interval '24 hours', false) as publie_a_temps,
      (select count(distinct mp.profile_id)::integer
         from public.matches m
         join public.match_participants mp on mp.match_id = m.id
        where m.tournament_id = t.id) as joueurs,
      exists (
        select 1 from public.matches m
        join public.match_participants mp on mp.match_id = m.id
        where m.tournament_id = t.id and mp.profile_id = t.organisateur_id
      ) or exists (
        select 1 from public.registrations r
        where r.tournament_id = t.id and r.profile_id = t.organisateur_id
          and r.statut in ('inscrit', 'confirme')
      ) as orga
    from public.tournaments t
    where t.id = p_tournament_id
  ) c;
$$;
revoke execute on function public.criteres_tournoi_classe(uuid) from public;
grant execute on function public.criteres_tournoi_classe(uuid) to anon, authenticated, service_role;

-- Décision prise à la clôture, une fois la finale jouée : jamais avant (un
-- bracket incomplet donnerait un faux « moins de 8 joueurs »). Idempotente.
create or replace function public.figer_classement_tournoi(p_tournament_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_classe boolean;
begin
  select classe into v_classe
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;

  if v_classe is not null then
    return v_classe;
  end if;

  if not exists (
    select 1 from public.matches
    where tournament_id = p_tournament_id and match_suivant_id is null
      and statut in ('termine', 'forfait')
  ) then
    raise exception 'FINALE_NON_JOUEE';
  end if;

  select c.classe into v_classe from public.criteres_tournoi_classe(p_tournament_id) c;
  update public.tournaments set classe = v_classe where id = p_tournament_id;
  return v_classe;
end;
$$;
revoke all on function public.figer_classement_tournoi(uuid) from public, anon, authenticated;
grant execute on function public.figer_classement_tournoi(uuid) to service_role;

-- Écriture d'un rating : refusée pour un tournoi que la clôture n'a pas
-- déclaré classé (même fonction que la section « Clôture de tournoi à
-- l'abri des exécutions simultanées », une vérification de plus).
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
declare
  v_actuel record;
begin
  if exists (
    select 1 from rating_events
    where profile_id = p_profile_id and tournament_id = p_tournament_id
  ) then
    return false;
  end if;

  if not coalesce((select classe from tournaments where id = p_tournament_id), false) then
    raise exception 'TOURNOI_NON_CLASSE';
  end if;

  insert into ratings (profile_id, game_id, season_id)
  values (p_profile_id, p_game_id, p_season_id)
  on conflict (profile_id, game_id, season_id) do nothing;

  select rating, rd into v_actuel
  from ratings
  where profile_id = p_profile_id and game_id = p_game_id and season_id = p_season_id
  for update;

  if v_actuel.rating <> p_rating_avant or v_actuel.rd <> p_rd_avant then
    raise exception 'ETAT_DE_DEPART_PERIME';
  end if;

  insert into rating_events (
    profile_id, game_id, season_id, tournament_id, match_id, motif,
    rating_avant, rd_avant, rating_apres, rd_apres, adversaire_id
  ) values (
    p_profile_id, p_game_id, p_season_id, p_tournament_id, null, p_motif,
    p_rating_avant, p_rd_avant, p_rating_apres, p_rd_apres, null
  );

  update ratings set
    rating = p_rating_apres,
    rd = p_rd_apres,
    volatilite = p_volatilite_apres,
    matchs_joues = matchs_joues + p_matchs_comptes,
    maj_le = now()
  where profile_id = p_profile_id and game_id = p_game_id and season_id = p_season_id;

  return true;
end;
$$;
revoke execute on function public.cloturer_rating_joueur from public, anon, authenticated;

-- ---------- Forfait automatique (2026-09-28, audit N4) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (salle de match : bouton « Je suis prêt » ; tâche de recherche des
-- résultats : appliquer_forfait_absence).
-- Un joueur se déclare prêt dans la salle de match. Dès que l'un des deux
-- l'est, l'autre a 15 minutes pour faire de même ; sinon il perd par
-- forfait : verdict de niveau 1 (manuel, hors classement), match au statut
-- « forfait », aucun point pour personne (CLAUDE.md §4). Même délai que
-- src/lib/forfait.ts. Garde-fou côté serveur : jamais de forfait si l'un
-- des deux joueurs est en partie chez Riot à cet instant.
alter table public.match_participants add column if not exists pret_le timestamptz;

create or replace function public.declarer_pret(p_match_id uuid)
returns boolean -- true : déclaration enregistrée maintenant ; false : déjà prêt
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_statut public.match_status;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select statut into v_statut
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'MATCH_INTROUVABLE';
  end if;

  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and profile_id = v_joueur
  ) then
    raise exception 'NON_PARTICIPANT';
  end if;

  if (select count(*) from public.match_participants where match_id = p_match_id) <> 2 then
    raise exception 'ADVERSAIRE_ABSENT';
  end if;

  if v_statut <> 'en_cours'
     or exists (select 1 from public.match_verdicts where match_id = p_match_id and est_definitif) then
    raise exception 'MATCH_NON_OUVERT';
  end if;

  update public.match_participants
  set pret_le = now()
  where match_id = p_match_id and profile_id = v_joueur and pret_le is null;

  return found;
end;
$$;
revoke execute on function public.declarer_pret(uuid) from public, anon;
grant execute on function public.declarer_pret(uuid) to authenticated;

-- Forfait appliqué par la tâche de recherche (service_role uniquement).
-- Revérifie tout elle-même : match en cours sans verdict ni défaite
-- reconnue, exactement un joueur prêt, depuis 15 minutes au moins.
-- Renvoie le vainqueur, ou nul si rien n'est à trancher (idempotente).
create or replace function public.appliquer_forfait_absence(p_match_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_statut public.match_status;
  v_reconnue uuid;
  v_present uuid;
  v_pret timestamptz;
  v_absent uuid;
  v_pseudo text;
begin
  select statut, defaite_reconnue_par into v_statut, v_reconnue
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'MATCH_INTROUVABLE';
  end if;

  if v_statut <> 'en_cours' or v_reconnue is not null
     or exists (select 1 from public.match_verdicts where match_id = p_match_id and est_definitif)
     or (select count(*) from public.match_participants where match_id = p_match_id) <> 2
     or (select count(*) from public.match_participants where match_id = p_match_id and pret_le is not null) <> 1 then
    return null;
  end if;

  select profile_id, pret_le into v_present, v_pret
  from public.match_participants
  where match_id = p_match_id and pret_le is not null;

  if v_pret > now() - interval '15 minutes' then
    return null;
  end if;

  select profile_id into v_absent
  from public.match_participants
  where match_id = p_match_id and pret_le is null;

  select pseudo into v_pseudo from public.profiles where id = v_absent;

  insert into public.match_verdicts (match_id, niveau, gagnant_id, decide_par, motif, est_definitif)
  values (
    p_match_id,
    'manuel',
    v_present,
    null,
    'Forfait : ' || coalesce(v_pseudo, 'le joueur')
      || ' ne s''est pas déclaré prêt dans les 15 minutes suivant son adversaire.',
    true
  );

  perform public.avancer_vainqueur(p_match_id, v_present);
  update public.matches set statut = 'forfait' where id = p_match_id;
  return v_present;
end;
$$;
revoke all on function public.appliquer_forfait_absence(uuid) from public, anon, authenticated;
grant execute on function public.appliquer_forfait_absence(uuid) to service_role;

-- ---------- Conditions de victoire du 1v1 (2026-09-28, audit N5) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (création de tournoi et tâche de recherche des résultats lisent
-- condition_victoire).
-- « nexus » : la partie se gagne en détruisant le Nexus (ou par abandon du
-- perdant) — règle d'origine. « classique » : le premier qui obtient le
-- premier sang, détruit la première tour ou atteint 100 sbires gagne, lu
-- dans la chronologie Riot de la partie (src/lib/conditions-1v1.ts) ; en
-- cas d'ordre impossible à établir, la partie n'est pas retenue et
-- l'organisateur tranche. Réservé au 1v1, choisi à la création, figé
-- ensuite comme le format ou le Best-of.
alter table public.tournaments add column if not exists condition_victoire text not null default 'nexus';
alter table public.tournaments drop constraint if exists tournaments_condition_victoire_check;
alter table public.tournaments add constraint tournaments_condition_victoire_check
  check (condition_victoire in ('nexus', 'classique') and (condition_victoire = 'nexus' or format = '1v1'));

create or replace function public.controler_condition_victoire()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and new.condition_victoire is distinct from old.condition_victoire then
    raise exception 'CHAMP_NON_MODIFIABLE';
  end if;
  return new;
end;
$$;
revoke execute on function public.controler_condition_victoire() from public, anon, authenticated;

drop trigger if exists controle_condition_victoire on public.tournaments;
create trigger controle_condition_victoire
  before update on public.tournaments
  for each row execute function public.controler_condition_victoire();

-- ---------- Défis entre joueurs et « Invite ton rival » (2026-09-28, audit N16 et N18) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (bouton « Défier » du profil, défis de /moi, page /defi/[code]).
-- Un joueur défie un autre joueur en 1v1, en une partie (Bo1). Accepté, le
-- défi devient un mini-tournoi à deux (tournaments.nature = 'defi') : même
-- salle de match, même lecture du résultat chez Riot, même clôture. Il
-- compte au classement si la partie est retrouvée chez Riot, avec deux
-- plafonds : un seul défi classé par paire de joueurs et par 24 h (les
-- suivants se jouent en amical), et les plafonds habituels (3 victoires
-- contre le même adversaire en 24 h). Arbitre : le premier administrateur,
-- jamais l'un des deux joueurs (le verdict manuel reste hors de leur main).
-- « Invite ton rival » : un lien de défi pour un ami pas encore inscrit ; il
-- crée son compte, lie son Riot ID et accepte depuis le lien.
alter table public.tournaments add column if not exists nature text not null default 'tournoi';
alter table public.tournaments drop constraint if exists tournaments_nature_check;
alter table public.tournaments add constraint tournaments_nature_check check (nature in ('tournoi', 'defi'));
alter table public.tournaments drop constraint if exists tournaments_capacite_check;
alter table public.tournaments add constraint tournaments_capacite_check
  check (capacite in (4, 8, 16, 32, 64, 128) or (nature = 'defi' and capacite = 2));
create index if not exists tournaments_nature_idx on public.tournaments (nature, statut);

-- Un défi ne se crée que par les fonctions ci-dessous : un compte connecté
-- ne peut ni créer un tournoi « défi » ni changer la nature d'un tournoi.
create or replace function public.controler_nature_tournoi()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and (
       (tg_op = 'INSERT' and new.nature <> 'tournoi')
    or (tg_op = 'UPDATE' and new.nature is distinct from old.nature)) then
    raise exception 'CHAMP_RESERVE';
  end if;
  return new;
end;
$$;
revoke execute on function public.controler_nature_tournoi() from public, anon, authenticated;

drop trigger if exists controle_nature_tournoi on public.tournaments;
create trigger controle_nature_tournoi
  before insert or update on public.tournaments
  for each row execute function public.controler_nature_tournoi();

-- Critères « tournoi classé » (section du même nom), une colonne de plus :
-- un défi est classé sauf s'il se joue en amical.
drop function if exists public.criteres_tournoi_classe(uuid);
create or replace function public.criteres_tournoi_classe(p_tournament_id uuid)
returns table (
  officiel boolean,
  amical boolean,
  publie_a_temps boolean,
  joueurs_au_depart integer,
  organisateur_joue boolean,
  classe boolean,
  defi boolean
)
language sql
stable
set search_path = public
as $$
  select
    c.officiel,
    c.amical,
    c.publie_a_temps,
    c.joueurs,
    c.orga,
    not c.amical and (c.officiel or c.defi or (c.publie_a_temps and c.joueurs >= 8 and not c.orga)),
    c.defi
  from (
    select
      t.creneau_auto is not null as officiel,
      not t.compte_pour_classement as amical,
      coalesce(t.publie_le <= t.debute_le - interval '24 hours', false) as publie_a_temps,
      (select count(distinct mp.profile_id)::integer
         from public.matches m
         join public.match_participants mp on mp.match_id = m.id
        where m.tournament_id = t.id) as joueurs,
      exists (
        select 1 from public.matches m
        join public.match_participants mp on mp.match_id = m.id
        where m.tournament_id = t.id and mp.profile_id = t.organisateur_id
      ) or exists (
        select 1 from public.registrations r
        where r.tournament_id = t.id and r.profile_id = t.organisateur_id
          and r.statut in ('inscrit', 'confirme')
      ) as orga,
      t.nature = 'defi' as defi
    from public.tournaments t
    where t.id = p_tournament_id
  ) c;
$$;
revoke execute on function public.criteres_tournoi_classe(uuid) from public;
grant execute on function public.criteres_tournoi_classe(uuid) to anon, authenticated, service_role;

create table if not exists public.defis (
  id                 uuid primary key default gen_random_uuid(),
  lanceur_id         uuid not null references public.profiles(id) on delete cascade,
  adversaire_id      uuid references public.profiles(id) on delete cascade,
  -- Lien « Invite ton rival » : l'adversaire n'est connu qu'à l'acceptation.
  code_invitation    text unique,
  condition_victoire text not null default 'nexus' check (condition_victoire in ('nexus', 'classique')),
  statut             text not null default 'propose' check (statut in ('propose', 'accepte', 'refuse', 'annule')),
  tournament_id      uuid references public.tournaments(id) on delete set null,
  cree_le            timestamptz not null default now(),
  expire_le          timestamptz not null,
  repondu_le         timestamptz,
  check (adversaire_id is null or adversaire_id <> lanceur_id),
  check (adversaire_id is not null or code_invitation is not null)
);
create index if not exists defis_lanceur_idx on public.defis (lanceur_id, statut);
create index if not exists defis_adversaire_idx on public.defis (adversaire_id, statut);
create index if not exists defis_tournament_idx on public.defis (tournament_id);
alter table public.defis enable row level security;
create policy "un joueur voit ses defis" on public.defis
  for select using ((select auth.uid()) in (lanceur_id, adversaire_id));
revoke insert, update, delete on public.defis from anon, authenticated;

-- Région du compte Riot vérifié d'un joueur (compte principal LoL), ou nul.
create or replace function public.region_compte_verifie(p_profile_id uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select region from public.game_accounts
  where profile_id = p_profile_id and game_id = 1 and est_principal and verifie_le is not null;
$$;
revoke all on function public.region_compte_verifie(uuid) from public, anon, authenticated;

-- Contrôles communs au lanceur d'un défi ou d'une invitation.
create or replace function public.controler_lanceur_defi(p_joueur uuid, p_condition text)
returns text -- région du lanceur
language plpgsql
security definer set search_path = public
as $$
declare
  v_region text;
begin
  if p_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;
  if p_condition not in ('nexus', 'classique') then
    raise exception 'CONDITION_INVALIDE';
  end if;
  if exists (select 1 from public.suspensions where profile_id = p_joueur and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;
  v_region := public.region_compte_verifie(p_joueur);
  if v_region is null then
    raise exception 'COMPTE_RIOT_REQUIS';
  end if;
  -- Un défi à la fois par joueur (verrou), 5 propositions ouvertes au plus.
  perform 1 from public.profiles where id = p_joueur for update;
  if (select count(*) from public.defis
      where lanceur_id = p_joueur and statut = 'propose' and expire_le > now()) >= 5 then
    raise exception 'LIMITE_DEFIS';
  end if;
  return v_region;
end;
$$;
revoke all on function public.controler_lanceur_defi(uuid, text) from public, anon, authenticated;

create or replace function public.lancer_defi(p_adversaire_id uuid, p_condition text default 'nexus')
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_region text;
  v_region_adversaire text;
  v_id uuid;
begin
  if p_adversaire_id = v_joueur then
    raise exception 'DEFI_SOI_MEME';
  end if;
  v_region := public.controler_lanceur_defi(v_joueur, p_condition);

  if not exists (select 1 from public.profiles where id = p_adversaire_id and supprime_le is null) then
    raise exception 'JOUEUR_INTROUVABLE';
  end if;
  v_region_adversaire := public.region_compte_verifie(p_adversaire_id);
  if v_region_adversaire is null then
    raise exception 'ADVERSAIRE_SANS_COMPTE_RIOT';
  end if;
  if v_region_adversaire <> v_region then
    raise exception 'REGION_DIFFERENTE';
  end if;

  if exists (
    select 1 from public.defis
    where statut = 'propose' and expire_le > now()
      and ((lanceur_id = v_joueur and adversaire_id = p_adversaire_id)
        or (lanceur_id = p_adversaire_id and adversaire_id = v_joueur))
  ) then
    raise exception 'DEFI_DEJA_PROPOSE';
  end if;

  insert into public.defis (lanceur_id, adversaire_id, condition_victoire, expire_le)
  values (v_joueur, p_adversaire_id, p_condition, now() + interval '24 hours')
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.lancer_defi(uuid, text) from public, anon;
grant execute on function public.lancer_defi(uuid, text) to authenticated;

create or replace function public.creer_invitation_defi(p_condition text default 'nexus')
returns text -- code du lien
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_code text;
begin
  perform public.controler_lanceur_defi(v_joueur, p_condition);
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.defis (lanceur_id, code_invitation, condition_victoire, expire_le)
  values (v_joueur, v_code, p_condition, now() + interval '7 days');
  return v_code;
end;
$$;
revoke execute on function public.creer_invitation_defi(text) from public, anon;
grant execute on function public.creer_invitation_defi(text) to authenticated;

-- Page /defi/[code] : qui défie, dans quelle région, jusqu'à quand.
create or replace function public.lire_invitation_defi(p_code text)
returns table (
  lanceur_pseudo text, lanceur_slug text, region text, condition_victoire text,
  statut text, expire_le timestamptz, tournoi_slug text
)
language sql
stable
security definer set search_path = public
as $$
  select p.pseudo, p.slug, public.region_compte_verifie(d.lanceur_id), d.condition_victoire,
         d.statut, d.expire_le, t.slug
  from public.defis d
  join public.profiles p on p.id = d.lanceur_id
  left join public.tournaments t on t.id = d.tournament_id
  where d.code_invitation = p_code;
$$;
grant execute on function public.lire_invitation_defi(text) to anon, authenticated;

-- Le mini-tournoi d'un défi accepté. Interne : appelée par repondre_defi et
-- accepter_invitation_defi, jamais directement.
create or replace function public.creer_duel(p_defi_id uuid)
returns text -- adresse (slug) du duel
language plpgsql
security definer set search_path = public
as $$
declare
  v_defi record;
  v_region text;
  v_arbitre uuid;
  v_saison uuid;
  v_classe boolean;
  v_tournoi uuid;
  v_match uuid;
  v_slug text;
  v_pseudo_a text;
  v_pseudo_b text;
begin
  select * into v_defi from public.defis where id = p_defi_id for update;

  v_region := public.region_compte_verifie(v_defi.lanceur_id);
  if v_region is null or public.region_compte_verifie(v_defi.adversaire_id) is null then
    raise exception 'COMPTE_RIOT_REQUIS';
  end if;
  if public.region_compte_verifie(v_defi.adversaire_id) <> v_region then
    raise exception 'REGION_DIFFERENTE';
  end if;

  -- Trois défis en cours au plus par joueur.
  if exists (
    select 1 from (values (v_defi.lanceur_id), (v_defi.adversaire_id)) as j(id)
    where (select count(*) from public.registrations r
           join public.tournaments t on t.id = r.tournament_id
           where r.profile_id = j.id and t.nature = 'defi' and t.statut = 'en_cours') >= 3
  ) then
    raise exception 'TROP_DE_DEFIS_EN_COURS';
  end if;

  select profile_id into v_arbitre from public.admins order by ajoute_le, profile_id limit 1;
  if v_arbitre is null then
    raise exception 'AUCUN_ARBITRE';
  end if;

  select id into v_saison from public.seasons where game_id = 1 and est_courante;

  -- Un seul défi classé par paire et par 24 h : les suivants en amical.
  v_classe := not exists (
    select 1 from public.tournaments t
    where t.nature = 'defi' and t.compte_pour_classement and t.cree_le > now() - interval '24 hours'
      and exists (select 1 from public.registrations r where r.tournament_id = t.id and r.profile_id = v_defi.lanceur_id)
      and exists (select 1 from public.registrations r where r.tournament_id = t.id and r.profile_id = v_defi.adversaire_id)
  );

  select pseudo into v_pseudo_a from public.profiles where id = v_defi.lanceur_id;
  select pseudo into v_pseudo_b from public.profiles where id = v_defi.adversaire_id;
  v_slug := 'defi-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

  insert into public.tournaments (
    game_id, season_id, organisateur_id, slug, nom, format, type_bracket, best_of, capacite,
    region, compte_pour_classement, debute_le, checkin_ouvre_le, statut, condition_victoire, nature
  ) values (
    1, v_saison, v_arbitre, v_slug, 'Défi ' || v_pseudo_a || ' contre ' || v_pseudo_b, '1v1', 'elim_simple', 1, 2,
    v_region, v_classe, now(), now(), 'en_cours', v_defi.condition_victoire, 'defi'
  ) returning id into v_tournoi;

  insert into public.registrations (tournament_id, profile_id, statut, confirme_le, seed) values
    (v_tournoi, v_defi.lanceur_id, 'confirme', now(), 1),
    (v_tournoi, v_defi.adversaire_id, 'confirme', now(), 2);

  insert into public.matches (tournament_id, tour, position, statut, demarre_le)
  values (v_tournoi, 1, 1, 'en_cours', now())
  returning id into v_match;

  insert into public.match_participants (match_id, profile_id, slot) values
    (v_match, v_defi.lanceur_id, 1),
    (v_match, v_defi.adversaire_id, 2);

  update public.defis
  set statut = 'accepte', repondu_le = now(), tournament_id = v_tournoi
  where id = p_defi_id;

  return v_slug;
end;
$$;
revoke all on function public.creer_duel(uuid) from public, anon, authenticated;

-- Réponse du joueur défié. Renvoie l'adresse du duel s'il accepte.
create or replace function public.repondre_defi(p_defi_id uuid, p_accepte boolean)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_defi record;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select * into v_defi from public.defis where id = p_defi_id for update;
  if not found then
    raise exception 'DEFI_INTROUVABLE';
  end if;
  if v_defi.adversaire_id is distinct from v_joueur then
    raise exception 'NON_DESTINATAIRE';
  end if;
  if v_defi.statut <> 'propose' then
    raise exception 'DEFI_DEJA_TRAITE';
  end if;
  if v_defi.expire_le <= now() then
    raise exception 'DEFI_EXPIRE';
  end if;

  if not p_accepte then
    update public.defis set statut = 'refuse', repondu_le = now() where id = p_defi_id;
    return null;
  end if;
  return public.creer_duel(p_defi_id);
end;
$$;
revoke execute on function public.repondre_defi(uuid, boolean) from public, anon;
grant execute on function public.repondre_defi(uuid, boolean) to authenticated;

-- Acceptation d'un lien « Invite ton rival ».
create or replace function public.accepter_invitation_defi(p_code text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_defi record;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select * into v_defi from public.defis where code_invitation = p_code for update;
  if not found then
    raise exception 'DEFI_INTROUVABLE';
  end if;
  if v_defi.lanceur_id = v_joueur then
    raise exception 'DEFI_SOI_MEME';
  end if;
  if v_defi.statut <> 'propose' or v_defi.adversaire_id is not null then
    raise exception 'DEFI_DEJA_TRAITE';
  end if;
  if v_defi.expire_le <= now() then
    raise exception 'DEFI_EXPIRE';
  end if;

  update public.defis set adversaire_id = v_joueur where id = v_defi.id;
  return public.creer_duel(v_defi.id);
end;
$$;
revoke execute on function public.accepter_invitation_defi(text) from public, anon;
grant execute on function public.accepter_invitation_defi(text) to authenticated;

-- Le lanceur retire un défi (ou une invitation) pas encore accepté.
create or replace function public.annuler_defi(p_defi_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update public.defis set statut = 'annule', repondu_le = now()
  where id = p_defi_id and lanceur_id = auth.uid() and statut = 'propose';
  return found;
end;
$$;
revoke execute on function public.annuler_defi(uuid) from public, anon;
grant execute on function public.annuler_defi(uuid) to authenticated;

-- ---------- Modération automatique (2026-10-02, audit N27) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (messages d'erreur PSEUDO_INTERDIT, NOM_INTERDIT, TEXTE_INTERDIT,
-- MESSAGE_INTERDIT, MOTIF_INTERDIT ; file de modération de /admin).
-- Tout texte saisi par un joueur passe par analyser_texte avant d'être
-- enregistré : insultes, propos haineux, menaces, arnaques, liens, et
-- usurpation (« Najarena_Admin », « Modo »…). Le texte est d'abord
-- « déguisé à l'envers » : accents retirés, chiffres lus comme des lettres
-- (« s4lope »), lettres séparées (« c.o.n.n.a.r.d ») ou répétées
-- (« connnard »), mots collés séparés aux majuscules (« NajarenaAdmin »).
-- Trois contextes :
-- - nom (pseudo, équipe, tag, nom de tournoi) : tout terme refusé ;
-- - texte_public (description d'équipe, rôle, annonce, bio) : tout sauf
--   l'usurpation ;
-- - prive (message, motif de litige) : haine et arnaques refusées ;
--   insultes, menaces et liens relus par un administrateur (un message
--   relu n'est remis qu'après validation) ; le reste passe.
-- La liste des termes n'est lisible par personne (la publier aiderait à la
-- contourner) ; elle se complète par l'éditeur SQL de Supabase.
create table if not exists public.moderation_termes (
  terme     text primary key,
  categorie text not null check (categorie in ('haine', 'menace', 'arnaque', 'insulte', 'grossier', 'usurpation')),
  -- fragment : n'importe où dans le texte compacté ; mot : mot entier
  -- (pour les termes courts, qui feraient sinon des faux positifs).
  mode      text not null default 'fragment' check (mode in ('fragment', 'mot'))
);
alter table public.moderation_termes enable row level security;
revoke all on public.moderation_termes from anon, authenticated;

insert into public.moderation_termes (terme, categorie, mode) values
  ('nigger', 'haine', 'fragment'), ('nigga', 'haine', 'fragment'), ('negre', 'haine', 'mot'),
  ('negro', 'haine', 'mot'), ('bougnoul', 'haine', 'fragment'), ('youpin', 'haine', 'fragment'),
  ('chinetoque', 'haine', 'fragment'), ('bicot', 'haine', 'mot'), ('tarlouze', 'haine', 'fragment'),
  ('tapette', 'haine', 'mot'), ('pede', 'haine', 'mot'), ('pd', 'haine', 'mot'),
  ('faggot', 'haine', 'fragment'), ('fag', 'haine', 'mot'), ('gouine', 'haine', 'mot'),
  ('nazi', 'haine', 'mot'), ('hitler', 'haine', 'fragment'), ('heil', 'haine', 'mot'), ('kkk', 'haine', 'mot'),
  ('killyourself', 'haine', 'fragment'), ('kys', 'haine', 'mot'), ('suicidetoi', 'haine', 'fragment'),
  ('tuetoi', 'haine', 'fragment'),
  ('jevaistetuer', 'menace', 'fragment'), ('jesaisoutuhabites', 'menace', 'fragment'),
  ('jevaistetrouver', 'menace', 'fragment'),
  ('nitrogratuit', 'arnaque', 'fragment'), ('freenitro', 'arnaque', 'fragment'),
  ('rpgratuit', 'arnaque', 'fragment'), ('freerp', 'arnaque', 'fragment'),
  ('riotpointsgratuit', 'arnaque', 'fragment'),
  ('connard', 'insulte', 'fragment'), ('connasse', 'insulte', 'fragment'), ('salope', 'insulte', 'fragment'),
  ('salaud', 'insulte', 'fragment'), ('encule', 'insulte', 'fragment'), ('enfoire', 'insulte', 'fragment'),
  ('batard', 'insulte', 'fragment'), ('abruti', 'insulte', 'fragment'), ('fdp', 'insulte', 'mot'),
  ('ntm', 'insulte', 'mot'), ('nique', 'insulte', 'mot'), ('niquer', 'insulte', 'mot'),
  ('pute', 'insulte', 'mot'), ('putes', 'insulte', 'mot'), ('catin', 'insulte', 'mot'),
  ('trisomique', 'insulte', 'fragment'), ('retard', 'insulte', 'mot'), ('fuck', 'insulte', 'fragment'),
  ('bitch', 'insulte', 'fragment'), ('cunt', 'insulte', 'mot'), ('whore', 'insulte', 'fragment'),
  ('slut', 'insulte', 'mot'), ('asshole', 'insulte', 'fragment'), ('dickhead', 'insulte', 'fragment'),
  ('merde', 'grossier', 'fragment'), ('putain', 'grossier', 'fragment'), ('bordel', 'grossier', 'mot'),
  ('chier', 'grossier', 'mot'), ('shit', 'grossier', 'mot'), ('couille', 'grossier', 'fragment'),
  ('cul', 'grossier', 'mot'), ('teube', 'grossier', 'mot'), ('pussy', 'grossier', 'fragment'),
  ('cock', 'grossier', 'mot'), ('porno', 'grossier', 'mot'), ('sexe', 'grossier', 'mot'),
  ('cretin', 'grossier', 'mot'), ('debile', 'grossier', 'mot'),
  ('najarena', 'usurpation', 'fragment'), ('admin', 'usurpation', 'mot'), ('admins', 'usurpation', 'mot'),
  ('administrateur', 'usurpation', 'fragment'), ('administration', 'usurpation', 'fragment'),
  ('modo', 'usurpation', 'mot'), ('modos', 'usurpation', 'mot'), ('moderateur', 'usurpation', 'fragment'),
  ('moderatrice', 'usurpation', 'fragment'), ('moderation', 'usurpation', 'fragment'),
  ('moderator', 'usurpation', 'fragment'), ('staff', 'usurpation', 'mot'), ('officiel', 'usurpation', 'mot'),
  ('officielle', 'usurpation', 'mot'), ('official', 'usurpation', 'mot'), ('riot', 'usurpation', 'mot'),
  ('riotgames', 'usurpation', 'fragment')
on conflict (terme) do nothing;

-- Texte « déguisé à l'envers » : minuscules, sans accents, chiffres et
-- symboles lus comme des lettres, mots collés séparés aux majuscules.
create or replace function public.normaliser_moderation(p_texte text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(
    lower(regexp_replace(p_texte, '([a-z])([A-Z])', '\1 \2', 'g')),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ0134578@$!|',
    'aaaaaaceeeeiiiinooooouuuuyyoieastbasii'
  );
$$;

-- Verdict sur un texte : nul s'il passe, « revue:<catégorie> » s'il doit
-- être relu, « refus:<catégorie> » s'il est refusé.
create or replace function public.analyser_texte(p_texte text, p_contexte text)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_normal text;
  v_compact text;
  v_mots text[];
  v_rang int := 0; -- 0 : passe ; 1 : à relire ; 2 : refusé
  v_categorie text;
  v_niveau int;
  r record;
begin
  if p_texte is null or btrim(p_texte) = '' then
    return null;
  end if;
  if p_contexte not in ('nom', 'texte_public', 'prive') then
    raise exception 'CONTEXTE_INVALIDE';
  end if;

  v_normal := public.normaliser_moderation(p_texte);
  v_compact := regexp_replace(regexp_replace(v_normal, '[^a-z]', '', 'g'), '(.)\1+', '\1', 'g');
  select coalesce(array_agg(regexp_replace(m, '(.)\1+', '\1', 'g')), '{}')
  into v_mots
  from regexp_split_to_table(v_normal, '[^a-z]+') as m
  where m <> '';

  for r in
    select categorie, mode, regexp_replace(terme, '(.)\1+', '\1', 'g') as forme
    from public.moderation_termes
  loop
    if (r.mode = 'fragment' and position(r.forme in v_compact) > 0)
       or (r.mode = 'mot' and r.forme = any(v_mots)) then
      v_niveau := case
        when r.categorie in ('haine', 'arnaque') then 2
        when p_contexte = 'nom' then 2
        when p_contexte = 'texte_public' then case when r.categorie = 'usurpation' then 0 else 2 end
        when r.categorie in ('insulte', 'menace') then 1
        else 0
      end;
      if v_niveau > v_rang then
        v_rang := v_niveau;
        v_categorie := r.categorie;
      end if;
    end if;
  end loop;

  -- Liens : refusés dans un nom ou un texte public, relus dans un message.
  if v_rang < 2 and p_texte ~* '(https?://|www\.|discord\.gg/|[a-z0-9-]+\.(com|fr|net|org|gg|io|xyz|ru|ly|me|tk|co|be|ch|info|biz|link|app|site|online)(/|\s|$))' then
    v_niveau := case when p_contexte = 'prive' then 1 else 2 end;
    if v_niveau > v_rang then
      v_rang := v_niveau;
      v_categorie := 'lien';
    end if;
  end if;

  return case v_rang when 2 then 'refus:' || v_categorie when 1 then 'revue:' || v_categorie end;
end;
$$;
revoke all on function public.analyser_texte(text, text) from public, anon, authenticated;
revoke all on function public.normaliser_moderation(text) from public, anon, authenticated;

-- Contrôle avant envoi d'un formulaire (inscription : un pseudo refusé
-- serait sinon remplacé en silence par un pseudo automatique).
create or replace function public.texte_acceptable(p_texte text, p_contexte text default 'nom')
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.analyser_texte(p_texte, p_contexte), '') not like 'refus:%';
$$;
grant execute on function public.texte_acceptable(text, text) to anon, authenticated;

-- File de modération : textes à relire, visibles des administrateurs.
create table if not exists public.moderation_signalements (
  id          uuid primary key default gen_random_uuid(),
  contexte    text not null check (contexte in ('message', 'litige')),
  cible_id    uuid not null,
  auteur_id   uuid references public.profiles(id) on delete set null,
  extrait     text not null,
  raison      text not null,
  statut      text not null default 'a_examiner' check (statut in ('a_examiner', 'valide', 'rejete')),
  cree_le     timestamptz not null default now(),
  traite_par  uuid references public.profiles(id) on delete set null,
  traite_le   timestamptz
);
create index if not exists moderation_signalements_statut_idx on public.moderation_signalements (statut, cree_le);
create index if not exists moderation_signalements_auteur_idx on public.moderation_signalements (auteur_id);
create index if not exists moderation_signalements_traite_par_idx on public.moderation_signalements (traite_par);
alter table public.moderation_signalements enable row level security;
create policy "admins voient la file de moderation" on public.moderation_signalements
  for select using (exists (select 1 from public.admins where profile_id = (select auth.uid())));
revoke insert, update, delete on public.moderation_signalements from anon, authenticated;

-- Message relu avant d'être remis : son destinataire ne le voit qu'après
-- validation (son auteur, si).
alter table public.messages add column if not exists en_revue boolean not null default false;
alter policy "participants lisent les messages" on public.messages
  using (
    (expediteur_id = (select auth.uid()) or not en_revue)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (select auth.uid()) in (c.profile_a, c.profile_b)
    )
  );

-- Pseudo : refusé à la modification ; à l'inscription, remplacé par un
-- pseudo automatique (le compte se crée quand même, le joueur choisira).
create or replace function public.moderer_pseudo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.pseudo is not distinct from old.pseudo then
    return new;
  end if;
  if coalesce(public.analyser_texte(new.pseudo, 'nom'), '') like 'refus:%' then
    if tg_op = 'UPDATE' then
      raise exception 'PSEUDO_INTERDIT';
    end if;
    new.pseudo := 'Joueur-' || substr(new.id::text, 1, 8);
    new.slug := lower(new.pseudo);
    if exists (select 1 from public.anciens_slugs where slug = new.slug) then
      new.pseudo := 'Joueur-' || substr(new.id::text, 25, 8);
      new.slug := lower(new.pseudo);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_pseudo() from public, anon, authenticated;
drop trigger if exists moderation_pseudo on public.profiles;
create trigger moderation_pseudo
  before insert or update of pseudo on public.profiles
  for each row execute function public.moderer_pseudo();

-- Équipes : nom et tag (noms), description (texte public).
create or replace function public.moderer_equipe()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(public.analyser_texte(new.nom, 'nom'), '') like 'refus:%'
     or coalesce(public.analyser_texte(new.tag, 'nom'), '') like 'refus:%' then
    raise exception 'NOM_INTERDIT';
  end if;
  if coalesce(public.analyser_texte(new.description, 'texte_public'), '') like 'refus:%'
     or coalesce(public.analyser_texte(new.contact_recrutement, 'prive'), '') like 'refus:%' then
    raise exception 'TEXTE_INTERDIT';
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_equipe() from public, anon, authenticated;
drop trigger if exists moderation_equipe on public.teams;
create trigger moderation_equipe
  before insert or update of nom, tag, description, contact_recrutement on public.teams
  for each row execute function public.moderer_equipe();

-- Rôle affiché sur la page d'équipe (texte public).
create or replace function public.moderer_role_equipe()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(public.analyser_texte(new.role, 'texte_public'), '') like 'refus:%' then
    raise exception 'TEXTE_INTERDIT';
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_role_equipe() from public, anon, authenticated;
drop trigger if exists moderation_role_equipe on public.team_members;
create trigger moderation_role_equipe
  before insert or update of role on public.team_members
  for each row execute function public.moderer_role_equipe();

-- Nom de tournoi d'organisateur (les tournois officiels et les défis
-- portent un nom écrit par la base ou le serveur).
create or replace function public.moderer_tournoi()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.creneau_auto is null and new.nature = 'tournoi'
     and coalesce(public.analyser_texte(new.nom, 'nom'), '') like 'refus:%' then
    raise exception 'NOM_INTERDIT';
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_tournoi() from public, anon, authenticated;
drop trigger if exists moderation_tournoi on public.tournaments;
create trigger moderation_tournoi
  before insert or update of nom on public.tournaments
  for each row execute function public.moderer_tournoi();

-- Annonce « cherche une équipe » et bio du profil (textes publics).
create or replace function public.moderer_annonce()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(public.analyser_texte(new.message, 'texte_public'), '') like 'refus:%' then
    raise exception 'TEXTE_INTERDIT';
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_annonce() from public, anon, authenticated;
drop trigger if exists moderation_annonce on public.recherches_coequipiers;
create trigger moderation_annonce
  before insert or update of message on public.recherches_coequipiers
  for each row execute function public.moderer_annonce();

create or replace function public.moderer_bio()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(public.analyser_texte(new.bio, 'texte_public'), '') like 'refus:%' then
    raise exception 'TEXTE_INTERDIT';
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_bio() from public, anon, authenticated;
drop trigger if exists moderation_bio on public.comptes_offres;
create trigger moderation_bio
  before insert or update of bio on public.comptes_offres
  for each row execute function public.moderer_bio();

-- Messages privés : refusés, ou mis en revue (remis après validation).
create or replace function public.moderer_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_verdict text := public.analyser_texte(new.contenu, 'prive');
begin
  if v_verdict like 'refus:%' then
    raise exception 'MESSAGE_INTERDIT';
  end if;
  new.en_revue := v_verdict is not null;
  if new.en_revue then
    insert into public.moderation_signalements (contexte, cible_id, auteur_id, extrait, raison)
    values ('message', new.id, new.expediteur_id, left(new.contenu, 300), substr(v_verdict, 7));
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_message() from public, anon, authenticated;
drop trigger if exists moderation_message on public.messages;
create trigger moderation_message
  before insert on public.messages
  for each row execute function public.moderer_message();

-- Motif de litige : refusé, ou signalé à l'administrateur (il reste lisible
-- de l'organisateur, qui doit pouvoir trancher).
create or replace function public.moderer_litige()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_verdict text := public.analyser_texte(new.motif, 'prive');
begin
  if v_verdict like 'refus:%' then
    raise exception 'MOTIF_INTERDIT';
  end if;
  if v_verdict is not null then
    insert into public.moderation_signalements (contexte, cible_id, auteur_id, extrait, raison)
    values ('litige', new.id, new.ouvert_par, left(new.motif, 300), substr(v_verdict, 7));
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_litige() from public, anon, authenticated;
drop trigger if exists moderation_litige on public.disputes;
create trigger moderation_litige
  before insert on public.disputes
  for each row execute function public.moderer_litige();

-- Décision d'un administrateur sur un texte relu. Un message validé est
-- remis à son destinataire ; rejeté, il ne l'est jamais.
create or replace function public.traiter_signalement(p_signalement_id uuid, p_valide boolean)
returns text -- contexte du texte traité
language plpgsql
security definer set search_path = public
as $$
declare
  v_signalement record;
begin
  if not exists (select 1 from public.admins where profile_id = auth.uid()) then
    raise exception 'NON_AUTORISE';
  end if;
  update public.moderation_signalements
  set statut = case when p_valide then 'valide' else 'rejete' end, traite_par = auth.uid(), traite_le = now()
  where id = p_signalement_id and statut = 'a_examiner'
  returning * into v_signalement;
  if not found then
    raise exception 'SIGNALEMENT_DEJA_TRAITE';
  end if;
  if p_valide and v_signalement.contexte = 'message' then
    update public.messages set en_revue = false where id = v_signalement.cible_id;
  end if;
  return v_signalement.contexte;
end;
$$;
revoke execute on function public.traiter_signalement(uuid, boolean) from public, anon;
grant execute on function public.traiter_signalement(uuid, boolean) to authenticated;

-- ---------- Tournois 5v5 : inscription d'une équipe (2026-10-03, audit N21) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (format 5v5 à la création d'un tournoi, inscription d'équipe sur la page
-- du tournoi, salle de match à dix).
-- Une équipe s'inscrit par son capitaine, avec cinq de ses membres (lui
-- compris) : l'« alignement ». Chacun a un compte Riot vérifié dans la
-- région du tournoi et ne joue que pour une équipe par tournoi. Dans le
-- bracket, l'équipe est représentée par son capitaine
-- (match_participants.profile_id) : bracket, verdicts et clôture restent
-- les mêmes qu'en 1v1. Le capitaine fait le check-in, se déclare prêt,
-- reconnaît une défaite ou signale un litige au nom de l'équipe.
-- Un résultat n'est retenu que si les dix joueurs alignés sont dans la
-- partie personnalisée, chaque équipe de son côté (src/lib/rapprochement.ts).
-- Hors classement individuel : le rating Glicko-2 mesure un joueur seul, un
-- résultat d'équipe ne le modifie pas. Les résultats vérifiés vont au
-- palmarès de l'équipe et aux statistiques de chaque joueur aligné.
-- Départs : quitter l'équipe pendant les inscriptions retire le joueur de
-- l'alignement (le capitaine le complète avant le check-in) ; pendant le
-- check-in et le tournoi, c'est refusé. Une équipe inscrite ne peut pas
-- être supprimée. Un joueur suspendu est retiré des alignements des
-- tournois pas encore commencés.
alter table public.tournaments drop constraint if exists tournaments_format_valide;
alter table public.tournaments add constraint tournaments_format_valide check (format in ('1v1', '5v5'));
alter table public.tournaments drop constraint if exists tournaments_5v5_hors_classement;
alter table public.tournaments add constraint tournaments_5v5_hors_classement
  check (format = '1v1' or not compte_pour_classement);
alter table public.tournaments drop constraint if exists tournaments_defi_en_1v1;
alter table public.tournaments add constraint tournaments_defi_en_1v1
  check (nature = 'tournoi' or format = '1v1');

-- Nom et tag figés à l'inscription : le bracket garde le nom de l'équipe
-- même si elle est supprimée ensuite (team_id passe alors à nul).
alter table public.registrations add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.registrations add column if not exists equipe_nom text;
alter table public.registrations add column if not exists equipe_tag text;
create unique index if not exists registrations_une_inscription_par_equipe
  on public.registrations (tournament_id, team_id) where team_id is not null;
create index if not exists registrations_team_id_idx on public.registrations (team_id);

create table if not exists public.alignements (
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  aligne_le       timestamptz not null default now(),
  primary key (tournament_id, profile_id)
);
create index if not exists alignements_registration_id_idx on public.alignements (registration_id);
create index if not exists alignements_profile_id_idx on public.alignements (profile_id);
alter table public.alignements enable row level security;
create policy "alignements lisibles par tous" on public.alignements for select using (true);
revoke insert, update, delete on public.alignements from anon, authenticated;

-- Cinq joueurs d'une équipe, capitaine compris : membres acceptés, compte
-- Riot vérifié dans la région, aucun suspendu. Renvoie les cinq, sans
-- doublon. Partagée par les tournois 5v5 et les scrims.
create or replace function public.verifier_alignement(
  p_team_id uuid, p_capitaine uuid, p_joueurs uuid[], p_region text, p_game_id smallint
)
returns uuid[]
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_joueurs uuid[];
begin
  select coalesce(array_agg(distinct j), '{}') into v_joueurs
  from unnest(p_joueurs) j where j is not null;

  if cardinality(v_joueurs) <> 5 then
    raise exception 'ALIGNEMENT_DE_CINQ';
  end if;
  if not (p_capitaine = any (v_joueurs)) then
    raise exception 'CAPITAINE_DANS_ALIGNEMENT';
  end if;
  if (select count(*) from public.team_members
      where team_id = p_team_id and profile_id = any (v_joueurs) and accepte_le is not null) <> 5 then
    raise exception 'JOUEUR_HORS_EQUIPE';
  end if;
  if (select count(*) from public.game_accounts
      where profile_id = any (v_joueurs) and game_id = p_game_id and est_principal
        and verifie_le is not null and region = p_region) <> 5 then
    raise exception 'ALIGNEMENT_COMPTE_RIOT';
  end if;
  if exists (select 1 from public.suspensions where profile_id = any (v_joueurs) and levee_le is null) then
    raise exception 'ALIGNEMENT_SUSPENDU';
  end if;
  return v_joueurs;
end;
$$;
revoke all on function public.verifier_alignement(uuid, uuid, uuid[], text, smallint) from public, anon, authenticated;

-- Vérifie et enregistre l'alignement d'une inscription d'équipe ; renvoie
-- le rating moyen des cinq joueurs (têtes de série), nul si aucun n'a de
-- rating cette saison. Appelée par s_inscrire_equipe et
-- modifier_alignement, tournoi déjà verrouillé.
create or replace function public.enregistrer_alignement(
  p_tournament_id uuid, p_team_id uuid, p_capitaine uuid, p_joueurs uuid[], p_registration_id uuid
)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_tournoi record;
  v_joueurs uuid[];
  v_rating int;
begin
  select region, game_id, season_id into v_tournoi
  from public.tournaments where id = p_tournament_id;

  v_joueurs := public.verifier_alignement(p_team_id, p_capitaine, p_joueurs, v_tournoi.region, v_tournoi.game_id);

  if exists (
    select 1 from public.alignements
    where tournament_id = p_tournament_id and profile_id = any (v_joueurs)
      and registration_id <> p_registration_id
  ) then
    raise exception 'JOUEUR_DEJA_ALIGNE';
  end if;

  select round(avg(r.rating))::int into v_rating
  from public.ratings r
  where r.profile_id = any (v_joueurs)
    and r.game_id = v_tournoi.game_id
    and r.season_id = coalesce(
      v_tournoi.season_id,
      (select s.id from public.seasons s where s.game_id = v_tournoi.game_id and s.est_courante limit 1)
    );

  delete from public.alignements where registration_id = p_registration_id;
  insert into public.alignements (tournament_id, profile_id, registration_id)
  select p_tournament_id, j, p_registration_id from unnest(v_joueurs) j;

  return v_rating;
end;
$$;
revoke all on function public.enregistrer_alignement(uuid, uuid, uuid, uuid[], uuid) from public, anon, authenticated;

-- Inscription d'une équipe par son capitaine (seule porte d'entrée d'un
-- tournoi 5v5). Réactive une inscription retirée, comme en 1v1.
create or replace function public.s_inscrire_equipe(p_tournament_id uuid, p_team_id uuid, p_joueurs uuid[])
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_capitaine uuid := auth.uid();
  v_tournoi record;
  v_equipe record;
  v_existante_id uuid;
  v_existante_statut public.registration_status;
  v_id uuid;
begin
  if v_capitaine is null then
    raise exception 'NON_CONNECTE';
  end if;

  select id, statut, capacite, format, game_id into v_tournoi
  from public.tournaments where id = p_tournament_id
  for update;
  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;
  if v_tournoi.format <> '5v5' then
    raise exception 'TOURNOI_EN_SOLO';
  end if;
  if v_tournoi.statut <> 'ouvert' then
    raise exception 'INSCRIPTIONS_FERMEES';
  end if;

  select id, nom, tag, capitaine_id, game_id into v_equipe
  from public.teams where id = p_team_id;
  if not found or v_equipe.capitaine_id <> v_capitaine then
    raise exception 'CAPITAINE_REQUIS';
  end if;
  if v_equipe.game_id <> v_tournoi.game_id then
    raise exception 'EQUIPE_AUTRE_JEU';
  end if;

  select id, statut into v_existante_id, v_existante_statut
  from public.registrations
  where tournament_id = p_tournament_id and profile_id = v_capitaine;
  if v_existante_id is not null and v_existante_statut <> 'retire' then
    raise exception 'DEJA_INSCRIT';
  end if;

  if (select count(*) from public.registrations
      where tournament_id = p_tournament_id and statut <> 'retire') >= v_tournoi.capacite then
    raise exception 'TOURNOI_COMPLET';
  end if;

  if v_existante_id is not null then
    update public.registrations
    set statut = 'inscrit', inscrit_le = now(), confirme_le = null, seed = null,
        team_id = v_equipe.id, equipe_nom = v_equipe.nom, equipe_tag = v_equipe.tag
    where id = v_existante_id;
    v_id := v_existante_id;
  else
    insert into public.registrations (tournament_id, profile_id, team_id, equipe_nom, equipe_tag)
    values (p_tournament_id, v_capitaine, v_equipe.id, v_equipe.nom, v_equipe.tag)
    returning id into v_id;
  end if;

  update public.registrations
  set rating_a_inscription = public.enregistrer_alignement(p_tournament_id, v_equipe.id, v_capitaine, p_joueurs, v_id)
  where id = v_id;

  return v_id;
end;
$$;
revoke execute on function public.s_inscrire_equipe(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.s_inscrire_equipe(uuid, uuid, uuid[]) to authenticated;

-- Le capitaine change ses cinq joueurs jusqu'au lancement du bracket.
create or replace function public.modifier_alignement(p_tournament_id uuid, p_joueurs uuid[])
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_capitaine uuid := auth.uid();
  v_statut public.tournament_status;
  v_inscription record;
begin
  if v_capitaine is null then
    raise exception 'NON_CONNECTE';
  end if;

  select statut into v_statut from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;
  if v_statut not in ('ouvert', 'checkin') then
    raise exception 'ALIGNEMENT_FIGE';
  end if;

  select id, team_id into v_inscription
  from public.registrations
  where tournament_id = p_tournament_id and profile_id = v_capitaine
    and statut in ('inscrit', 'confirme') and team_id is not null;
  if not found then
    raise exception 'EQUIPE_NON_INSCRITE';
  end if;

  update public.registrations
  set rating_a_inscription = public.enregistrer_alignement(p_tournament_id, v_inscription.team_id, v_capitaine, p_joueurs, v_inscription.id)
  where id = v_inscription.id;
  return true;
end;
$$;
revoke execute on function public.modifier_alignement(uuid, uuid[]) from public, anon;
grant execute on function public.modifier_alignement(uuid, uuid[]) to authenticated;

-- 1v1 : inscription individuelle, refusée dans un tournoi par équipes.
create or replace function public.s_inscrire_tournoi(p_tournament_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_tournoi record;
  v_compte record;
  v_existante_id uuid;
  v_existante_statut public.registration_status;
  v_inscrits int;
  v_rating int;
  v_id uuid;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select id, statut, capacite, game_id, season_id, region, format
  into v_tournoi
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;

  if v_tournoi.format <> '1v1' then
    raise exception 'TOURNOI_PAR_EQUIPES';
  end if;

  if v_tournoi.statut <> 'ouvert' then
    raise exception 'INSCRIPTIONS_FERMEES';
  end if;

  select id, statut
  into v_existante_id, v_existante_statut
  from public.registrations
  where tournament_id = p_tournament_id and profile_id = v_joueur;

  if v_existante_id is not null and v_existante_statut <> 'retire' then
    raise exception 'DEJA_INSCRIT';
  end if;

  select count(*) into v_inscrits
  from public.registrations
  where tournament_id = p_tournament_id and statut <> 'retire';

  if v_inscrits >= v_tournoi.capacite then
    raise exception 'TOURNOI_COMPLET';
  end if;

  select region, verifie_le
  into v_compte
  from public.game_accounts
  where profile_id = v_joueur and game_id = v_tournoi.game_id and est_principal;

  if not found or v_compte.verifie_le is null then
    raise exception 'COMPTE_RIOT_REQUIS';
  end if;

  if v_compte.region <> v_tournoi.region then
    raise exception 'REGION_DIFFERENTE';
  end if;

  select round(r.rating)::int
  into v_rating
  from public.ratings r
  where r.profile_id = v_joueur
    and r.game_id = v_tournoi.game_id
    and r.season_id = coalesce(
      v_tournoi.season_id,
      (select s.id from public.seasons s where s.game_id = v_tournoi.game_id and s.est_courante limit 1)
    );

  if v_existante_id is not null then
    update public.registrations
    set statut = 'inscrit', inscrit_le = now(), confirme_le = null, seed = null, rating_a_inscription = v_rating
    where id = v_existante_id;
    return v_existante_id;
  end if;

  insert into public.registrations (tournament_id, profile_id, rating_a_inscription)
  values (p_tournament_id, v_joueur, v_rating)
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.s_inscrire_tournoi(uuid) from public, anon;
grant execute on function public.s_inscrire_tournoi(uuid) to authenticated;

-- Check-in d'une équipe : l'alignement doit être complet (un joueur a pu
-- quitter l'équipe ou être suspendu depuis l'inscription).
create or replace function public.confirmer_presence(p_tournament_id uuid)
returns boolean -- faux : aucune inscription en attente de check-in
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_statut public.tournament_status;
  v_checkin timestamptz;
  v_format text;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;

  select statut, checkin_ouvre_le, format
  into v_statut, v_checkin, v_format
  from public.tournaments
  where id = p_tournament_id
  for share;

  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;

  if not (v_statut = 'checkin' or (v_statut = 'ouvert' and v_checkin <= now())) then
    raise exception 'CHECKIN_FERME';
  end if;

  if v_format = '5v5' and (
    select count(*)
    from public.alignements a
    join public.registrations r on r.id = a.registration_id
    where r.tournament_id = p_tournament_id and r.profile_id = v_joueur and r.statut = 'inscrit'
  ) not in (0, 5) then
    raise exception 'ALIGNEMENT_INCOMPLET';
  end if;

  update public.registrations
  set statut = 'confirme', confirme_le = now()
  where tournament_id = p_tournament_id
    and profile_id = v_joueur
    and statut = 'inscrit'
    and (v_format = '1v1' or exists (select 1 from public.alignements a where a.registration_id = registrations.id));

  return found;
end;
$$;
revoke execute on function public.confirmer_presence(uuid) from public, anon;
grant execute on function public.confirmer_presence(uuid) to authenticated;

-- Inscription retirée : ses joueurs sont libres de jouer pour une autre
-- équipe du même tournoi.
create or replace function public.liberer_alignement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.statut = 'retire' and old.statut is distinct from 'retire' then
    delete from public.alignements where registration_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.liberer_alignement() from public, anon, authenticated;
drop trigger if exists registrations_liberer_alignement on public.registrations;
create trigger registrations_liberer_alignement
  after update of statut on public.registrations
  for each row execute function public.liberer_alignement();

-- Départ d'un membre aligné (il quitte l'équipe, le capitaine le retire,
-- ou il supprime son compte).
create or replace function public.controler_depart_aligne()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_ligne record;
begin
  for v_ligne in
    select a.tournament_id, a.registration_id, t.statut as statut_tournoi
    from public.alignements a
    join public.registrations r on r.id = a.registration_id
    join public.tournaments t on t.id = a.tournament_id
    where a.profile_id = old.profile_id
      and r.team_id = old.team_id
      and r.statut in ('inscrit', 'confirme')
      and t.statut in ('ouvert', 'checkin', 'en_cours')
  loop
    if v_ligne.statut_tournoi <> 'ouvert' then
      raise exception 'ALIGNE_EN_TOURNOI';
    end if;
    delete from public.alignements
    where tournament_id = v_ligne.tournament_id and profile_id = old.profile_id;
    update public.registrations set statut = 'inscrit', confirme_le = null
    where id = v_ligne.registration_id and statut = 'confirme';
  end loop;
  return old;
end;
$$;
revoke execute on function public.controler_depart_aligne() from public, anon, authenticated;
drop trigger if exists team_members_depart_aligne on public.team_members;
create trigger team_members_depart_aligne
  before delete on public.team_members
  for each row execute function public.controler_depart_aligne();

create or replace function public.controler_suppression_equipe()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.registrations r
    join public.tournaments t on t.id = r.tournament_id
    where r.team_id = old.id and r.statut in ('inscrit', 'confirme')
      and t.statut in ('ouvert', 'checkin', 'en_cours')
  ) then
    raise exception 'EQUIPE_INSCRITE_EN_TOURNOI';
  end if;
  return old;
end;
$$;
revoke execute on function public.controler_suppression_equipe() from public, anon, authenticated;
drop trigger if exists teams_suppression_equipe on public.teams;
create trigger teams_suppression_equipe
  before delete on public.teams
  for each row execute function public.controler_suppression_equipe();

-- Joueur suspendu : retiré des alignements des tournois pas encore
-- commencés (son équipe repasse « inscrite » et doit le remplacer avant le
-- check-in). Son inscription de capitaine, elle, est retirée par /admin.
create or replace function public.retirer_suspendu_des_alignements()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.levee_le is null then
    update public.registrations r
    set statut = 'inscrit', confirme_le = null
    from public.alignements a, public.tournaments t
    where a.registration_id = r.id and t.id = a.tournament_id
      and a.profile_id = new.profile_id and r.profile_id <> new.profile_id
      and r.statut = 'confirme' and t.statut in ('ouvert', 'checkin');
    delete from public.alignements a
    using public.registrations r, public.tournaments t
    where a.registration_id = r.id and t.id = a.tournament_id
      and a.profile_id = new.profile_id and r.profile_id <> new.profile_id
      and r.statut in ('inscrit', 'confirme') and t.statut in ('ouvert', 'checkin');
  end if;
  return new;
end;
$$;
revoke execute on function public.retirer_suspendu_des_alignements() from public, anon, authenticated;
drop trigger if exists suspensions_retirer_des_alignements on public.suspensions;
create trigger suspensions_retirer_des_alignements
  after insert on public.suspensions
  for each row execute function public.retirer_suspendu_des_alignements();

-- Une équipe n'est confirmée qu'avec un alignement complet, quel que soit
-- l'auteur (capitaine au check-in, organisateur depuis son cockpit).
create or replace function public.controler_confirmation_equipe()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.team_id is not null and new.statut = 'confirme' and old.statut is distinct from 'confirme'
     and (select count(*) from public.alignements where registration_id = new.id) <> 5 then
    raise exception 'ALIGNEMENT_INCOMPLET';
  end if;
  return new;
end;
$$;
revoke execute on function public.controler_confirmation_equipe() from public, anon, authenticated;
drop trigger if exists registrations_confirmation_equipe on public.registrations;
create trigger registrations_confirmation_equipe
  before update of statut on public.registrations
  for each row execute function public.controler_confirmation_equipe();

-- ---------- Scrims vérifiés entre équipes (2026-10-03, audit N22) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (scrims de la page d'équipe).
-- Un capitaine propose à une autre équipe un match d'entraînement, à une
-- date donnée, avec cinq de ses joueurs. Accepté par le capitaine adverse
-- (avec les siens), il devient un mini-tournoi 5v5 à deux équipes
-- (tournaments.nature = 'scrim') : même salle de match, même lecture du
-- résultat chez Riot (les dix joueurs alignés dans la partie). Jamais au
-- classement individuel ; le résultat s'affiche sur la page des deux
-- équipes. Arbitre : le premier administrateur, comme pour les défis. Pas
-- de forfait automatique (c'est un entraînement) ; sans partie retrouvée
-- 24 h après l'heure prévue, le scrim est annulé, sans verdict.
alter table public.tournaments drop constraint if exists tournaments_nature_check;
alter table public.tournaments add constraint tournaments_nature_check
  check (nature in ('tournoi', 'defi', 'scrim'));
alter table public.tournaments drop constraint if exists tournaments_capacite_check;
alter table public.tournaments add constraint tournaments_capacite_check
  check (capacite in (4, 8, 16, 32, 64, 128) or (nature in ('defi', 'scrim') and capacite = 2));
alter table public.tournaments drop constraint if exists tournaments_defi_en_1v1;
alter table public.tournaments add constraint tournaments_defi_en_1v1
  check (nature <> 'defi' or format = '1v1');
alter table public.tournaments drop constraint if exists tournaments_scrim_en_5v5;
alter table public.tournaments add constraint tournaments_scrim_en_5v5
  check (nature <> 'scrim' or (format = '5v5' and not compte_pour_classement));

create table if not exists public.scrims (
  id             uuid primary key default gen_random_uuid(),
  equipe_a_id    uuid not null references public.teams(id) on delete cascade, -- équipe qui propose
  equipe_b_id    uuid not null references public.teams(id) on delete cascade,
  propose_par    uuid references public.profiles(id) on delete set null,
  joueurs_a      uuid[] not null,
  region         text not null,
  prevu_le       timestamptz not null,
  best_of        smallint not null default 1 check (best_of in (1, 3)),
  statut         text not null default 'propose' check (statut in ('propose', 'accepte', 'refuse', 'annule')),
  tournament_id  uuid references public.tournaments(id) on delete set null,
  cree_le        timestamptz not null default now(),
  repondu_le     timestamptz,
  check (equipe_a_id <> equipe_b_id)
);
create index if not exists scrims_equipe_a_idx on public.scrims (equipe_a_id, statut);
create index if not exists scrims_equipe_b_idx on public.scrims (equipe_b_id, statut);
create index if not exists scrims_tournament_id_idx on public.scrims (tournament_id);
create index if not exists scrims_propose_par_idx on public.scrims (propose_par);
alter table public.scrims enable row level security;
-- Propositions visibles des deux capitaines seulement ; un scrim accepté
-- est public, comme tout match (page du scrim, pages des équipes).
create policy "les capitaines voient leurs scrims" on public.scrims
  for select using (exists (
    select 1 from public.teams t
    where t.id in (scrims.equipe_a_id, scrims.equipe_b_id) and t.capitaine_id = (select auth.uid())
  ));
revoke insert, update, delete on public.scrims from anon, authenticated;

create or replace function public.proposer_scrim(
  p_equipe_id uuid, p_adversaire_id uuid, p_prevu_le timestamptz, p_best_of smallint, p_joueurs uuid[]
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_capitaine uuid := auth.uid();
  v_equipe record;
  v_adverse record;
  v_region text;
  v_joueurs uuid[];
  v_id uuid;
begin
  if v_capitaine is null then
    raise exception 'NON_CONNECTE';
  end if;
  select id, capitaine_id, game_id into v_equipe from public.teams where id = p_equipe_id;
  if not found or v_equipe.capitaine_id <> v_capitaine then
    raise exception 'CAPITAINE_REQUIS';
  end if;
  select id, game_id into v_adverse from public.teams where id = p_adversaire_id;
  if not found then
    raise exception 'EQUIPE_INTROUVABLE';
  end if;
  if v_adverse.id = v_equipe.id then
    raise exception 'SCRIM_CONTRE_SOI';
  end if;
  if v_adverse.game_id <> v_equipe.game_id then
    raise exception 'EQUIPE_AUTRE_JEU';
  end if;
  if exists (select 1 from public.suspensions where profile_id = v_capitaine and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;
  if p_prevu_le is null or p_prevu_le < now() + interval '15 minutes' or p_prevu_le > now() + interval '30 days' then
    raise exception 'DATE_SCRIM_INVALIDE';
  end if;
  if p_best_of is null or p_best_of not in (1, 3) then
    raise exception 'FORMAT_INVALIDE';
  end if;

  v_region := public.region_compte_verifie(v_capitaine);
  if v_region is null then
    raise exception 'COMPTE_RIOT_REQUIS';
  end if;
  v_joueurs := public.verifier_alignement(p_equipe_id, v_capitaine, p_joueurs, v_region, v_equipe.game_id);

  if exists (
    select 1 from public.scrims
    where statut = 'propose' and prevu_le > now()
      and ((equipe_a_id = p_equipe_id and equipe_b_id = p_adversaire_id)
        or (equipe_a_id = p_adversaire_id and equipe_b_id = p_equipe_id))
  ) then
    raise exception 'SCRIM_DEJA_PROPOSE';
  end if;
  if (select count(*) from public.scrims
      where equipe_a_id = p_equipe_id and statut = 'propose' and prevu_le > now()) >= 3 then
    raise exception 'TROP_DE_SCRIMS';
  end if;

  insert into public.scrims (equipe_a_id, equipe_b_id, propose_par, joueurs_a, region, prevu_le, best_of)
  values (p_equipe_id, p_adversaire_id, v_capitaine, v_joueurs, v_region, p_prevu_le, p_best_of)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.proposer_scrim(uuid, uuid, timestamptz, smallint, uuid[]) from public, anon;
grant execute on function public.proposer_scrim(uuid, uuid, timestamptz, smallint, uuid[]) to authenticated;

-- Réponse du capitaine invité. Accepté : le scrim est créé (adresse du
-- match renvoyée), l'alignement proposé est revérifié.
create or replace function public.repondre_scrim(p_scrim_id uuid, p_accepte boolean, p_joueurs uuid[] default null)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_capitaine uuid := auth.uid();
  v_scrim record;
  v_a record;
  v_b record;
  v_joueurs_a uuid[];
  v_joueurs_b uuid[];
  v_arbitre uuid;
  v_tournoi uuid;
  v_match uuid;
  v_reg_a uuid;
  v_reg_b uuid;
  v_slug text;
begin
  if v_capitaine is null then
    raise exception 'NON_CONNECTE';
  end if;
  select * into v_scrim from public.scrims where id = p_scrim_id for update;
  if not found then
    raise exception 'SCRIM_INTROUVABLE';
  end if;
  select id, nom, tag, capitaine_id, game_id into v_b from public.teams where id = v_scrim.equipe_b_id;
  if v_b.capitaine_id <> v_capitaine then
    raise exception 'NON_DESTINATAIRE';
  end if;
  if v_scrim.statut <> 'propose' then
    raise exception 'SCRIM_DEJA_TRAITE';
  end if;
  if v_scrim.prevu_le <= now() then
    raise exception 'SCRIM_EXPIRE';
  end if;

  if not p_accepte then
    update public.scrims set statut = 'refuse', repondu_le = now() where id = p_scrim_id;
    return null;
  end if;

  if exists (select 1 from public.suspensions where profile_id = v_capitaine and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;
  select id, nom, tag, capitaine_id into v_a from public.teams where id = v_scrim.equipe_a_id;
  v_joueurs_b := public.verifier_alignement(v_b.id, v_capitaine, p_joueurs, v_scrim.region, v_b.game_id);
  -- Un joueur de l'équipe qui propose a pu partir ou être suspendu depuis.
  begin
    v_joueurs_a := public.verifier_alignement(v_a.id, v_a.capitaine_id, v_scrim.joueurs_a, v_scrim.region, v_b.game_id);
  exception when others then
    raise exception 'ALIGNEMENT_ADVERSE_INVALIDE';
  end;
  if v_joueurs_a && v_joueurs_b then
    raise exception 'JOUEUR_DANS_LES_DEUX_EQUIPES';
  end if;

  select profile_id into v_arbitre from public.admins order by ajoute_le, profile_id limit 1;
  if v_arbitre is null then
    raise exception 'AUCUN_ARBITRE';
  end if;

  v_slug := 'scrim-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.tournaments (
    game_id, organisateur_id, slug, nom, format, type_bracket, best_of, capacite, region,
    compte_pour_classement, debute_le, checkin_ouvre_le, statut, condition_victoire, nature
  ) values (
    v_b.game_id, v_arbitre, v_slug, 'Scrim ' || v_a.tag || ' contre ' || v_b.tag, '5v5', 'elim_simple',
    v_scrim.best_of, 2, v_scrim.region, false, v_scrim.prevu_le, v_scrim.prevu_le, 'en_cours', 'nexus', 'scrim'
  ) returning id into v_tournoi;

  insert into public.registrations (tournament_id, profile_id, statut, confirme_le, seed, team_id, equipe_nom, equipe_tag)
  values (v_tournoi, v_a.capitaine_id, 'confirme', now(), 1, v_a.id, v_a.nom, v_a.tag)
  returning id into v_reg_a;
  insert into public.registrations (tournament_id, profile_id, statut, confirme_le, seed, team_id, equipe_nom, equipe_tag)
  values (v_tournoi, v_capitaine, 'confirme', now(), 2, v_b.id, v_b.nom, v_b.tag)
  returning id into v_reg_b;
  insert into public.alignements (tournament_id, profile_id, registration_id)
  select v_tournoi, j, v_reg_a from unnest(v_joueurs_a) j
  union all
  select v_tournoi, j, v_reg_b from unnest(v_joueurs_b) j;

  -- Le match s'ouvre à l'heure prévue : la recherche Riot ne retient que
  -- les parties commencées après.
  insert into public.matches (tournament_id, tour, position, statut, demarre_le)
  values (v_tournoi, 1, 1, 'en_cours', v_scrim.prevu_le)
  returning id into v_match;
  insert into public.match_participants (match_id, profile_id, slot) values
    (v_match, v_a.capitaine_id, 1),
    (v_match, v_capitaine, 2);

  update public.scrims
  set statut = 'accepte', repondu_le = now(), tournament_id = v_tournoi
  where id = p_scrim_id;
  return v_slug;
end;
$$;
revoke execute on function public.repondre_scrim(uuid, boolean, uuid[]) from public, anon;
grant execute on function public.repondre_scrim(uuid, boolean, uuid[]) to authenticated;

-- Annulation par l'un des deux capitaines : une proposition, ou un scrim
-- accepté tant que son heure n'est pas venue.
create or replace function public.annuler_scrim(p_scrim_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_scrim record;
begin
  select * into v_scrim from public.scrims where id = p_scrim_id for update;
  if not found then
    raise exception 'SCRIM_INTROUVABLE';
  end if;
  if not exists (
    select 1 from public.teams
    where id in (v_scrim.equipe_a_id, v_scrim.equipe_b_id) and capitaine_id = auth.uid()
  ) then
    raise exception 'NON_AUTORISE';
  end if;
  if v_scrim.statut = 'propose' or (v_scrim.statut = 'accepte' and v_scrim.prevu_le > now()) then
    update public.tournaments set statut = 'annule' where id = v_scrim.tournament_id and statut = 'en_cours';
    update public.scrims set statut = 'annule', repondu_le = coalesce(repondu_le, now()) where id = p_scrim_id;
    return true;
  end if;
  raise exception 'SCRIM_NON_ANNULABLE';
end;
$$;
revoke execute on function public.annuler_scrim(uuid) from public, anon;
grant execute on function public.annuler_scrim(uuid) to authenticated;

-- ---------- Agents libres en 5v5 (2026-10-03, audit N23) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (« Je n'ai pas d'équipe » sur la page d'un tournoi 5v5).
-- Un joueur sans équipe s'inscrit seul à un tournoi 5v5 (compte Riot
-- vérifié dans la région) et confirme sa présence au check-in comme une
-- équipe. Au lancement du bracket, l'organisateur forme avec eux des
-- équipes de cinq (src/lib/agents-libres.ts : équilibre des ratings, rôles
-- variés) ; la base vérifie chaque équipe et l'inscrit comme une autre,
-- sous le nom « Agents libres N », capitaine = premier de la liste. Ces
-- équipes n'ont pas de page : elles n'existent que le temps du tournoi.
-- Les agents en trop (pas assez pour une équipe complète, ou plus de
-- place) restent sans équipe. Un agent aligné entre-temps dans une vraie
-- équipe quitte la liste.
create table if not exists public.agents_libres (
  tournament_id         uuid not null references public.tournaments(id) on delete cascade,
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  role                  text check (role is null or role in ('top', 'jungle', 'mid', 'adc', 'support')),
  statut                text not null default 'inscrit' check (statut in ('inscrit', 'confirme', 'place')),
  registration_id       uuid references public.registrations(id) on delete set null,
  rating_a_inscription  int,
  inscrit_le            timestamptz not null default now(),
  primary key (tournament_id, profile_id)
);
create index if not exists agents_libres_profile_id_idx on public.agents_libres (profile_id);
create index if not exists agents_libres_registration_id_idx on public.agents_libres (registration_id);
alter table public.agents_libres enable row level security;
create policy "agents libres lisibles par tous" on public.agents_libres for select using (true);
revoke insert, update, delete on public.agents_libres from anon, authenticated;

create or replace function public.s_inscrire_agent_libre(p_tournament_id uuid, p_role text default null)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_tournoi record;
  v_region text;
  v_rating int;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;
  select id, statut, capacite, format, nature, region, game_id, season_id into v_tournoi
  from public.tournaments where id = p_tournament_id
  for update;
  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;
  if v_tournoi.format <> '5v5' or v_tournoi.nature <> 'tournoi' then
    raise exception 'TOURNOI_EN_SOLO';
  end if;
  if v_tournoi.statut <> 'ouvert' then
    raise exception 'INSCRIPTIONS_FERMEES';
  end if;
  if p_role is not null and p_role not in ('top', 'jungle', 'mid', 'adc', 'support') then
    raise exception 'ROLE_INVALIDE';
  end if;
  if exists (select 1 from public.suspensions where profile_id = v_joueur and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;
  v_region := public.region_compte_verifie(v_joueur);
  if v_region is null then
    raise exception 'COMPTE_RIOT_REQUIS';
  end if;
  if v_region <> v_tournoi.region then
    raise exception 'REGION_DIFFERENTE';
  end if;
  if exists (select 1 from public.alignements where tournament_id = p_tournament_id and profile_id = v_joueur) then
    raise exception 'DEJA_DANS_UNE_EQUIPE';
  end if;
  if exists (select 1 from public.agents_libres where tournament_id = p_tournament_id and profile_id = v_joueur) then
    raise exception 'DEJA_INSCRIT';
  end if;
  -- Pas plus d'agents que de places d'équipe restantes.
  if (select count(*) from public.agents_libres where tournament_id = p_tournament_id and statut <> 'place') + 1
     > (v_tournoi.capacite - (select count(*) from public.registrations
                              where tournament_id = p_tournament_id and statut <> 'retire')) * 5 then
    raise exception 'TOURNOI_COMPLET';
  end if;

  select round(r.rating)::int into v_rating
  from public.ratings r
  where r.profile_id = v_joueur and r.game_id = v_tournoi.game_id
    and r.season_id = coalesce(
      v_tournoi.season_id,
      (select s.id from public.seasons s where s.game_id = v_tournoi.game_id and s.est_courante limit 1)
    );

  insert into public.agents_libres (tournament_id, profile_id, role, rating_a_inscription)
  values (p_tournament_id, v_joueur, p_role, v_rating);
  return true;
end;
$$;
revoke execute on function public.s_inscrire_agent_libre(uuid, text) from public, anon;
grant execute on function public.s_inscrire_agent_libre(uuid, text) to authenticated;

-- Check-in d'un agent libre : même fenêtre que celui des équipes.
create or replace function public.confirmer_agent_libre(p_tournament_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_statut public.tournament_status;
  v_checkin timestamptz;
begin
  if auth.uid() is null then
    raise exception 'NON_CONNECTE';
  end if;
  select statut, checkin_ouvre_le into v_statut, v_checkin
  from public.tournaments where id = p_tournament_id
  for share;
  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;
  if not (v_statut = 'checkin' or (v_statut = 'ouvert' and v_checkin <= now())) then
    raise exception 'CHECKIN_FERME';
  end if;
  if exists (select 1 from public.suspensions where profile_id = auth.uid() and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;
  update public.agents_libres set statut = 'confirme'
  where tournament_id = p_tournament_id and profile_id = auth.uid() and statut = 'inscrit';
  return found;
end;
$$;
revoke execute on function public.confirmer_agent_libre(uuid) from public, anon;
grant execute on function public.confirmer_agent_libre(uuid) to authenticated;

create or replace function public.quitter_agents_libres(p_tournament_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NON_CONNECTE';
  end if;
  if not exists (select 1 from public.tournaments where id = p_tournament_id and statut in ('ouvert', 'checkin')) then
    raise exception 'DESINSCRIPTION_FERMEE';
  end if;
  delete from public.agents_libres
  where tournament_id = p_tournament_id and profile_id = auth.uid() and statut <> 'place';
  return found;
end;
$$;
revoke execute on function public.quitter_agents_libres(uuid) from public, anon;
grant execute on function public.quitter_agents_libres(uuid) to authenticated;

-- Formation des équipes par l'organisateur, au lancement du bracket :
-- p_equipes = tableau JSON de listes de cinq profile_id (capitaine en
-- tête), calculé par src/lib/agents-libres.ts. Renvoie le nombre d'équipes
-- inscrites.
create or replace function public.former_equipes_agents_libres(p_tournament_id uuid, p_equipes jsonb)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_tournoi record;
  v_equipe jsonb;
  v_joueurs uuid[];
  v_numero int;
  v_registration uuid;
  v_formees int := 0;
begin
  select id, statut, capacite, organisateur_id into v_tournoi
  from public.tournaments where id = p_tournament_id
  for update;
  if not found then
    raise exception 'TOURNOI_INTROUVABLE';
  end if;
  if v_tournoi.organisateur_id is distinct from auth.uid() then
    raise exception 'NON_ORGANISATEUR';
  end if;
  if v_tournoi.statut not in ('ouvert', 'checkin') then
    raise exception 'FORMATION_FERMEE';
  end if;
  if jsonb_typeof(p_equipes) <> 'array' then
    raise exception 'EQUIPES_INVALIDES';
  end if;

  select count(*) into v_numero
  from public.registrations where tournament_id = p_tournament_id and team_id is null and equipe_nom is not null;

  for v_equipe in select * from jsonb_array_elements(p_equipes) loop
    select array_agg(distinct (j #>> '{}')::uuid) into v_joueurs from jsonb_array_elements(v_equipe) j;
    if jsonb_array_length(v_equipe) <> 5 or cardinality(v_joueurs) <> 5 then
      raise exception 'ALIGNEMENT_DE_CINQ';
    end if;
    if (select count(*) from public.agents_libres
        where tournament_id = p_tournament_id and profile_id = any (v_joueurs) and statut = 'confirme') <> 5 then
      raise exception 'AGENT_NON_CONFIRME';
    end if;
    if exists (select 1 from public.suspensions where profile_id = any (v_joueurs) and levee_le is null) then
      raise exception 'ALIGNEMENT_SUSPENDU';
    end if;
    if (select count(*) from public.registrations
        where tournament_id = p_tournament_id and statut <> 'retire') >= v_tournoi.capacite then
      raise exception 'TOURNOI_COMPLET';
    end if;

    v_numero := v_numero + 1;
    insert into public.registrations (tournament_id, profile_id, statut, confirme_le, equipe_nom, equipe_tag, rating_a_inscription)
    values (
      p_tournament_id, (v_equipe ->> 0)::uuid, 'confirme', now(), 'Agents libres ' || v_numero, 'AL' || v_numero,
      (select round(avg(rating_a_inscription))::int from public.agents_libres
       where tournament_id = p_tournament_id and profile_id = any (v_joueurs))
    )
    returning id into v_registration;
    update public.agents_libres set statut = 'place', registration_id = v_registration
    where tournament_id = p_tournament_id and profile_id = any (v_joueurs);
    insert into public.alignements (tournament_id, profile_id, registration_id)
    select p_tournament_id, j, v_registration from unnest(v_joueurs) j;
    v_formees := v_formees + 1;
  end loop;
  return v_formees;
end;
$$;
revoke execute on function public.former_equipes_agents_libres(uuid, jsonb) from public, anon;
grant execute on function public.former_equipes_agents_libres(uuid, jsonb) to authenticated;

-- Un agent aligné dans une vraie équipe quitte la liste des agents libres.
create or replace function public.retirer_agent_aligne()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.agents_libres
  where tournament_id = new.tournament_id and profile_id = new.profile_id and statut <> 'place';
  return new;
end;
$$;
revoke execute on function public.retirer_agent_aligne() from public, anon, authenticated;
drop trigger if exists alignements_retirer_agent on public.alignements;
create trigger alignements_retirer_agent
  after insert on public.alignements
  for each row execute function public.retirer_agent_aligne();

-- Suspendu, ou sans compte Riot (délié, compte supprimé) : retiré des
-- listes d'agents libres des tournois pas encore commencés.
create or replace function public.retirer_agent_libre_indisponible()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_profil uuid;
begin
  if tg_op = 'DELETE' then
    -- Compte Riot délié : seulement s'il ne reste aucun compte vérifié.
    v_profil := old.profile_id;
    if public.region_compte_verifie(v_profil) is not null then
      return old;
    end if;
  else
    v_profil := new.profile_id;
    if new.levee_le is not null then
      return new;
    end if;
  end if;
  delete from public.agents_libres a
  using public.tournaments t
  where a.tournament_id = t.id and a.profile_id = v_profil
    and a.statut <> 'place' and t.statut in ('ouvert', 'checkin');
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public.retirer_agent_libre_indisponible() from public, anon, authenticated;
drop trigger if exists suspensions_retirer_agent_libre on public.suspensions;
create trigger suspensions_retirer_agent_libre
  after insert on public.suspensions
  for each row execute function public.retirer_agent_libre_indisponible();
drop trigger if exists game_accounts_retirer_agent_libre on public.game_accounts;
create trigger game_accounts_retirer_agent_libre
  after delete on public.game_accounts
  for each row execute function public.retirer_agent_libre_indisponible();

-- ---------- Objectif Nexus Tour et Clash (2026-10-03, audit N24) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (échéances de /lol/coequipiers et de /admin).
-- Calendrier des compétitions que les joueurs préparent : Clash, lu dans
-- l'API Riot (clash-v1) par le serveur, et Nexus Tour ou autre, saisis par
-- un administrateur avec leur lien officiel — jamais une date inventée.
-- Une annonce « cherche une équipe » peut viser une échéance à venir
-- (« je cherche une équipe pour la prochaine étape »).
create table if not exists public.echeances (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('clash', 'nexus_tour', 'autre')),
  nom            text not null check (char_length(nom) between 3 and 80),
  region         text,
  debut_le       timestamptz not null,
  lien_officiel  text check (lien_officiel is null or lien_officiel ~ '^https://[^[:space:]]+$'),
  source         text not null default 'admin' check (source in ('admin', 'riot')),
  cle_externe    text unique,
  cree_par       uuid references public.profiles(id) on delete set null,
  maj_le         timestamptz not null default now()
);
create index if not exists echeances_debut_le_idx on public.echeances (debut_le);
create index if not exists echeances_cree_par_idx on public.echeances (cree_par);
alter table public.echeances enable row level security;
create policy "echeances lisibles par tous" on public.echeances for select using (true);
-- Saisie et retrait par les administrateurs ; les dates Clash sont écrites
-- par le serveur seul (source 'riot').
create policy "les administrateurs ajoutent une echeance" on public.echeances
  for insert with check (
    source = 'admin' and cle_externe is null
    and exists (select 1 from public.admins a where a.profile_id = (select auth.uid()))
  );
create policy "les administrateurs retirent une echeance" on public.echeances
  for delete using (exists (select 1 from public.admins a where a.profile_id = (select auth.uid())));
revoke update on public.echeances from anon, authenticated;
revoke insert, delete on public.echeances from anon;

alter table public.recherches_coequipiers
  add column if not exists objectif_id uuid references public.echeances(id) on delete set null;
create index if not exists recherches_coequipiers_objectif_id_idx on public.recherches_coequipiers (objectif_id);

-- Une annonce ne vise qu'une échéance à venir.
create or replace function public.controler_objectif_annonce()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.objectif_id is not null
     and (tg_op = 'INSERT' or new.objectif_id is distinct from old.objectif_id)
     and not exists (select 1 from public.echeances where id = new.objectif_id and debut_le > now()) then
    raise exception 'OBJECTIF_PASSE';
  end if;
  return new;
end;
$$;
revoke execute on function public.controler_objectif_annonce() from public, anon, authenticated;
drop trigger if exists recherches_coequipiers_objectif on public.recherches_coequipiers;
create trigger recherches_coequipiers_objectif
  before insert or update of objectif_id on public.recherches_coequipiers
  for each row execute function public.controler_objectif_annonce();

-- ---------- Revue de match et dossier de litige rédigés par l'IA (2026-10-03, audit N25 et N28) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (« Analyse détaillée » du CV, « Préparer le dossier » des litiges).
-- Textes rédigés par Claude (src/lib/claude.ts) à partir de données déjà
-- en base ou lues chez Riot, gardés pour ne pas payer deux fois le même
-- texte. Écrits par le serveur seul, après ses contrôles (offre Elite pour
-- la revue, organisateur ou administrateur pour le dossier) et la limite
-- de demandes à l'IA (reserver_appel_assistant_ia, 10 par 24 h).
-- Un dossier de litige ne tranche jamais : il rassemble les faits pour la
-- personne qui décide.
create table if not exists public.revues_match_ia (
  match_id    uuid not null references public.matches(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  points      text[] not null,
  conseil     text not null,
  modele      text not null,
  cree_le     timestamptz not null default now(),
  primary key (match_id, profile_id)
);
create index if not exists revues_match_ia_profile_id_idx on public.revues_match_ia (profile_id);
alter table public.revues_match_ia enable row level security;
create policy "un joueur lit ses revues" on public.revues_match_ia
  for select using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.revues_match_ia from anon, authenticated;

create table if not exists public.dossiers_litige (
  dispute_id  uuid primary key references public.disputes(id) on delete cascade,
  faits       text[] not null,
  synthese    jsonb not null,
  modele      text not null,
  cree_par    uuid references public.profiles(id) on delete set null,
  cree_le     timestamptz not null default now()
);
create index if not exists dossiers_litige_cree_par_idx on public.dossiers_litige (cree_par);
alter table public.dossiers_litige enable row level security;
create policy "organisateur et administrateurs lisent le dossier" on public.dossiers_litige
  for select using (
    exists (select 1 from public.admins a where a.profile_id = (select auth.uid()))
    or exists (
      select 1 from public.disputes d
      join public.matches m on m.id = d.match_id
      join public.tournaments t on t.id = m.tournament_id
      where d.id = dossiers_litige.dispute_id and t.organisateur_id = (select auth.uid())
    )
  );
revoke insert, update, delete on public.dossiers_litige from anon, authenticated;

-- ---------- Fiche publique de l'organisateur (2026-10-03, audit N13) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (bloc « Organisateur » du CV, ligne sous « Organisé par » d'un tournoi).
-- Le sérieux d'un organisateur, en chiffres publics : tournois menés à
-- terme ou annulés, part des matchs dont le résultat a été lu chez Riot,
-- litiges tranchés et délai médian. Seuls ses propres tournois comptent :
-- ni les tournois officiels quotidiens, ni les défis ou scrims (arbitrés
-- par Najarena), ni les brouillons. Les exemptions (match à un seul
-- joueur) ne sont pas des matchs.
create or replace function public.fiche_organisateur(p_profile_id uuid)
returns table (
  tournois_publies integer,
  tournois_termines integer,
  tournois_annules integer,
  matchs_decides integer,
  matchs_verifies integer,
  litiges integer,
  litiges_resolus integer,
  resolution_mediane_heures numeric
)
language sql
stable
security definer set search_path = public
as $$
  with t as (
    select id, statut from public.tournaments
    where organisateur_id = p_profile_id and nature = 'tournoi' and creneau_auto is null and statut <> 'brouillon'
  ),
  m as (
    select v.niveau
    from public.matches ma
    join t on t.id = ma.tournament_id
    join public.match_verdicts v on v.match_id = ma.id and v.est_definitif
    where (select count(*) from public.match_participants mp where mp.match_id = ma.id) = 2
  ),
  d as (
    select di.cree_le, di.resolu_le
    from public.disputes di
    join public.matches ma on ma.id = di.match_id
    join t on t.id = ma.tournament_id
  )
  select
    (select count(*) from t)::integer,
    (select count(*) from t where statut = 'termine')::integer,
    (select count(*) from t where statut = 'annule')::integer,
    (select count(*) from m)::integer,
    (select count(*) from m where niveau <> 'manuel')::integer,
    (select count(*) from d)::integer,
    (select count(*) from d where resolu_le is not null)::integer,
    (select round((percentile_cont(0.5) within group (order by extract(epoch from (resolu_le - cree_le)) / 3600))::numeric, 1)
     from d where resolu_le is not null);
$$;
revoke execute on function public.fiche_organisateur(uuid) from public;
grant execute on function public.fiche_organisateur(uuid) to anon, authenticated, service_role;

-- ---------- Comptes Riot secondaires déclarés (2026-10-03, audit N15) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (page /lier-riot, bloc « Comptes Riot » du CV, recherche des résultats).
-- Un joueur peut déclarer jusqu'à trois comptes Riot pour LoL, vérifiés de
-- la même façon (icône de profil), affichés en transparence sur son CV
-- plutôt que de laisser croire qu'il n'en a qu'un. Le compte principal
-- reste le seul qui inscrit aux tournois et dont l'historique est lu.
-- Changer de compte principal (ou en lier un nouveau comme principal) est
-- refusé pendant un tournoi pas encore terminé : ses résultats sont lus
-- sur le compte inscrit. Chaque match vérifié garde désormais le compte
-- qui l'a joué (stats_match_joueur.puuid).
alter table public.stats_match_joueur add column if not exists puuid text;

-- Engagé dans un tournoi pas encore terminé (inscription, alignement 5v5,
-- liste des agents libres).
create or replace function public.engage_en_tournoi(p_profile_id uuid, p_game_id smallint)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.registrations r
    join public.tournaments t on t.id = r.tournament_id
    where r.profile_id = p_profile_id and r.statut in ('inscrit', 'confirme')
      and t.game_id = p_game_id and t.statut in ('ouvert', 'checkin', 'en_cours')
  ) or exists (
    select 1 from public.alignements a
    join public.registrations r on r.id = a.registration_id
    join public.tournaments t on t.id = a.tournament_id
    where a.profile_id = p_profile_id and r.statut in ('inscrit', 'confirme')
      and t.game_id = p_game_id and t.statut in ('ouvert', 'checkin', 'en_cours')
  ) or exists (
    select 1 from public.agents_libres g
    join public.tournaments t on t.id = g.tournament_id
    where g.profile_id = p_profile_id and g.statut <> 'place'
      and t.game_id = p_game_id and t.statut in ('ouvert', 'checkin')
  );
$$;
revoke all on function public.engage_en_tournoi(uuid, smallint) from public, anon, authenticated;

drop function if exists public.lier_compte_riot(uuid, smallint, text, text, text, text, smallint);
create or replace function public.lier_compte_riot(
  p_profile_id uuid,
  p_game_id smallint,
  p_puuid text,
  p_riot_game_name text,
  p_riot_tag_line text,
  p_region text,
  p_defi_icone_id smallint,
  p_principal boolean default true
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_principal boolean := p_principal;
begin
  -- Le premier compte est toujours le principal.
  if not exists (
    select 1 from public.game_accounts
    where profile_id = p_profile_id and game_id = p_game_id and est_principal and puuid <> p_puuid
  ) then
    v_principal := true;
  end if;

  if v_principal
     and exists (
       select 1 from public.game_accounts
       where profile_id = p_profile_id and game_id = p_game_id and est_principal and puuid <> p_puuid
     )
     and public.engage_en_tournoi(p_profile_id, p_game_id) then
    raise exception 'INSCRIT_A_UN_TOURNOI';
  end if;

  if not exists (select 1 from public.game_accounts where game_id = p_game_id and puuid = p_puuid)
     and (select count(*) from public.game_accounts where profile_id = p_profile_id and game_id = p_game_id) >= 3 then
    raise exception 'TROP_DE_COMPTES';
  end if;

  -- Nouveau principal : les autres comptes de ce joueur cessent de l'être
  -- (annulé avec le reste si la liaison échoue plus bas).
  if v_principal then
    update public.game_accounts
    set est_principal = false
    where profile_id = p_profile_id
      and game_id = p_game_id
      and puuid <> p_puuid
      and est_principal;
  end if;

  insert into public.game_accounts (
    profile_id, game_id, puuid, riot_game_name, riot_tag_line, region,
    est_principal, defi_icone_id, methode_verification
  )
  values (
    p_profile_id, p_game_id, p_puuid, p_riot_game_name, p_riot_tag_line, p_region,
    v_principal, p_defi_icone_id, 'icone_profil'
  )
  on conflict (game_id, puuid) do update set
    riot_game_name = excluded.riot_game_name,
    riot_tag_line = excluded.riot_tag_line,
    region = excluded.region,
    est_principal = public.game_accounts.est_principal or excluded.est_principal,
    defi_icone_id = excluded.defi_icone_id,
    methode_verification = 'icone_profil',
    verifie_le = null
  -- Compte déjà lié à un autre profil : aucune ligne touchée, refus.
  where public.game_accounts.profile_id = p_profile_id;

  if not found then
    raise exception 'RIOT_ACCOUNT_TAKEN';
  end if;
end;
$$;
revoke execute on function public.lier_compte_riot(uuid, smallint, text, text, text, text, smallint, boolean) from public, anon, authenticated;
grant execute on function public.lier_compte_riot(uuid, smallint, text, text, text, text, smallint, boolean) to service_role;

-- Un compte secondaire vérifié devient le principal.
create or replace function public.definir_compte_principal(p_game_id smallint, p_puuid text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_compte record;
begin
  if v_joueur is null then
    raise exception 'NON_CONNECTE';
  end if;
  select est_principal, verifie_le into v_compte
  from public.game_accounts
  where profile_id = v_joueur and game_id = p_game_id and puuid = p_puuid
  for update;
  if not found then
    raise exception 'COMPTE_INTROUVABLE';
  end if;
  if v_compte.est_principal then
    return false;
  end if;
  if v_compte.verifie_le is null then
    raise exception 'COMPTE_NON_VERIFIE';
  end if;
  if public.engage_en_tournoi(v_joueur, p_game_id) then
    raise exception 'INSCRIT_A_UN_TOURNOI';
  end if;
  update public.game_accounts set est_principal = false
  where profile_id = v_joueur and game_id = p_game_id and est_principal;
  update public.game_accounts set est_principal = true
  where profile_id = v_joueur and game_id = p_game_id and puuid = p_puuid;
  return true;
end;
$$;
revoke execute on function public.definir_compte_principal(smallint, text) from public, anon;
grant execute on function public.definir_compte_principal(smallint, text) to authenticated;

-- Retirer un compte secondaire (le principal se délie avec delier_compte_riot).
create or replace function public.delier_compte_secondaire(p_game_id smallint, p_puuid text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NON_CONNECTE';
  end if;
  delete from public.game_accounts
  where profile_id = auth.uid() and game_id = p_game_id and puuid = p_puuid and not est_principal;
  return found;
end;
$$;
revoke execute on function public.delier_compte_secondaire(smallint, text) from public, anon;
grant execute on function public.delier_compte_secondaire(smallint, text) to authenticated;

-- ---------- Arène 1v1 à la demande (2026-10-03, audit N19) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit
-- (page /lol/arene, appariement par la tâche des tournois automatiques).
-- Un joueur entre dans la file de sa région ; le site lui trouve un
-- adversaire de niveau proche et crée un duel (même mécanique qu'un défi
-- accepté : creer_duel, arbitré par le premier administrateur, classé sauf
-- deuxième duel de la paire en 24 h). Écart de rating toléré :
-- 100 + la moitié du plus grand RD des deux (un joueur au niveau encore
-- incertain peut affronter plus large), + 20 par minute d'attente du plus
-- ancien, 500 au plus. Une place en file expire après 30 minutes.
create table if not exists public.file_arene (
  profile_id          uuid primary key references public.profiles(id) on delete cascade,
  region              text not null,
  rating              numeric not null,
  rd                  numeric not null,
  condition_victoire  text not null default 'nexus' check (condition_victoire in ('nexus', 'classique')),
  entree_le           timestamptz not null default now()
);
create index if not exists file_arene_region_idx on public.file_arene (region, condition_victoire, entree_le);
alter table public.file_arene enable row level security;
create policy "un joueur voit sa place dans la file" on public.file_arene
  for select using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.file_arene from anon, authenticated;

create or replace function public.ecart_arene(p_rd_a numeric, p_rd_b numeric, p_attente_minutes numeric)
returns numeric
language sql
immutable
as $$
  select least(500, 100 + greatest(p_rd_a, p_rd_b) / 2 + 20 * greatest(p_attente_minutes, 0));
$$;

-- Cherche un adversaire au joueur (déjà en file) ; s'il y en a un, retire
-- les deux de la file et crée le duel. Renvoie l'adresse du duel, ou nul.
create or replace function public.apparier_joueur_arene(p_joueur uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_moi record;
  v_lui record;
  v_defi uuid;
  v_slug text;
begin
  select * into v_moi from public.file_arene where profile_id = p_joueur;
  if not found then
    return null;
  end if;
  -- Un appariement à la fois par région : deux joueurs ne prennent pas le
  -- même adversaire.
  perform pg_advisory_xact_lock(hashtext('arene:' || v_moi.region));
  -- Un défi accepté pendant l'attente : le joueur patiente jusqu'à la fin
  -- de ce duel (ou l'expiration de sa place).
  if exists (
    select 1 from public.registrations r
    join public.tournaments t on t.id = r.tournament_id
    where r.profile_id = p_joueur and t.nature = 'defi' and t.statut = 'en_cours'
  ) then
    return null;
  end if;

  select f.* into v_lui
  from public.file_arene f
  where f.profile_id <> p_joueur
    and f.region = v_moi.region
    and f.condition_victoire = v_moi.condition_victoire
    and abs(f.rating - v_moi.rating) <= public.ecart_arene(
      v_moi.rd, f.rd, extract(epoch from now() - least(f.entree_le, v_moi.entree_le)) / 60
    )
    -- Toujours apte au duel : compte vérifié dans la région, pas suspendu,
    -- pas déjà en duel (un défi accepté pendant l'attente).
    and public.region_compte_verifie(f.profile_id) = v_moi.region
    and not exists (select 1 from public.suspensions s where s.profile_id = f.profile_id and s.levee_le is null)
    and not exists (
      select 1 from public.registrations r
      join public.tournaments t on t.id = r.tournament_id
      where r.profile_id = f.profile_id and t.nature = 'defi' and t.statut = 'en_cours'
    )
  order by abs(f.rating - v_moi.rating), f.entree_le
  limit 1
  for update;
  if not found then
    return null;
  end if;

  delete from public.file_arene where profile_id in (p_joueur, v_lui.profile_id);
  -- Le plus ancien en file « lance » le défi, accepté d'office.
  insert into public.defis (lanceur_id, adversaire_id, condition_victoire, expire_le)
  values (
    case when v_lui.entree_le <= v_moi.entree_le then v_lui.profile_id else p_joueur end,
    case when v_lui.entree_le <= v_moi.entree_le then p_joueur else v_lui.profile_id end,
    v_moi.condition_victoire,
    now() + interval '1 hour'
  )
  returning id into v_defi;
  v_slug := public.creer_duel(v_defi);
  -- « Arène X contre Y » plutôt que « Défi X contre Y ».
  update public.tournaments set nom = 'Arène ' || substr(nom, length('Défi ') + 1) where slug = v_slug;
  return v_slug;
end;
$$;
revoke all on function public.apparier_joueur_arene(uuid) from public, anon, authenticated;

create or replace function public.rejoindre_arene(p_condition text default 'nexus')
returns text -- adresse du duel si un adversaire attendait déjà, sinon nul
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid := auth.uid();
  v_region text;
  v_rating record;
begin
  v_region := public.controler_lanceur_defi(v_joueur, p_condition);
  if not exists (select 1 from public.admins) then
    raise exception 'AUCUN_ARBITRE';
  end if;
  if exists (select 1 from public.file_arene where profile_id = v_joueur) then
    raise exception 'DEJA_EN_FILE';
  end if;
  if exists (
    select 1 from public.registrations r
    join public.tournaments t on t.id = r.tournament_id
    where r.profile_id = v_joueur and t.nature = 'defi' and t.statut = 'en_cours'
  ) then
    raise exception 'DUEL_EN_COURS';
  end if;

  select r.rating, r.rd into v_rating
  from public.ratings r
  join public.seasons s on s.id = r.season_id and s.est_courante
  where r.profile_id = v_joueur and r.game_id = 1;

  insert into public.file_arene (profile_id, region, rating, rd, condition_victoire)
  values (v_joueur, v_region, coalesce(v_rating.rating, 1500), coalesce(v_rating.rd, 350), p_condition);

  return public.apparier_joueur_arene(v_joueur);
end;
$$;
revoke execute on function public.rejoindre_arene(text) from public, anon;
grant execute on function public.rejoindre_arene(text) to authenticated;

create or replace function public.quitter_arene()
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.file_arene where profile_id = auth.uid();
  return found;
end;
$$;
revoke execute on function public.quitter_arene() from public, anon;
grant execute on function public.quitter_arene() to authenticated;

-- Ce que voit un joueur : sa place, et combien attendent dans sa région.
create or replace function public.etat_arene()
returns table (en_file boolean, entree_le timestamptz, en_attente_region integer)
language sql
stable
security definer set search_path = public
as $$
  select
    exists (select 1 from public.file_arene where profile_id = auth.uid()),
    (select f.entree_le from public.file_arene f where f.profile_id = auth.uid()),
    (select count(*)::integer from public.file_arene f
     where f.region = public.region_compte_verifie(auth.uid()));
$$;
revoke execute on function public.etat_arene() from public, anon;
grant execute on function public.etat_arene() to authenticated;

-- Passage périodique (serveur) : places expirées retirées, puis les joueurs
-- devenus compatibles avec l'attente sont appariés. Renvoie les duels créés.
create or replace function public.apparier_arene()
returns table (slug text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_joueur uuid;
  v_slug text;
begin
  delete from public.file_arene where entree_le < now() - interval '30 minutes';
  for v_joueur in select profile_id from public.file_arene order by entree_le loop
    begin
      v_slug := public.apparier_joueur_arene(v_joueur);
    exception when others then
      -- Duel impossible pour ce joueur (plafond de duels, suspension…) :
      -- il quitte la file plutôt que de bloquer les autres.
      delete from public.file_arene where profile_id = v_joueur;
      v_slug := null;
    end;
    if v_slug is not null then
      slug := v_slug;
      return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.apparier_arene() from public, anon, authenticated;
grant execute on function public.apparier_arene() to service_role;

-- ---------- Pronostics gratuits (2026-10-03, audit N20) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Les visiteurs connectés pronostiquent le vainqueur des demi-finales
-- (1 point) et de la finale (2 points) des tournois en cours. Aucune mise,
-- aucun gain : un classement des pronostiqueurs par saison, rien d'autre.
-- Un pronostic n'est compté que sur un résultat lu chez Riot (verdict
-- définitif, niveaux 2 et 3) : forfait ou décision manuelle = pronostic
-- annulé. Fermé dès qu'un joueur du match se déclare prêt, ou 10 minutes
-- après l'ouverture du match. Les joueurs du tournoi et son organisateur
-- ne pronostiquent pas.
create table if not exists public.pronostics (
  match_id       uuid not null references public.matches(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  gagnant_prevu  uuid not null references public.profiles(id),
  cree_le        timestamptz not null default now(),
  primary key (match_id, profile_id)
);
create index if not exists pronostics_profile_idx on public.pronostics (profile_id);
alter table public.pronostics enable row level security;
create policy "un joueur voit ses pronostics" on public.pronostics
  for select using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.pronostics from anon, authenticated;

-- Points d'un pronostic juste selon le tour : 2 en finale, 1 en
-- demi-finale, 0 avant (pas de pronostic possible).
create or replace function public.points_pronostic(p_tour smallint, p_capacite integer)
returns integer
language sql
immutable
as $$
  select case
    when p_capacite < 4 then 0
    when p_tour = round(log(2, p_capacite::numeric))::integer then 2
    when p_tour = round(log(2, p_capacite::numeric))::integer - 1 then 1
    else 0
  end;
$$;

create or replace function public.pronostiquer(p_match_id uuid, p_gagnant uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_match record;
begin
  if v_moi is null then
    raise exception 'NON_CONNECTE';
  end if;
  if exists (select 1 from public.suspensions where profile_id = v_moi and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;

  select m.id, m.tour, m.statut, m.demarre_le, t.id as tournament_id, t.capacite, t.nature,
         t.statut as statut_tournoi, t.organisateur_id
  into v_match
  from public.matches m join public.tournaments t on t.id = m.tournament_id
  where m.id = p_match_id
  for update of m;
  if not found then
    raise exception 'MATCH_INTROUVABLE';
  end if;
  if v_match.nature <> 'tournoi' or public.points_pronostic(v_match.tour, v_match.capacite) = 0 then
    raise exception 'PRONOSTIC_HORS_PHASE';
  end if;
  if v_match.organisateur_id = v_moi
     or exists (select 1 from public.registrations r
                where r.tournament_id = v_match.tournament_id and r.profile_id = v_moi and r.statut <> 'retire')
     or exists (select 1 from public.alignements a
                where a.tournament_id = v_match.tournament_id and a.profile_id = v_moi) then
    raise exception 'JOUEUR_DU_TOURNOI';
  end if;
  if (select count(*) from public.match_participants where match_id = p_match_id) <> 2
     or not exists (select 1 from public.match_participants where match_id = p_match_id and profile_id = p_gagnant) then
    raise exception 'CHOIX_INVALIDE';
  end if;
  if v_match.statut_tournoi <> 'en_cours'
     or v_match.statut not in ('en_attente', 'en_cours')
     or (v_match.demarre_le is not null and v_match.demarre_le < now() - interval '10 minutes')
     or exists (select 1 from public.match_participants where match_id = p_match_id and pret_le is not null)
     or exists (select 1 from public.match_verdicts where match_id = p_match_id and est_definitif) then
    raise exception 'PRONOSTIC_FERME';
  end if;

  insert into public.pronostics (match_id, profile_id, gagnant_prevu)
  values (p_match_id, v_moi, p_gagnant)
  on conflict (match_id, profile_id) do update set gagnant_prevu = excluded.gagnant_prevu, cree_le = now();
  return true;
end;
$$;
revoke execute on function public.pronostiquer(uuid, uuid) from public, anon;
grant execute on function public.pronostiquer(uuid, uuid) to authenticated;

-- Répartition publique des pronostics d'un tournoi (jamais qui a voté quoi).
create or replace function public.repartition_pronostics(p_tournament_id uuid)
returns table (match_id uuid, gagnant_prevu uuid, nombre integer)
language sql
stable
security definer set search_path = public
as $$
  select p.match_id, p.gagnant_prevu, count(*)::integer
  from public.pronostics p
  join public.matches m on m.id = p.match_id
  where m.tournament_id = p_tournament_id
  group by p.match_id, p.gagnant_prevu;
$$;
grant execute on function public.repartition_pronostics(uuid) to anon, authenticated;

-- Classement des pronostiqueurs de la saison en cours : seuls les
-- pronostics tranchés par un résultat lu chez Riot comptent.
create or replace function public.classement_pronostics(p_limite integer default 50)
returns table (profile_id uuid, pseudo text, slug text, points integer, justes integer, comptes integer)
language sql
stable
security definer set search_path = public
as $$
  select pr.id, pr.pseudo, pr.slug,
         sum(case when v.gagnant_id = p.gagnant_prevu then public.points_pronostic(m.tour, t.capacite) else 0 end)::integer,
         count(*) filter (where v.gagnant_id = p.gagnant_prevu)::integer,
         count(*)::integer
  from public.pronostics p
  join public.profiles pr on pr.id = p.profile_id and pr.supprime_le is null
  join public.matches m on m.id = p.match_id
  join public.tournaments t on t.id = m.tournament_id
  join public.seasons s on s.id = t.season_id and s.est_courante
  join public.match_verdicts v on v.match_id = m.id and v.est_definitif
    and v.niveau <> 'manuel' and v.gagnant_id is not null
  group by pr.id, pr.pseudo, pr.slug
  order by 4 desc, 5 desc, 6 asc, pr.pseudo
  limit least(greatest(p_limite, 1), 200);
$$;
grant execute on function public.classement_pronostics(integer) to anon, authenticated;

-- ---------- Espaces communauté (2026-10-03, audit N30) ----------
-- À appliquer sur la base AVANT la mise en ligne du code du même commit.
-- Une communauté (serveur Discord, association, école…) a sa page : ses
-- tournois, le classement interne de ses membres (leur rating officiel,
-- jamais un rating à part) et ses membres. Créée par un compte de l'offre
-- Organisateur (3 au plus), rejointe librement. Son serveur Discord se lie
-- par un code à usage unique saisi avec la commande /lier du bot, par un
-- membre du serveur autorisé à le gérer : personne ne s'approprie le
-- serveur d'un autre.
create table if not exists public.communautes (
  id                     uuid primary key default gen_random_uuid(),
  game_id                smallint not null default 1 references public.games(id),
  slug                   text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  nom                    text not null check (char_length(btrim(nom)) between 3 and 40),
  description            text check (char_length(description) <= 500),
  couleur                text not null default '#2BD47D' check (couleur ~ '^#[0-9A-Fa-f]{6}$'),
  lien_discord           text check (lien_discord is null or lien_discord ~ '^https://(discord\.gg|discord\.com/invite)/[A-Za-z0-9-]{2,40}$'),
  discord_guild_id       text unique check (discord_guild_id is null or discord_guild_id ~ '^[0-9]{5,25}$'),
  code_liaison           text unique,
  code_liaison_expire_le timestamptz,
  proprietaire_id        uuid not null references public.profiles(id) on delete cascade,
  cree_le                timestamptz not null default now()
);
create index if not exists communautes_proprietaire_idx on public.communautes (proprietaire_id);
alter table public.communautes enable row level security;
create policy "communautes lisibles par tous" on public.communautes for select using (true);
revoke insert, update, delete on public.communautes from anon, authenticated;
-- Le code de liaison ne se lit que par code_liaison_discord (propriétaire).
revoke select on public.communautes from anon, authenticated;
grant select (id, game_id, slug, nom, description, couleur, lien_discord, discord_guild_id, proprietaire_id, cree_le)
  on public.communautes to anon, authenticated;

create table if not exists public.membres_communaute (
  communaute_id uuid not null references public.communautes(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role          text not null default 'membre' check (role in ('proprietaire', 'admin', 'membre')),
  rejoint_le    timestamptz not null default now(),
  primary key (communaute_id, profile_id)
);
create index if not exists membres_communaute_profile_idx on public.membres_communaute (profile_id);
alter table public.membres_communaute enable row level security;
create policy "membres de communaute lisibles par tous" on public.membres_communaute for select using (true);
revoke insert, update, delete on public.membres_communaute from anon, authenticated;

alter table public.tournaments add column if not exists communaute_id uuid references public.communautes(id) on delete set null;
create index if not exists tournaments_communaute_idx on public.tournaments (communaute_id);

-- Textes libres de la communauté : modérés comme ceux d'une équipe.
create or replace function public.moderer_communaute()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(public.analyser_texte(new.nom, 'nom'), '') like 'refus:%' then
    raise exception 'NOM_INTERDIT';
  end if;
  if coalesce(public.analyser_texte(new.description, 'texte_public'), '') like 'refus:%' then
    raise exception 'TEXTE_INTERDIT';
  end if;
  return new;
end;
$$;
revoke execute on function public.moderer_communaute() from public, anon, authenticated;
drop trigger if exists moderation_communaute on public.communautes;
create trigger moderation_communaute
  before insert or update of nom, description on public.communautes
  for each row execute function public.moderer_communaute();

-- Un tournoi n'est publié dans une communauté que par son propriétaire ou
-- un de ses administrateurs.
create or replace function public.controler_communaute_tournoi()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.communaute_id is not null
     and (tg_op = 'INSERT' or new.communaute_id is distinct from old.communaute_id)
     and not exists (
       select 1 from public.membres_communaute
       where communaute_id = new.communaute_id and profile_id = new.organisateur_id
         and role in ('proprietaire', 'admin')
     ) then
    raise exception 'COMMUNAUTE_INTERDITE';
  end if;
  return new;
end;
$$;
revoke execute on function public.controler_communaute_tournoi() from public, anon, authenticated;
drop trigger if exists controle_communaute_tournoi on public.tournaments;
create trigger controle_communaute_tournoi
  before insert or update of communaute_id on public.tournaments
  for each row execute function public.controler_communaute_tournoi();

create or replace function public.creer_communaute(
  p_nom text, p_slug text, p_description text default null, p_couleur text default '#2BD47D',
  p_lien_discord text default null
)
returns text -- slug
language plpgsql
security definer set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_id uuid;
begin
  if v_moi is null then
    raise exception 'NON_CONNECTE';
  end if;
  if exists (select 1 from public.suspensions where profile_id = v_moi and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;
  if not exists (select 1 from public.comptes_offres where profile_id = v_moi and offre = 'organisateur') then
    raise exception 'OFFRE_ORGANISATEUR_REQUISE';
  end if;
  perform 1 from public.profiles where id = v_moi for update;
  if (select count(*) from public.communautes where proprietaire_id = v_moi) >= 3 then
    raise exception 'TROP_DE_COMMUNAUTES';
  end if;

  insert into public.communautes (slug, nom, description, couleur, lien_discord, proprietaire_id)
  values (p_slug, btrim(p_nom), nullif(btrim(coalesce(p_description, '')), ''), upper(p_couleur),
          nullif(btrim(coalesce(p_lien_discord, '')), ''), v_moi)
  returning id into v_id;
  insert into public.membres_communaute (communaute_id, profile_id, role) values (v_id, v_moi, 'proprietaire');
  return p_slug;
end;
$$;
revoke execute on function public.creer_communaute(text, text, text, text, text) from public, anon;
grant execute on function public.creer_communaute(text, text, text, text, text) to authenticated;

-- Rôle du joueur connecté dans une communauté, ou nul.
create or replace function public.role_communaute(p_communaute_id uuid, p_profile_id uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.membres_communaute where communaute_id = p_communaute_id and profile_id = p_profile_id;
$$;
revoke all on function public.role_communaute(uuid, uuid) from public, anon, authenticated;

create or replace function public.modifier_communaute(
  p_communaute_id uuid, p_description text, p_couleur text, p_lien_discord text
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(public.role_communaute(p_communaute_id, auth.uid()), '') not in ('proprietaire', 'admin') then
    raise exception 'GESTION_RESERVEE';
  end if;
  update public.communautes
  set description = nullif(btrim(coalesce(p_description, '')), ''),
      couleur = upper(p_couleur),
      lien_discord = nullif(btrim(coalesce(p_lien_discord, '')), '')
  where id = p_communaute_id;
  return found;
end;
$$;
revoke execute on function public.modifier_communaute(uuid, text, text, text) from public, anon;
grant execute on function public.modifier_communaute(uuid, text, text, text) to authenticated;

create or replace function public.rejoindre_communaute(p_communaute_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
begin
  if v_moi is null then
    raise exception 'NON_CONNECTE';
  end if;
  if exists (select 1 from public.suspensions where profile_id = v_moi and levee_le is null) then
    raise exception 'COMPTE_SUSPENDU';
  end if;
  if not exists (select 1 from public.communautes where id = p_communaute_id) then
    raise exception 'COMMUNAUTE_INTROUVABLE';
  end if;
  insert into public.membres_communaute (communaute_id, profile_id) values (p_communaute_id, v_moi)
  on conflict do nothing;
  return found;
end;
$$;
revoke execute on function public.rejoindre_communaute(uuid) from public, anon;
grant execute on function public.rejoindre_communaute(uuid) to authenticated;

create or replace function public.quitter_communaute(p_communaute_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if public.role_communaute(p_communaute_id, auth.uid()) = 'proprietaire' then
    raise exception 'COMMUNAUTE_PROPRIETAIRE';
  end if;
  delete from public.membres_communaute where communaute_id = p_communaute_id and profile_id = auth.uid();
  return found;
end;
$$;
revoke execute on function public.quitter_communaute(uuid) from public, anon;
grant execute on function public.quitter_communaute(uuid) to authenticated;

-- Le propriétaire (ou un administrateur, sauf envers un autre
-- administrateur) retire un membre ; le propriétaire nomme les
-- administrateurs.
create or replace function public.retirer_membre_communaute(p_communaute_id uuid, p_profile_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_mon_role text := public.role_communaute(p_communaute_id, auth.uid());
  v_son_role text := public.role_communaute(p_communaute_id, p_profile_id);
begin
  if v_mon_role is null or v_mon_role = 'membre' then
    raise exception 'GESTION_RESERVEE';
  end if;
  if v_son_role = 'proprietaire' or (v_son_role = 'admin' and v_mon_role <> 'proprietaire') then
    raise exception 'GESTION_RESERVEE';
  end if;
  delete from public.membres_communaute where communaute_id = p_communaute_id and profile_id = p_profile_id;
  return found;
end;
$$;
revoke execute on function public.retirer_membre_communaute(uuid, uuid) from public, anon;
grant execute on function public.retirer_membre_communaute(uuid, uuid) to authenticated;

create or replace function public.nommer_admin_communaute(p_communaute_id uuid, p_profile_id uuid, p_admin boolean)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(public.role_communaute(p_communaute_id, auth.uid()), '') <> 'proprietaire' then
    raise exception 'GESTION_RESERVEE';
  end if;
  update public.membres_communaute
  set role = case when p_admin then 'admin' else 'membre' end
  where communaute_id = p_communaute_id and profile_id = p_profile_id and role <> 'proprietaire';
  return found;
end;
$$;
revoke execute on function public.nommer_admin_communaute(uuid, uuid, boolean) from public, anon;
grant execute on function public.nommer_admin_communaute(uuid, uuid, boolean) to authenticated;

-- Liaison du serveur Discord : le propriétaire obtient un code (30 min),
-- qu'un gestionnaire du serveur saisit avec /lier ; le serveur (tâche
-- Discord du site, rôle service) enregistre alors l'identifiant du serveur.
create or replace function public.code_liaison_discord(p_communaute_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  if coalesce(public.role_communaute(p_communaute_id, auth.uid()), '') <> 'proprietaire' then
    raise exception 'GESTION_RESERVEE';
  end if;
  update public.communautes
  set code_liaison = v_code, code_liaison_expire_le = now() + interval '30 minutes'
  where id = p_communaute_id;
  return v_code;
end;
$$;
revoke execute on function public.code_liaison_discord(uuid) from public, anon;
grant execute on function public.code_liaison_discord(uuid) to authenticated;

create or replace function public.lier_serveur_discord(p_code text, p_guild_id text)
returns text -- nom de la communauté liée
language plpgsql
security definer set search_path = public
as $$
declare
  v_communaute record;
begin
  select * into v_communaute from public.communautes
  where code_liaison = upper(btrim(p_code)) and code_liaison_expire_le > now()
  for update;
  if not found then
    raise exception 'CODE_INVALIDE';
  end if;
  if exists (select 1 from public.communautes where discord_guild_id = p_guild_id and id <> v_communaute.id) then
    raise exception 'SERVEUR_DEJA_LIE';
  end if;
  update public.communautes
  set discord_guild_id = p_guild_id, code_liaison = null, code_liaison_expire_le = null
  where id = v_communaute.id;
  return v_communaute.nom;
end;
$$;
revoke all on function public.lier_serveur_discord(text, text) from public, anon, authenticated;
grant execute on function public.lier_serveur_discord(text, text) to service_role;

create or replace function public.delier_serveur_discord(p_communaute_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(public.role_communaute(p_communaute_id, auth.uid()), '') <> 'proprietaire' then
    raise exception 'GESTION_RESERVEE';
  end if;
  update public.communautes set discord_guild_id = null where id = p_communaute_id;
  return found;
end;
$$;
revoke execute on function public.delier_serveur_discord(uuid) from public, anon;
grant execute on function public.delier_serveur_discord(uuid) to authenticated;
