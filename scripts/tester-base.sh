#!/usr/bin/env bash
# Rejoue docs/schema.sql sur une base PostgreSQL vierge, puis les scénarios
# de tests/sql/ : chaque règle d'accès et chaque fonction de la base y est
# essayée comme le ferait un visiteur, un organisateur ou le serveur.
#
# Nécessite un serveur PostgreSQL 15+ et psql. Paramètres de connexion par
# les variables habituelles (PGHOST, PGPORT, PGUSER, PGPASSWORD) ; le compte
# doit pouvoir créer une base et des rôles. La base « najarena_test » (ou
# $BASE_TEST) est effacée et recréée à chaque lancement.
#
# Sortie : une ligne OK / ÉCHEC par vérification ; code de retour 1 au
# moindre échec.
set -euo pipefail

BASE="${BASE_TEST:-najarena_test}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "drop database if exists $BASE" -c "create database $BASE" >/dev/null
"${PSQL[@]}" -d "$BASE" -f "$RACINE/tests/sql/00-environnement-supabase.sql" 2>&1 | grep -v "wal_level\|HINT:" || true
# Le bloc pg_cron / pg_net / Vault n'existe que sur Supabase.
sed '/\[supabase-uniquement:debut\]/,/\[supabase-uniquement:fin\]/d' "$RACINE/docs/schema.sql" \
  | "${PSQL[@]}" -d "$BASE" >/dev/null
"${PSQL[@]}" -d "$BASE" -f "$RACINE/tests/sql/10-donnees.sql" >/dev/null

sortie=""
for fichier in "$RACINE"/tests/sql/[2-9]*.sql; do
  echo "== $(basename "$fichier")"
  resultat="$(psql -X -q -d "$BASE" -f "$fichier" 2>&1 | grep -E "NOTICE:  (OK|ÉCHEC)" | sed 's/^.*NOTICE:  //')"
  echo "$resultat"
  sortie+="$resultat"$'\n'
done

nb_ok=$(grep -c "^OK" <<<"$sortie" || true)
nb_echecs=$(grep -c "^ÉCHEC" <<<"$sortie" || true)
echo
echo "Vérifications réussies : $nb_ok · échecs : $nb_echecs"
if [ "$nb_echecs" -gt 0 ] || [ "$nb_ok" -eq 0 ]; then
  exit 1
fi
