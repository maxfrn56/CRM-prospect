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

## Installation

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

## Variables d'environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `GOOGLE_PLACES_API_KEY` | Oui | Recherche entreprises |
| `GEMINI_API_KEY` | Oui | Emails + classification |
| `GEMINI_MODEL` | Non | Défaut: `gemini-2.5-flash` |
| `RESEND_API_KEY` | Oui | Envoi emails |
| `RESEND_FROM_EMAIL` | Oui | Adresse vérifiée |
| `PAPPERS_API_KEY` | Non | Emails/tél supplémentaires |
| `CRON_SECRET` | Prod | Relances automatiques |

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

## Note sur les emails prospects

Google Places ne fournit pas d'email. SIRENE non plus. Pour obtenir des emails :
- Configurez `PAPPERS_API_KEY` (plan payant)
- Ou saisissez-les manuellement dans la fiche prospect
