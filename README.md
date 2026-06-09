# Prospect CRM

Outil de prospection et d'automatisation pour développeur web full stack.

## Fonctionnalités

- **Import Google Places** — Recherche par secteur et ville
- **Enrichissement SIRENE** — SIREN, SIRET, NAF, dirigeant (API gouvernementale gratuite)
- **Enrichissement Pappers** — Email/téléphone supplémentaires (optionnel)
- **Audit automatique** — HTTPS, responsive, design daté, performance
- **Score de pertinence** — Classement des prospects par opportunité
- **Emails Gemini** — Génération personnalisée (modèle gratuit)
- **Envoi Resend** — Prospection + relances J4/J7/J12
- **Classification IA** — Analyse des réponses (chaud / froid)

## Prérequis

1. **Google Cloud** — Places API (New) activée
2. **Google AI Studio** — Clé Gemini
3. **Resend** — Domaine vérifié pour l'envoi
4. **PostgreSQL** — Base de données (Docker local ou Railway)

## Installation locale

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL local
npm install
npm run db:push
npm run dev
```

## Déploiement Railway

1. **New Project** → Deploy from GitHub → `maxfrn56/CRM-prospect`
2. **Ajouter PostgreSQL** : dans le projet → `+ New` → `Database` → `PostgreSQL`
3. **Lier la base à l'app** (étape critique) :
   - Ouvre le service **Next.js** (pas Postgres)
   - Onglet **Variables**
   - **Supprime** toute variable `DATABASE_URL` qui contient `localhost` (copiée depuis ton `.env` local)
   - Clique **New Variable** → **Add Reference**
   - Sélectionne le service **PostgreSQL** → variable **`DATABASE_URL`**
   - Sauvegarde
4. Ajoute les autres variables **manuellement** (API keys, etc.) — ne copie pas tout le `.env` tel quel
5. Définir `NEXT_PUBLIC_APP_URL` avec l'URL Railway générée (Settings → Networking → Generate Domain)

Le build exécute `next build`. Le schéma Prisma est appliqué au **démarrage** (`prisma db push`).

> **Important** : la `DATABASE_URL` Railway ressemble à  
> `postgresql://postgres:xxx@xxx.railway.app:5432/railway`  
> **Pas** `localhost:5432` — celle-ci est réservée au dev local avec Docker.

### Webhook Resend

Une fois déployé :
```
https://VOTRE-APP.railway.app/api/webhooks/resend
```
Événement : `email.received`

## Variables d'environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | Oui | PostgreSQL (Railway ou Docker) |
| `GOOGLE_PLACES_API_KEY` | Oui | Recherche entreprises |
| `GEMINI_API_KEY` | Oui | Emails + classification |
| `GEMINI_MODEL` | Non | Défaut: `gemini-2.5-flash` |
| `RESEND_API_KEY` | Oui | Envoi emails |
| `RESEND_FROM_EMAIL` | Oui | Adresse vérifiée |
| `PAPPERS_API_KEY` | Non | Emails/tél supplémentaires |
| `CRON_SECRET` | Prod | Relances automatiques |
| `NEXT_PUBLIC_APP_URL` | Prod | URL publique (webhooks) |

## Workflow

1. **Recherche** → Google Places + enrichissement SIRENE
2. **Audit** → Score de pertinence
3. **Email** → Gemini génère, Resend envoie
4. **Relances** → J+4, J+7, J+12
5. **Réponses** → Webhook Resend → Gemini classe

## Relances

```bash
npm run cron:followups
```

En production sur Railway, planifier un cron HTTP vers `/api/cron/followups`.

## Note sur les emails prospects

Google Places ne fournit pas d'email. SIRENE non plus. Pour obtenir des emails :
- Configurez `PAPPERS_API_KEY` (plan payant)
- Ou saisissez-les manuellement dans la fiche prospect
