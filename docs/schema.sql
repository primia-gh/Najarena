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
