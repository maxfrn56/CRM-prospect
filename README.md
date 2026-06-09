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
2. Ajouter un service **PostgreSQL** dans le projet
3. Lier la variable `DATABASE_URL` du service Postgres à l'app Next.js
4. Ajouter les autres variables d'environnement (voir `.env.example`)
5. Définir `NEXT_PUBLIC_APP_URL` avec l'URL Railway générée

Le build exécute `next build`. Le schéma Prisma est appliqué au **démarrage** (`prisma db push`).

### Variables obligatoires avant le déploiement

1. Ajouter PostgreSQL dans le projet Railway
2. **Lier `DATABASE_URL`** du service Postgres vers l'app Next.js (Variables → Add Reference)
3. Redéployer — sans `DATABASE_URL`, le build passera mais le **start** échouera

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
