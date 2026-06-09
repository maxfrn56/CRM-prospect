"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, Button } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";

interface Settings {
  senderName: string;
  senderEmail: string;
  companyName: string;
  pitchContext: string;
  followupEnabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    senderName: "",
    senderEmail: "",
    companyName: "",
    pitchContext: "",
    followupEnabled: true,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings({ ...settings, ...data }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <div className="p-8 text-sm text-stone-500">Chargement…</div>;
  }

  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Configuration de la prospection et des intégrations"
      />

      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-stone-900">
            Identité expéditeur
          </h2>
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <Field
              label="Votre nom"
              value={settings.senderName}
              onChange={(v) => setSettings({ ...settings, senderName: v })}
            />
            <Field
              label="Email de réponse"
              value={settings.senderEmail}
              onChange={(v) => setSettings({ ...settings, senderEmail: v })}
            />
            <Field
              label="Nom de l'activité"
              value={settings.companyName}
              onChange={(v) => setSettings({ ...settings, companyName: v })}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Contexte / pitch
              </label>
              <textarea
                value={settings.pitchContext}
                onChange={(e) =>
                  setSettings({ ...settings, pitchContext: e.target.value })
                }
                rows={4}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={settings.followupEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    followupEnabled: e.target.checked,
                  })
                }
                className="rounded border-stone-300"
              />
              Activer les relances automatiques (J4, J7, J12)
            </label>
            <Button type="submit">
              {saved ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Enregistré
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-stone-900">
            Variables d&apos;environnement (.env)
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-stone-600">
            <EnvItem
              name="GOOGLE_PLACES_API_KEY"
              desc="Google Places API (New) — recherche entreprises"
            />
            <EnvItem
              name="GEMINI_API_KEY"
              desc="Google Gemini — génération emails et classification"
            />
            <EnvItem
              name="GEMINI_MODEL"
              desc="Modèle Gemini (défaut: gemini-2.5-flash)"
            />
            <EnvItem
              name="RESEND_API_KEY"
              desc="Envoi et réception d'emails"
            />
            <EnvItem
              name="RESEND_FROM_EMAIL"
              desc="Adresse d'envoi vérifiée (ex: prospection@votredomaine.com)"
            />
            <EnvItem
              name="PAPPERS_API_KEY"
              desc="Optionnel — enrichissement email/téléphone (api.pappers.fr)"
            />
            <EnvItem
              name="CRON_SECRET"
              desc="Protection de l'endpoint /api/cron/followups"
            />
          </ul>
        </Card>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
      />
    </div>
  );
}

function EnvItem({ name, desc }: { name: string; desc: string }) {
  return (
    <li className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
      <code className="text-xs font-mono text-stone-900">{name}</code>
      <p className="mt-1 text-xs text-stone-500">{desc}</p>
    </li>
  );
}
