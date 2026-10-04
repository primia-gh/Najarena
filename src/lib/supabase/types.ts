export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          ajoute_le: string
          profile_id: string
        }
        Insert: {
          ajoute_le?: string
          profile_id: string
        }
        Update: {
          ajoute_le?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agents_libres: {
        Row: {
          inscrit_le: string
          profile_id: string
          rating_a_inscription: number | null
          registration_id: string | null
          role: string | null
          statut: string
          tournament_id: string
        }
        Insert: {
          inscrit_le?: string
          profile_id: string
          rating_a_inscription?: number | null
          registration_id?: string | null
          role?: string | null
          statut?: string
          tournament_id: string
        }
        Update: {
          inscrit_le?: string
          profile_id?: string
          rating_a_inscription?: number | null
          registration_id?: string | null
          role?: string | null
          statut?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_libres_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_libres_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_libres_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      alignements: {
        Row: {
          aligne_le: string
          profile_id: string
          registration_id: string
          tournament_id: string
        }
        Insert: {
          aligne_le?: string
          profile_id: string
          registration_id: string
          tournament_id: string
        }
        Update: {
          aligne_le?: string
          profile_id?: string
          registration_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alignements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignements_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alignements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      anciens_slugs: {
        Row: {
          profile_id: string
          remplace_le: string
          slug: string
        }
        Insert: {
          profile_id: string
          remplace_le?: string
          slug: string
        }
        Update: {
          profile_id?: string
          remplace_le?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "anciens_slugs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      abonnements_stripe: {
        Row: {
          abonnement_stripe_id: string | null
          client_stripe_id: string
          maj_le: string
          profile_id: string
          statut: string | null
        }
        Insert: {
          abonnement_stripe_id?: string | null
          client_stripe_id: string
          maj_le?: string
          profile_id: string
          statut?: string | null
        }
        Update: {
          abonnement_stripe_id?: string | null
          client_stripe_id?: string
          maj_le?: string
          profile_id?: string
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abonnements_stripe_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appels_assistant_ia: {
        Row: {
          cree_le: string
          id: number
          profile_id: string
        }
        Insert: {
          cree_le?: string
          id?: never
          profile_id: string
        }
        Update: {
          cree_le?: string
          id?: never
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appels_assistant_ia_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificats: {
        Row: {
          code: string
          cree_le: string
          est_classe: boolean
          game_id: number
          matchs_verifies: number
          palier: string | null
          profile_id: string
          rating: number
          rd: number
          registre_empreinte: string | null
          registre_numero: number | null
          saison: string | null
          victoires: number
        }
        Insert: {
          code: string
          cree_le?: string
          est_classe: boolean
          game_id: number
          matchs_verifies: number
          palier?: string | null
          profile_id: string
          rating: number
          rd: number
          registre_empreinte?: string | null
          registre_numero?: number | null
          saison?: string | null
          victoires: number
        }
        Update: {
          code?: string
          cree_le?: string
          est_classe?: boolean
          game_id?: number
          matchs_verifies?: number
          palier?: string | null
          profile_id?: string
          rating?: number
          rd?: number
          registre_empreinte?: string | null
          registre_numero?: number | null
          saison?: string | null
          victoires?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comptes_offres: {
        Row: {
          attribue_le: string
          attribue_par: string | null
          bio: string | null
          lien_externe: string | null
          offre: string
          profile_id: string
        }
        Insert: {
          attribue_le?: string
          attribue_par?: string | null
          bio?: string | null
          lien_externe?: string | null
          offre: string
          profile_id: string
        }
        Update: {
          attribue_le?: string
          attribue_par?: string | null
          bio?: string | null
          lien_externe?: string | null
          offre?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comptes_offres_attribue_par_fkey"
            columns: ["attribue_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comptes_offres_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dotations: {
        Row: {
          cree_le: string
          cree_par: string
          repartition: number[]
          sponsor_lien: string | null
          sponsor_nom: string
          statut: string
          tournament_id: string
        }
        Insert: {
          cree_le?: string
          cree_par: string
          repartition: number[]
          sponsor_lien?: string | null
          sponsor_nom: string
          statut?: string
          tournament_id: string
        }
        Update: {
          cree_le?: string
          cree_par?: string
          repartition?: number[]
          sponsor_lien?: string | null
          sponsor_nom?: string
          statut?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dotations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      versements_dotation: {
        Row: {
          a_verifier: boolean
          maj_le: string
          montant_centimes: number
          profile_id: string
          rang: number
          reference: string | null
          statut: string
          tournament_id: string
        }
        Insert: {
          a_verifier?: boolean
          maj_le?: string
          montant_centimes: number
          profile_id: string
          rang: number
          reference?: string | null
          statut?: string
          tournament_id: string
        }
        Update: {
          a_verifier?: boolean
          maj_le?: string
          montant_centimes?: number
          profile_id?: string
          rang?: number
          reference?: string | null
          statut?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "versements_dotation_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "dotations"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "versements_dotation_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communautes: {
        Row: {
          code_liaison: string | null
          code_liaison_expire_le: string | null
          couleur: string
          cree_le: string
          description: string | null
          discord_guild_id: string | null
          domaines_email: string[]
          game_id: number
          id: string
          lien_discord: string | null
          nom: string
          proprietaire_id: string
          slug: string
          type: string
        }
        Insert: {
          code_liaison?: string | null
          code_liaison_expire_le?: string | null
          couleur?: string
          cree_le?: string
          description?: string | null
          discord_guild_id?: string | null
          domaines_email?: string[]
          game_id?: number
          id?: string
          lien_discord?: string | null
          nom: string
          proprietaire_id: string
          slug: string
          type?: string
        }
        Update: {
          code_liaison?: string | null
          code_liaison_expire_le?: string | null
          couleur?: string
          cree_le?: string
          description?: string | null
          discord_guild_id?: string | null
          domaines_email?: string[]
          game_id?: number
          id?: string
          lien_discord?: string | null
          nom?: string
          proprietaire_id?: string
          slug?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communautes_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membres_communaute: {
        Row: {
          communaute_id: string
          domaine: string | null
          email_empreinte: string | null
          profile_id: string
          rejoint_le: string
          role: string
          verifie_le: string | null
        }
        Insert: {
          communaute_id: string
          domaine?: string | null
          email_empreinte?: string | null
          profile_id: string
          rejoint_le?: string
          role?: string
          verifie_le?: string | null
        }
        Update: {
          communaute_id?: string
          domaine?: string | null
          email_empreinte?: string | null
          profile_id?: string
          rejoint_le?: string
          role?: string
          verifie_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membres_communaute_communaute_id_fkey"
            columns: ["communaute_id"]
            isOneToOne: false
            referencedRelation: "communautes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membres_communaute_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      echecs_revue_ia: {
        Row: {
          dernier_le: string
          essais: number
          match_id: string
          profile_id: string
        }
        Insert: {
          dernier_le?: string
          essais?: number
          match_id: string
          profile_id: string
        }
        Update: {
          dernier_le?: string
          essais?: number
          match_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "echecs_revue_ia_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "echecs_revue_ia_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verifications_ecole: {
        Row: {
          code_empreinte: string
          communaute_id: string
          domaine: string
          email_empreinte: string
          envois: number
          essais: number
          expire_le: string
          premier_envoi_le: string
          profile_id: string
        }
        Insert: {
          code_empreinte: string
          communaute_id: string
          domaine: string
          email_empreinte: string
          envois?: number
          essais?: number
          expire_le: string
          premier_envoi_le?: string
          profile_id: string
        }
        Update: {
          code_empreinte?: string
          communaute_id?: string
          domaine?: string
          email_empreinte?: string
          envois?: number
          essais?: number
          expire_le?: string
          premier_envoi_le?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_ecole_communaute_id_fkey"
            columns: ["communaute_id"]
            isOneToOne: false
            referencedRelation: "communautes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_ecole_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pronostics: {
        Row: {
          cree_le: string
          gagnant_prevu: string
          match_id: string
          profile_id: string
        }
        Insert: {
          cree_le?: string
          gagnant_prevu: string
          match_id: string
          profile_id: string
        }
        Update: {
          cree_le?: string
          gagnant_prevu?: string
          match_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pronostics_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pronostics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pronostics_gagnant_prevu_fkey"
            columns: ["gagnant_prevu"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_arene: {
        Row: {
          condition_victoire: string
          entree_le: string
          profile_id: string
          rating: number
          rd: number
          region: string
        }
        Insert: {
          condition_victoire?: string
          entree_le?: string
          profile_id: string
          rating: number
          rd: number
          region: string
        }
        Update: {
          condition_victoire?: string
          entree_le?: string
          profile_id?: string
          rating?: number
          rd?: number
          region?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_arene_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      defis: {
        Row: {
          adversaire_id: string | null
          code_invitation: string | null
          condition_victoire: string
          cree_le: string
          expire_le: string
          id: string
          lanceur_id: string
          repondu_le: string | null
          statut: string
          tournament_id: string | null
        }
        Insert: {
          adversaire_id?: string | null
          code_invitation?: string | null
          condition_victoire?: string
          cree_le?: string
          expire_le: string
          id?: string
          lanceur_id: string
          repondu_le?: string | null
          statut?: string
          tournament_id?: string | null
        }
        Update: {
          adversaire_id?: string | null
          code_invitation?: string | null
          condition_victoire?: string
          cree_le?: string
          expire_le?: string
          id?: string
          lanceur_id?: string
          repondu_le?: string | null
          statut?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "defis_lanceur_id_fkey"
            columns: ["lanceur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defis_adversaire_id_fkey"
            columns: ["adversaire_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defis_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          cree_le: string
          id: string
          profile_a: string
          profile_b: string
        }
        Insert: {
          cree_le?: string
          id?: string
          profile_a: string
          profile_b: string
        }
        Update: {
          cree_le?: string
          id?: string
          profile_a?: string
          profile_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_profile_a_fkey"
            columns: ["profile_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_profile_b_fkey"
            columns: ["profile_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          cree_le: string
          id: string
          match_id: string
          motif: string
          ouvert_par: string
          resolu_le: string | null
          resolu_par: string | null
          resolution: string | null
        }
        Insert: {
          cree_le?: string
          id?: string
          match_id: string
          motif: string
          ouvert_par: string
          resolu_le?: string | null
          resolu_par?: string | null
          resolution?: string | null
        }
        Update: {
          cree_le?: string
          id?: string
          match_id?: string
          motif?: string
          ouvert_par?: string
          resolu_le?: string | null
          resolu_par?: string | null
          resolution?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_ouvert_par_fkey"
            columns: ["ouvert_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolu_par_fkey"
            columns: ["resolu_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers_litige: {
        Row: {
          cree_le: string
          cree_par: string | null
          dispute_id: string
          faits: string[]
          modele: string
          synthese: Json
        }
        Insert: {
          cree_le?: string
          cree_par?: string | null
          dispute_id: string
          faits: string[]
          modele: string
          synthese: Json
        }
        Update: {
          cree_le?: string
          cree_par?: string | null
          dispute_id?: string
          faits?: string[]
          modele?: string
          synthese?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_litige_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_litige_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: true
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      echeances: {
        Row: {
          cle_externe: string | null
          cree_par: string | null
          debut_le: string
          id: string
          lien_officiel: string | null
          maj_le: string
          nom: string
          region: string | null
          source: string
          type: string
        }
        Insert: {
          cle_externe?: string | null
          cree_par?: string | null
          debut_le: string
          id?: string
          lien_officiel?: string | null
          maj_le?: string
          nom: string
          region?: string | null
          source?: string
          type: string
        }
        Update: {
          cle_externe?: string | null
          cree_par?: string | null
          debut_le?: string
          id?: string
          lien_officiel?: string | null
          maj_le?: string
          nom?: string
          region?: string | null
          source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "echeances_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empreintes_publiees: {
        Row: {
          empreinte: string
          jour: string
          numero: number
          publiee_le: string
        }
        Insert: {
          empreinte: string
          jour: string
          numero: number
          publiee_le?: string
        }
        Update: {
          empreinte?: string
          jour?: string
          numero?: number
          publiee_le?: string
        }
        Relationships: []
      }
      game_accounts: {
        Row: {
          defi_icone_id: number | null
          derniere_sync_le: string | null
          est_principal: boolean
          game_id: number
          id: string
          methode_verification: string | null
          profile_id: string
          puuid: string
          region: string
          riot_game_name: string
          riot_tag_line: string
          role_prefere: string | null
          verifie_le: string | null
        }
        Insert: {
          defi_icone_id?: number | null
          derniere_sync_le?: string | null
          est_principal?: boolean
          game_id: number
          id?: string
          methode_verification?: string | null
          profile_id: string
          puuid: string
          region: string
          riot_game_name: string
          riot_tag_line: string
          role_prefere?: string | null
          verifie_le?: string | null
        }
        Update: {
          defi_icone_id?: number | null
          derniere_sync_le?: string | null
          est_principal?: boolean
          game_id?: number
          id?: string
          methode_verification?: string | null
          profile_id?: string
          puuid?: string
          region?: string
          riot_game_name?: string
          riot_tag_line?: string
          role_prefere?: string | null
          verifie_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_accounts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          actif: boolean
          id: number
          nom: string
          slug: string
        }
        Insert: {
          actif?: boolean
          id: number
          nom: string
          slug: string
        }
        Update: {
          actif?: boolean
          id?: number
          nom?: string
          slug?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          cree_le: string
          email: string
          id: number
          ip: string | null
        }
        Insert: {
          cree_le?: string
          email: string
          id?: never
          ip?: string | null
        }
        Update: {
          cree_le?: string
          email?: string
          id?: never
          ip?: string | null
        }
        Relationships: []
      }
      moderation_signalements: {
        Row: {
          auteur_id: string | null
          cible_id: string
          contexte: string
          cree_le: string
          extrait: string
          id: string
          raison: string
          statut: string
          traite_le: string | null
          traite_par: string | null
        }
        Insert: {
          auteur_id?: string | null
          cible_id: string
          contexte: string
          cree_le?: string
          extrait: string
          id?: string
          raison: string
          statut?: string
          traite_le?: string | null
          traite_par?: string | null
        }
        Update: {
          auteur_id?: string | null
          cible_id?: string
          contexte?: string
          cree_le?: string
          extrait?: string
          id?: string
          raison?: string
          statut?: string
          traite_le?: string | null
          traite_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_signalements_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          est_gagnant: boolean | null
          match_id: string
          pret_le: string | null
          profile_id: string
          score: number
          slot: number
        }
        Insert: {
          est_gagnant?: boolean | null
          match_id: string
          pret_le?: string | null
          profile_id: string
          score?: number
          slot: number
        }
        Update: {
          est_gagnant?: boolean | null
          match_id?: string
          pret_le?: string | null
          profile_id?: string
          score?: number
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_verdicts: {
        Row: {
          cree_le: string
          decide_par: string | null
          est_definitif: boolean
          gagnant_id: string | null
          id: string
          match_id: string
          motif: string | null
          niveau: Database["public"]["Enums"]["verdict_level"]
          riot_match_id: string | null
        }
        Insert: {
          cree_le?: string
          decide_par?: string | null
          est_definitif?: boolean
          gagnant_id?: string | null
          id?: string
          match_id: string
          motif?: string | null
          niveau: Database["public"]["Enums"]["verdict_level"]
          riot_match_id?: string | null
        }
        Update: {
          cree_le?: string
          decide_par?: string | null
          est_definitif?: boolean
          gagnant_id?: string | null
          id?: string
          match_id?: string
          motif?: string | null
          niveau?: Database["public"]["Enums"]["verdict_level"]
          riot_match_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_verdicts_decide_par_fkey"
            columns: ["decide_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_verdicts_gagnant_id_fkey"
            columns: ["gagnant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_verdicts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          code_tournoi: string | null
          defaite_reconnue_le: string | null
          defaite_reconnue_par: string | null
          demarre_le: string | null
          id: string
          match_suivant_id: string | null
          position: number
          statut: Database["public"]["Enums"]["match_status"]
          tour: number
          tournament_id: string
        }
        Insert: {
          code_tournoi?: string | null
          defaite_reconnue_le?: string | null
          defaite_reconnue_par?: string | null
          demarre_le?: string | null
          id?: string
          match_suivant_id?: string | null
          position: number
          statut?: Database["public"]["Enums"]["match_status"]
          tour: number
          tournament_id: string
        }
        Update: {
          code_tournoi?: string | null
          defaite_reconnue_le?: string | null
          defaite_reconnue_par?: string | null
          demarre_le?: string | null
          id?: string
          match_suivant_id?: string | null
          position?: number
          statut?: Database["public"]["Enums"]["match_status"]
          tour?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_defaite_reconnue_par_fkey"
            columns: ["defaite_reconnue_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_match_suivant_id_fkey"
            columns: ["match_suivant_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          contenu: string
          conversation_id: string
          en_revue: boolean
          envoye_le: string
          expediteur_id: string
          id: string
          lu_le: string | null
        }
        Insert: {
          contenu: string
          conversation_id: string
          en_revue?: boolean
          envoye_le?: string
          expediteur_id: string
          id?: string
          lu_le?: string | null
        }
        Update: {
          contenu?: string
          conversation_id?: string
          en_revue?: boolean
          envoye_le?: string
          expediteur_id?: string
          id?: string
          lu_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_expediteur_id_fkey"
            columns: ["expediteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          consentement_le: string | null
          consentement_version: string | null
          created_at: string
          discord_id: string | null
          id: string
          pays: string | null
          pseudo: string
          pseudo_modifie_le: string | null
          slug: string
          supprime_le: string | null
          visites_anonymes: boolean
        }
        Insert: {
          avatar_url?: string | null
          consentement_le?: string | null
          consentement_version?: string | null
          created_at?: string
          discord_id?: string | null
          id: string
          pays?: string | null
          pseudo: string
          pseudo_modifie_le?: string | null
          slug: string
          supprime_le?: string | null
          visites_anonymes?: boolean
        }
        Update: {
          avatar_url?: string | null
          consentement_le?: string | null
          consentement_version?: string | null
          created_at?: string
          discord_id?: string | null
          id?: string
          pays?: string | null
          pseudo?: string
          pseudo_modifie_le?: string | null
          slug?: string
          supprime_le?: string | null
          visites_anonymes?: boolean
        }
        Relationships: []
      }
      suspensions: {
        Row: {
          id: string
          levee_le: string | null
          levee_par: string | null
          motif: string
          profile_id: string
          suspendu_le: string
          suspendu_par: string | null
        }
        Insert: {
          id?: string
          levee_le?: string | null
          levee_par?: string | null
          motif: string
          profile_id: string
          suspendu_le?: string
          suspendu_par?: string | null
        }
        Update: {
          id?: string
          levee_le?: string | null
          levee_par?: string | null
          motif?: string
          profile_id?: string
          suspendu_le?: string
          suspendu_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suspensions_levee_par_fkey"
            columns: ["levee_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspensions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspensions_suspendu_par_fkey"
            columns: ["suspendu_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          cree_le: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth: string
          cree_le?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth?: string
          cree_le?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rappels_tournoi: {
        Row: {
          envoye_le: string
          tournament_id: string
          type: string
        }
        Insert: {
          envoye_le?: string
          tournament_id: string
          type: string
        }
        Update: {
          envoye_le?: string
          tournament_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rappels_tournoi_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_events: {
        Row: {
          adversaire_id: string | null
          cree_le: string
          empreinte: string
          empreinte_precedente: string
          game_id: number
          id: number
          match_id: string | null
          motif: string
          numero: number
          profile_id: string
          rating_apres: number
          rating_avant: number
          rd_apres: number
          rd_avant: number
          season_id: string
          tournament_id: string | null
        }
        Insert: {
          adversaire_id?: string | null
          cree_le?: string
          empreinte?: string
          empreinte_precedente?: string
          game_id: number
          id?: number
          match_id?: string | null
          motif: string
          numero?: number
          profile_id: string
          rating_apres: number
          rating_avant: number
          rd_apres: number
          rd_avant: number
          season_id: string
          tournament_id?: string | null
        }
        Update: {
          adversaire_id?: string | null
          cree_le?: string
          empreinte?: string
          empreinte_precedente?: string
          game_id?: number
          id?: number
          match_id?: string | null
          motif?: string
          numero?: number
          profile_id?: string
          rating_apres?: number
          rating_avant?: number
          rd_apres?: number
          rd_avant?: number
          season_id?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_events_adversaire_id_fkey"
            columns: ["adversaire_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          est_classe: boolean | null
          game_id: number
          maj_le: string
          matchs_joues: number
          profile_id: string
          rating: number
          rd: number
          season_id: string
          volatilite: number
        }
        Insert: {
          est_classe?: boolean | null
          game_id: number
          maj_le?: string
          matchs_joues?: number
          profile_id: string
          rating?: number
          rd?: number
          season_id: string
          volatilite?: number
        }
        Update: {
          est_classe?: boolean | null
          game_id?: number
          maj_le?: string
          matchs_joues?: number
          profile_id?: string
          rating?: number
          rd?: number
          season_id?: string
          volatilite?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      recherches_coequipiers: {
        Row: {
          cree_le: string
          message: string | null
          objectif_id: string | null
          profile_id: string
        }
        Insert: {
          cree_le?: string
          message?: string | null
          objectif_id?: string | null
          profile_id: string
        }
        Update: {
          cree_le?: string
          message?: string | null
          objectif_id?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recherches_coequipiers_objectif_id_fkey"
            columns: ["objectif_id"]
            isOneToOne: false
            referencedRelation: "echeances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recherches_coequipiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recaps_semaine: {
        Row: {
          annonce: boolean
          publie_le: string
          semaine: string
        }
        Insert: {
          annonce: boolean
          publie_le?: string
          semaine: string
        }
        Update: {
          annonce?: boolean
          publie_le?: string
          semaine?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          confirme_le: string | null
          equipe_nom: string | null
          equipe_tag: string | null
          id: string
          inscrit_le: string
          profile_id: string
          rating_a_inscription: number | null
          seed: number | null
          statut: Database["public"]["Enums"]["registration_status"]
          team_id: string | null
          tournament_id: string
        }
        Insert: {
          confirme_le?: string | null
          equipe_nom?: string | null
          equipe_tag?: string | null
          id?: string
          inscrit_le?: string
          profile_id: string
          rating_a_inscription?: number | null
          seed?: number | null
          statut?: Database["public"]["Enums"]["registration_status"]
          team_id?: string | null
          tournament_id: string
        }
        Update: {
          confirme_le?: string | null
          equipe_nom?: string | null
          equipe_tag?: string | null
          id?: string
          inscrit_le?: string
          profile_id?: string
          rating_a_inscription?: number | null
          seed?: number | null
          statut?: Database["public"]["Enums"]["registration_status"]
          team_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      revues_match_ia: {
        Row: {
          conseil: string
          cree_le: string
          match_id: string
          modele: string
          points: string[]
          profile_id: string
        }
        Insert: {
          conseil: string
          cree_le?: string
          match_id: string
          modele: string
          points: string[]
          profile_id: string
        }
        Update: {
          conseil?: string
          cree_le?: string
          match_id?: string
          modele?: string
          points?: string[]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revues_match_ia_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revues_match_ia_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scrims: {
        Row: {
          best_of: number
          cree_le: string
          equipe_a_id: string
          equipe_b_id: string
          id: string
          joueurs_a: string[]
          prevu_le: string
          propose_par: string | null
          region: string
          repondu_le: string | null
          statut: string
          tournament_id: string | null
        }
        Insert: {
          best_of?: number
          cree_le?: string
          equipe_a_id: string
          equipe_b_id: string
          id?: string
          joueurs_a: string[]
          prevu_le: string
          propose_par?: string | null
          region: string
          repondu_le?: string | null
          statut?: string
          tournament_id?: string | null
        }
        Update: {
          best_of?: number
          cree_le?: string
          equipe_a_id?: string
          equipe_b_id?: string
          id?: string
          joueurs_a?: string[]
          prevu_le?: string
          propose_par?: string | null
          region?: string
          repondu_le?: string | null
          statut?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scrims_equipe_a_id_fkey"
            columns: ["equipe_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrims_equipe_b_id_fkey"
            columns: ["equipe_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrims_propose_par_fkey"
            columns: ["propose_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrims_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          debut_le: string
          est_courante: boolean
          fin_le: string
          game_id: number
          id: string
          nom: string | null
          numero: number
        }
        Insert: {
          debut_le: string
          est_courante?: boolean
          fin_le: string
          game_id: number
          id?: string
          nom?: string | null
          numero: number
        }
        Update: {
          debut_le?: string
          est_courante?: boolean
          fin_le?: string
          game_id?: number
          id?: string
          nom?: string | null
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      stats_match_joueur: {
        Row: {
          assists: number
          champion: string
          cree_le: string
          cs: number
          deaths: number
          duree_secondes: number
          gagne: boolean
          kills: number
          match_id: string
          or_gagne: number
          profile_id: string
          puuid: string | null
        }
        Insert: {
          assists: number
          champion: string
          cree_le?: string
          cs: number
          deaths: number
          duree_secondes: number
          gagne: boolean
          kills: number
          match_id: string
          or_gagne: number
          profile_id: string
          puuid?: string | null
        }
        Update: {
          assists?: number
          champion?: string
          cree_le?: string
          cs?: number
          deaths?: number
          duree_secondes?: number
          gagne?: boolean
          kills?: number
          match_id?: string
          or_gagne?: number
          profile_id?: string
          puuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stats_match_joueur_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stats_match_joueur_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          accepte_le: string | null
          profile_id: string
          role: string | null
          team_id: string
        }
        Insert: {
          accepte_le?: string | null
          profile_id: string
          role?: string | null
          team_id: string
        }
        Update: {
          accepte_le?: string | null
          profile_id?: string
          role?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          capitaine_id: string
          contact_recrutement: string | null
          couleur_accent: string | null
          cree_le: string
          description: string | null
          game_id: number
          id: string
          logo_url: string | null
          nom: string
          slug: string
          tag: string
        }
        Insert: {
          capitaine_id: string
          contact_recrutement?: string | null
          couleur_accent?: string | null
          cree_le?: string
          description?: string | null
          game_id: number
          id?: string
          logo_url?: string | null
          nom: string
          slug: string
          tag: string
        }
        Update: {
          capitaine_id?: string
          contact_recrutement?: string | null
          couleur_accent?: string | null
          cree_le?: string
          description?: string | null
          game_id?: number
          id?: string
          logo_url?: string | null
          nom?: string
          slug?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_capitaine_id_fkey"
            columns: ["capitaine_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      tiers: {
        Row: {
          game_id: number
          id: number
          nom: string
          ordre: number
          rating_min: number
        }
        Insert: {
          game_id: number
          id: number
          nom: string
          ordre: number
          rating_min: number
        }
        Update: {
          game_id?: number
          id?: number
          nom?: string
          ordre?: number
          rating_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "tiers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          best_of: number
          capacite: number
          checkin_ouvre_le: string
          classe: boolean | null
          compte_pour_classement: boolean
          communaute_id: string | null
          condition_victoire: string
          couleur_accent: string | null
          cree_le: string
          creneau_auto: string | null
          debute_le: string
          format: string
          game_id: number
          id: string
          logo_url: string | null
          nature: string
          nom: string
          organisateur_id: string
          publie_le: string | null
          rating_max: number | null
          rating_min: number | null
          region: string
          reserve_membres: boolean
          season_id: string | null
          slug: string
          statut: Database["public"]["Enums"]["tournament_status"]
          type_bracket: string
          verrouille_le: string | null
        }
        Insert: {
          best_of?: number
          capacite: number
          checkin_ouvre_le: string
          classe?: boolean | null
          compte_pour_classement?: boolean
          communaute_id?: string | null
          condition_victoire?: string
          couleur_accent?: string | null
          cree_le?: string
          creneau_auto?: string | null
          debute_le: string
          format: string
          game_id: number
          id?: string
          logo_url?: string | null
          nature?: string
          nom: string
          organisateur_id: string
          publie_le?: string | null
          rating_max?: number | null
          rating_min?: number | null
          region: string
          reserve_membres?: boolean
          season_id?: string | null
          slug: string
          statut?: Database["public"]["Enums"]["tournament_status"]
          type_bracket?: string
          verrouille_le?: string | null
        }
        Update: {
          best_of?: number
          capacite?: number
          checkin_ouvre_le?: string
          classe?: boolean | null
          compte_pour_classement?: boolean
          communaute_id?: string | null
          condition_victoire?: string
          couleur_accent?: string | null
          cree_le?: string
          creneau_auto?: string | null
          debute_le?: string
          format?: string
          game_id?: number
          id?: string
          logo_url?: string | null
          nature?: string
          nom?: string
          organisateur_id?: string
          publie_le?: string | null
          rating_max?: number | null
          rating_min?: number | null
          region?: string
          reserve_membres?: boolean
          season_id?: string | null
          slug?: string
          statut?: Database["public"]["Enums"]["tournament_status"]
          type_bracket?: string
          verrouille_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_communaute_id_fkey"
            columns: ["communaute_id"]
            isOneToOne: false
            referencedRelation: "communautes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_organisateur_id_fkey"
            columns: ["organisateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      vues_profil: {
        Row: {
          derniere_vue_le: string
          profile_id: string
          vu_par: string
        }
        Insert: {
          derniere_vue_le?: string
          profile_id: string
          vu_par: string
        }
        Update: {
          derniere_vue_le?: string
          profile_id?: string
          vu_par?: string
        }
        Relationships: [
          {
            foreignKeyName: "vues_profil_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vues_profil_vu_par_fkey"
            columns: ["vu_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          cree_le: string
          joueur_suivi_id: string
          recruteur_id: string
        }
        Insert: {
          cree_le?: string
          joueur_suivi_id: string
          recruteur_id: string
        }
        Update: {
          cree_le?: string
          joueur_suivi_id?: string
          recruteur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_joueur_suivi_id_fkey"
            columns: ["joueur_suivi_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_recruteur_id_fkey"
            columns: ["recruteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      registre_public: {
        Row: {
          adversaire_id: string | null
          cree_le: string
          cree_le_us: string
          empreinte: string
          empreinte_precedente: string
          game_id: number
          match_id: string | null
          motif: string
          numero: number
          profile_id: string
          rating_apres: string
          rating_avant: string
          rd_apres: string
          rd_avant: string
          season_id: string
          tournament_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activer_saison: {
        Args: { p_game_id: number; p_nouvelle_saison_id: string }
        Returns: undefined
      }
      appliquer_forfait_absence: { Args: { p_match_id: string }; Returns: string | null }
      appliquer_decroissance_rd: {
        Args: {
          p_game_id: number
          p_profile_id: string
          p_rating: number
          p_rd_apres: number
          p_rd_avant: number
          p_season_id: string
          p_volatilite: number
        }
        Returns: boolean
      }
      appliquer_soft_reset_saison: {
        Args: {
          p_game_id: number
          p_profile_id: string
          p_rating_apres: number
          p_rating_avant: number
          p_rd_apres: number
          p_rd_avant: number
          p_season_id: string
          p_volatilite: number
        }
        Returns: boolean
      }
      avancer_vainqueur: {
        Args: { p_gagnant_id: string; p_match_id: string }
        Returns: undefined
      }
      cloturer_rating_joueur: {
        Args: {
          p_game_id: number
          p_matchs_comptes: number
          p_motif: string
          p_profile_id: string
          p_rating_apres: number
          p_rating_avant: number
          p_rd_apres: number
          p_rd_avant: number
          p_season_id: string
          p_tournament_id: string
          p_volatilite_apres: number
          p_volatilite_avant: number
        }
        Returns: boolean
      }
      confirmer_presence: { Args: { p_tournament_id: string }; Returns: boolean }
      criteres_tournoi_classe: {
        Args: { p_tournament_id: string }
        Returns: {
          amical: boolean
          classe: boolean
          defi: boolean
          joueurs_au_depart: number
          officiel: boolean
          organisateur_joue: boolean
          publie_a_temps: boolean
        }[]
      }
      figer_classement_tournoi: { Args: { p_tournament_id: string }; Returns: boolean }
      declarer_pret: { Args: { p_match_id: string }; Returns: boolean }
      lancer_defi: { Args: { p_adversaire_id: string; p_condition?: string }; Returns: string }
      creer_invitation_defi: { Args: { p_condition?: string }; Returns: string }
      lire_invitation_defi: {
        Args: { p_code: string }
        Returns: {
          condition_victoire: string
          expire_le: string
          lanceur_pseudo: string
          lanceur_slug: string
          region: string | null
          statut: string
          tournoi_slug: string | null
        }[]
      }
      repondre_defi: { Args: { p_accepte: boolean; p_defi_id: string }; Returns: string | null }
      accepter_invitation_defi: { Args: { p_code: string }; Returns: string }
      confirmer_agent_libre: { Args: { p_tournament_id: string }; Returns: boolean }
      quitter_agents_libres: { Args: { p_tournament_id: string }; Returns: boolean }
      annuler_scrim: { Args: { p_scrim_id: string }; Returns: boolean }
      annuler_defi: { Args: { p_defi_id: string }; Returns: boolean }
      texte_acceptable: { Args: { p_contexte?: string; p_texte: string }; Returns: boolean }
      traiter_signalement: { Args: { p_signalement_id: string; p_valide: boolean }; Returns: string }
      enregistrer_bye_automatique: {
        Args: { p_gagnant_id: string; p_match_id: string }
        Returns: undefined
      }
      definir_compte_principal: { Args: { p_game_id: number; p_puuid: string }; Returns: boolean }
      delier_compte_secondaire: { Args: { p_game_id: number; p_puuid: string }; Returns: boolean }
      rejoindre_arene: { Args: { p_condition?: string }; Returns: string | null }
      quitter_arene: { Args: never; Returns: boolean }
      etat_arene: {
        Args: never
        Returns: { en_attente_region: number; en_file: boolean; entree_le: string | null }[]
      }
      apparier_arene: { Args: never; Returns: { slug: string }[] }
      pronostiquer: { Args: { p_gagnant: string; p_match_id: string }; Returns: boolean }
      creer_communaute: {
        Args: { p_couleur?: string; p_description?: string; p_lien_discord?: string; p_nom: string; p_slug: string }
        Returns: string
      }
      modifier_communaute: {
        Args: { p_communaute_id: string; p_couleur: string; p_description: string; p_lien_discord: string }
        Returns: boolean
      }
      rejoindre_communaute: { Args: { p_communaute_id: string }; Returns: boolean }
      quitter_communaute: { Args: { p_communaute_id: string }; Returns: boolean }
      retirer_membre_communaute: { Args: { p_communaute_id: string; p_profile_id: string }; Returns: boolean }
      nommer_admin_communaute: {
        Args: { p_admin: boolean; p_communaute_id: string; p_profile_id: string }
        Returns: boolean
      }
      code_liaison_discord: { Args: { p_communaute_id: string }; Returns: string }
      lier_serveur_discord: { Args: { p_code: string; p_guild_id: string }; Returns: string }
      delier_serveur_discord: { Args: { p_communaute_id: string }; Returns: boolean }
      definir_ecole: { Args: { p_communaute_id: string; p_domaines: string[] }; Returns: boolean }
      revues_a_rediger: { Args: { p_limite: number }; Returns: { match_id: string; profile_id: string }[] }
      noter_echec_revue: { Args: { p_match_id: string; p_profile_id: string }; Returns: undefined }
      preparer_verification_ecole: {
        Args: { p_code: string; p_communaute_id: string; p_email: string; p_profile_id: string }
        Returns: string
      }
      confirmer_verification_ecole: { Args: { p_code: string; p_communaute_id: string }; Returns: boolean }
      classement_ecoles: {
        Args: never
        Returns: {
          classes: number
          communaute_id: string
          couleur: string
          moyenne_top5: number | null
          nom: string
          slug: string
          verifies: number
        }[]
      }
      enregistrer_dotation: {
        Args: { p_repartition: number[]; p_sponsor_lien: string; p_sponsor_nom: string; p_tournament_id: string }
        Returns: boolean
      }
      annuler_dotation: { Args: { p_tournament_id: string }; Returns: boolean }
      preparer_versements: { Args: { p_tournament_id: string }; Returns: number }
      noter_versement: {
        Args: { p_profile_id: string; p_reference: string; p_statut: string; p_tournament_id: string }
        Returns: boolean
      }
      repartition_pronostics: {
        Args: { p_tournament_id: string }
        Returns: { gagnant_prevu: string; match_id: string; nombre: number }[]
      }
      classement_pronostics: {
        Args: { p_limite?: number }
        Returns: { comptes: number; justes: number; points: number; profile_id: string; pseudo: string; slug: string }[]
      }
      delier_compte_riot: { Args: { p_game_id: number }; Returns: boolean }
      emettre_certificat: { Args: { p_game_id?: number }; Returns: string }
      enregistrer_consentement: { Args: { p_version: string }; Returns: boolean }
      enregistrer_defaite_reconnue: { Args: { p_match_id: string }; Returns: boolean }
      enregistrer_verdict_historique: {
        Args: {
          p_gagnant_id: string
          p_match_id: string
          p_riot_match_id: string
        }
        Returns: boolean
      }
      enregistrer_verdict_manuel: {
        Args: { p_gagnant_id: string; p_match_id: string; p_motif: string }
        Returns: undefined
      }
      lier_compte_riot: {
        Args: {
          p_defi_icone_id: number
          p_game_id: number
          p_principal?: boolean
          p_profile_id: string
          p_puuid: string
          p_region: string
          p_riot_game_name: string
          p_riot_tag_line: string
        }
        Returns: undefined
      }
      lire_certificat: {
        Args: { p_code: string }
        Returns: {
          code: string
          compte_supprime: boolean
          cree_le: string
          est_classe: boolean
          matchs_verifies: number
          palier: string | null
          profile_id: string
          pseudo: string
          rating: number
          rd: number
          registre_empreinte: string | null
          registre_numero: number | null
          saison: string | null
          slug: string
          victoires: number
        }[]
      }
      mes_reglages_profil: {
        Args: never
        Returns: { pseudo_modifie_le: string | null; visites_anonymes: boolean }[]
      }
      mon_abonnement_stripe: { Args: never; Returns: { statut: string | null }[] }
      proposer_scrim: {
        Args: {
          p_adversaire_id: string
          p_best_of: number
          p_equipe_id: string
          p_joueurs: string[]
          p_prevu_le: string
        }
        Returns: string
      }
      fiche_organisateur: {
        Args: { p_profile_id: string }
        Returns: {
          litiges: number
          litiges_resolus: number
          matchs_decides: number
          matchs_verifies: number
          resolution_mediane_heures: number | null
          tournois_annules: number
          tournois_publies: number
          tournois_termines: number
        }[]
      }
      former_equipes_agents_libres: { Args: { p_equipes: Json; p_tournament_id: string }; Returns: number }
      modifier_alignement: { Args: { p_joueurs: string[]; p_tournament_id: string }; Returns: boolean }
      modifier_mon_profil: {
        Args: { p_pays: string | null; p_pseudo: string; p_visites_anonymes: boolean }
        Returns: string
      }
      reconnaitre_defaite: { Args: { p_match_id: string }; Returns: string }
      reserver_appel_assistant_ia: { Args: never; Returns: boolean }
      repondre_scrim: {
        Args: { p_accepte: boolean; p_joueurs?: string[]; p_scrim_id: string }
        Returns: string | null
      }
      s_inscrire_agent_libre: { Args: { p_role?: string; p_tournament_id: string }; Returns: boolean }
      s_inscrire_equipe: {
        Args: { p_joueurs: string[]; p_team_id: string; p_tournament_id: string }
        Returns: string
      }
      s_inscrire_tournoi: { Args: { p_tournament_id: string }; Returns: string }
      se_desinscrire: { Args: { p_tournament_id: string }; Returns: boolean }
      supprimer_mon_compte: { Args: never; Returns: string }
      verifier_registre: {
        Args: never
        Returns: { derniere_empreinte: string | null; lignes: number; premiere_rupture: number | null }[]
      }
      visites_anonymes_actives: { Args: never; Returns: boolean }
    }
    Enums: {
      match_status: "en_attente" | "en_cours" | "termine" | "litige" | "forfait"
      registration_status: "inscrit" | "confirme" | "absent" | "retire"
      tournament_status:
        | "brouillon"
        | "ouvert"
        | "checkin"
        | "en_cours"
        | "termine"
        | "annule"
      verdict_level: "manuel" | "historique" | "code_tournoi"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      match_status: ["en_attente", "en_cours", "termine", "litige", "forfait"],
      registration_status: ["inscrit", "confirme", "absent", "retire"],
      tournament_status: [
        "brouillon",
        "ouvert",
        "checkin",
        "en_cours",
        "termine",
        "annule",
      ],
      verdict_level: ["manuel", "historique", "code_tournoi"],
    },
  },
} as const
