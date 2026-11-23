// Fausse base en mémoire pour les tests des abonnements Stripe (webhook et
// vérification quotidienne) : imite les seuls appels Supabase qu'ils font
// (select / upsert / update / delete avec eq, is, in, not, order, limit,
// range, maybeSingle, rpc). Une table peut être mise en échec pour simuler une panne d'écriture.

type Ligne = Record<string, unknown>;
type Filtre = (ligne: Ligne) => boolean;

export type FausseBase = {
  tables: Record<string, Ligne[]>;
  enEchec: Set<string>;
  appelsRpc: { nom: string; args: unknown }[];
  from: (table: string) => Requete;
  rpc: (nom: string, args: unknown) => Promise<{ error: { message: string } | null }>;
};

type Resultat = { data: Ligne[] | Ligne | null; error: { message: string } | null };

class Requete implements PromiseLike<Resultat> {
  private filtres: Filtre[] = [];
  private tri: { colonne: string; croissant: boolean } | null = null;
  private limite: number | null = null;
  private debutPage = 0;
  private mode: "select" | "delete" | "update" = "select";
  private valeurs: Ligne = {};
  private unique = false;

  constructor(
    private base: FausseBase,
    private table: string,
  ) {}

  select(): this {
    this.mode = "select";
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }
  update(valeurs: Ligne): this {
    this.mode = "update";
    this.valeurs = valeurs;
    return this;
  }
  eq(colonne: string, valeur: unknown): this {
    this.filtres.push((l) => l[colonne] === valeur);
    return this;
  }
  is(colonne: string, valeur: null): this {
    this.filtres.push((l) => (l[colonne] ?? null) === valeur);
    return this;
  }
  in(colonne: string, valeurs: unknown[]): this {
    this.filtres.push((l) => valeurs.includes(l[colonne]));
    return this;
  }
  not(colonne: string, operateur: "is", valeur: null): this {
    this.filtres.push((l) => (l[colonne] ?? null) !== valeur);
    return this;
  }
  order(colonne: string, options: { ascending: boolean }): this {
    this.tri = { colonne, croissant: options.ascending };
    return this;
  }
  limit(n: number): this {
    this.limite = n;
    return this;
  }
  range(debut: number, fin: number): this {
    this.debutPage = debut;
    this.limite = fin - debut + 1;
    return this;
  }
  maybeSingle(): this {
    this.unique = true;
    return this;
  }

  upsert(ligne: Ligne): Promise<{ error: { message: string } | null }> {
    if (this.base.enEchec.has(this.table)) return Promise.resolve({ error: { message: "panne" } });
    const lignes = (this.base.tables[this.table] ??= []);
    const existante = lignes.find((l) => l.profile_id === ligne.profile_id);
    if (existante) Object.assign(existante, ligne);
    else lignes.push({ ...ligne });
    return Promise.resolve({ error: null });
  }

  private executer(): Resultat {
    const lignes = (this.base.tables[this.table] ??= []);
    if (this.mode === "update") {
      if (this.base.enEchec.has(this.table)) return { data: null, error: { message: "panne" } };
      for (const l of lignes) if (this.filtres.every((f) => f(l))) Object.assign(l, this.valeurs);
      return { data: null, error: null };
    }
    if (this.mode === "delete") {
      if (this.base.enEchec.has(this.table)) return { data: null, error: { message: "panne" } };
      this.base.tables[this.table] = lignes.filter((l) => !this.filtres.every((f) => f(l)));
      return { data: null, error: null };
    }
    let trouvees = lignes.filter((l) => this.filtres.every((f) => f(l))).map((l) => ({ ...l }));
    if (this.tri) {
      const { colonne, croissant } = this.tri;
      trouvees.sort((a, b) => String(a[colonne]).localeCompare(String(b[colonne])) * (croissant ? 1 : -1));
    }
    if (this.limite !== null) trouvees = trouvees.slice(this.debutPage, this.debutPage + this.limite);
    if (this.unique) return { data: trouvees[0] ?? null, error: null };
    return { data: trouvees, error: null };
  }

  then<A = Resultat, B = never>(
    succes?: ((valeur: Resultat) => A | PromiseLike<A>) | null,
    echec?: ((raison: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.executer()).then(succes, echec);
  }
}

export function fausseBase(): FausseBase {
  const base: FausseBase = {
    tables: { comptes_offres: [], abonnements_stripe: [] },
    enEchec: new Set(),
    appelsRpc: [],
    from: (table) => new Requete(base, table),
    rpc: async (nom, args) => {
      base.appelsRpc.push({ nom, args });
      return { error: base.enEchec.has(`rpc:${nom}`) ? { message: "panne" } : null };
    },
  };
  return base;
}

/** Faux abonnement Stripe, réduit aux champs lus par le code. */
export function abonnementStripe(options: {
  id: string;
  statut: string;
  prix?: string;
  profileId?: string;
  client?: string;
  /** Date de création (secondes) : la plus récente passe d'abord. */
  cree?: number;
  /** Paiements mis en pause chez Stripe (le statut reste « active »). */
  enPause?: boolean;
}) {
  return {
    id: options.id,
    object: "subscription",
    status: options.statut,
    created: options.cree ?? 1_700_000_000,
    pause_collection: options.enPause ? { behavior: "void" } : null,
    customer: options.client ?? "cus_1",
    metadata: options.profileId ? { profile_id: options.profileId } : {},
    items: { data: options.prix ? [{ price: { id: options.prix } }] : [] },
  };
}
