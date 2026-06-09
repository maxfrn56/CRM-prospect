#!/bin/sh
set -e

# Railway : préférer l'URL interne du service Postgres (même projet)
if [ -n "$DATABASE_PRIVATE_URL" ]; then
  export DATABASE_URL="$DATABASE_PRIVATE_URL"
fi

if [ -z "$DATABASE_URL" ]; then
  echo ""
  echo "❌ DATABASE_URL manquante."
  echo ""
  echo "Sur Railway :"
  echo "  1. Ajoute un service PostgreSQL dans ton projet"
  echo "  2. Ouvre ton service Next.js → Variables"
  echo "  3. Supprime toute DATABASE_URL qui contient 'localhost'"
  echo "  4. Clique 'New Variable' → 'Add Reference' → Postgres → DATABASE_URL"
  echo "  5. Redéploie"
  echo ""
  exit 1
fi

case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*)
    echo ""
    echo "❌ DATABASE_URL pointe vers localhost — ça ne fonctionne pas sur Railway."
    echo ""
    echo "   Valeur actuelle : $DATABASE_URL"
    echo ""
    echo "Tu as probablement copié ton .env local. Sur Railway :"
    echo "  1. Supprime la variable DATABASE_URL manuelle"
    echo "  2. Ajoute une référence vers le service PostgreSQL Railway"
    echo "     (Variables → New Variable → Add Reference → DATABASE_URL)"
    echo "  3. Redéploie"
    echo ""
    exit 1
    ;;
esac

echo "Applying database schema..."
npx prisma db push --skip-generate

echo "Starting Next.js..."
exec npx next start
