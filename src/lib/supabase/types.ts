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
        }
        Insert: {
          cree_le?: string
          email: string
          id?: never
        }
        Update: {
          cree_le?: string
          email?: string
          id?: never
        }
        Relationships: []
      }
      match_participants: {
        Row: {
          est_gagnant: boolean | null
          match_id: string
          profile_id: string
          score: number
          slot: number
        }
        Insert: {
          est_gagnant?: boolean | null
          match_id: string
          profile_id: string
          score?: number
          slot: number
        }
        Update: {
          est_gagnant?: boolean | null
          match_id?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_id: string | null
          id: string
          pays: string | null
          pseudo: string
          slug: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          id: string
          pays?: string | null
          pseudo: string
          slug: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          id?: string
          pays?: string | null
          pseudo?: string
          slug?: string
        }
        Relationships: []
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
      rating_events: {
        Row: {
          adversaire_id: string | null
          cree_le: string
          game_id: number
          id: number
          match_id: string | null
          motif: string
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
          game_id: number
          id?: number
          match_id?: string | null
          motif: string
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
          game_id?: number
          id?: number
          match_id?: string | null
          motif?: string
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
          profile_id: string
        }
        Insert: {
          cree_le?: string
          message?: string | null
          profile_id: string
        }
        Update: {
          cree_le?: string
          message?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recherches_coequipiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          confirme_le: string | null
          id: string
          inscrit_le: string
          profile_id: string
          rating_a_inscription: number | null
          seed: number | null
          statut: Database["public"]["Enums"]["registration_status"]
          tournament_id: string
        }
        Insert: {
          confirme_le?: string | null
          id?: string
          inscrit_le?: string
          profile_id: string
          rating_a_inscription?: number | null
          seed?: number | null
          statut?: Database["public"]["Enums"]["registration_status"]
          tournament_id: string
        }
        Update: {
          confirme_le?: string | null
          id?: string
          inscrit_le?: string
          profile_id?: string
          rating_a_inscription?: number | null
          seed?: number | null
          statut?: Database["public"]["Enums"]["registration_status"]
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
            foreignKeyName: "registrations_tournament_id_fkey"
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
          cree_le: string
          game_id: number
          id: string
          nom: string
          slug: string
          tag: string
        }
        Insert: {
          capitaine_id: string
          cree_le?: string
          game_id: number
          id?: string
          nom: string
          slug: string
          tag: string
        }
        Update: {
          capitaine_id?: string
          cree_le?: string
          game_id?: number
          id?: string
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
          compte_pour_classement: boolean
          cree_le: string
          debute_le: string
          format: string
          game_id: number
          id: string
          nom: string
          organisateur_id: string
          rating_max: number | null
          rating_min: number | null
          region: string
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
          compte_pour_classement?: boolean
          cree_le?: string
          debute_le: string
          format: string
          game_id: number
          id?: string
          nom: string
          organisateur_id: string
          rating_max?: number | null
          rating_min?: number | null
          region: string
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
          compte_pour_classement?: boolean
          cree_le?: string
          debute_le?: string
          format?: string
          game_id?: number
          id?: string
          nom?: string
          organisateur_id?: string
          rating_max?: number | null
          rating_min?: number | null
          region?: string
          season_id?: string | null
          slug?: string
          statut?: Database["public"]["Enums"]["tournament_status"]
          type_bracket?: string
          verrouille_le?: string | null
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activer_saison: {
        Args: { p_game_id: number; p_nouvelle_saison_id: string }
        Returns: undefined
      }
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
          p_puuid: string
          p_region: string
          p_riot_game_name: string
          p_riot_tag_line: string
        }
        Returns: undefined
      }
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
