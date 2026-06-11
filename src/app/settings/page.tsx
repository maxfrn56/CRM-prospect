"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, Button } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";

const DEFAULT_PITCH_EXAMPLE = `Bonjour,

Je suis développeur web full stack et j'accompagne des entreprises locales pour moderniser leur présence en ligne.

En regardant votre activité, j'ai remarqué que votre site pourrait gagner en clarté et en performance sur mobile — deux points qui font souvent la différence pour convertir de nouveaux clients.

Je serais ravi d'échanger 15 minutes avec vous pour voir si je peux vous aider, sans engagement de votre part.`;

interface Settings {
  senderName: string;
  senderEmail: string;
  companyName: string;
  pitchContext: string;
  pitchExample: string;
  website: string;
  phone: string;
  followupEnabled: boolean;
  mockupAutoEnabled: boolean;
  mockupRepoUrl: string;
  mockupRepoRef: string;
  mockupAutoCreatePR: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    senderName: "",
    senderEmail: "",
    companyName: "",
    pitchContext: "",
    pitchExample: "",
    website: "",
    phone: "",
    followupEnabled: true,
    mockupAutoEnabled: false,
    mockupRepoUrl: "",
    mockupRepoRef: "main",
    mockupAutoCreatePR: true,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resendHealth, setResendHealth] = useState<{
    from: string;
    replyTo: string;
    webhookConfigured: boolean;
    webhookUrl: string | null;
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings((prev) => ({ ...prev, ...data })))
      .finally(() => setLoading(false));

    fetch("/api/settings/resend-health")
      .then((r) => r.json())
      .then(setResendHealth)
      .catch(() => null);
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
            Identité & signature
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Ces informations apparaissent en signature dans chaque email envoyé.
          </p>
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <Field
              label="Votre nom"
              value={settings.senderName}
              onChange={(v) => setSettings({ ...settings, senderName: v })}
              placeholder="Maxime Farineau"
            />
            <Field
              label="Email de réponse (affichage — vos réponses arrivent via Resend)"
              value={settings.senderEmail}
              onChange={(v) => setSettings({ ...settings, senderEmail: v })}
              placeholder="contact@votredomaine.fr"
            />
            <Field
              label="Nom de l'activité"
              value={settings.companyName}
              onChange={(v) => setSettings({ ...settings, companyName: v })}
              placeholder="Développeur Web Full Stack"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Site internet"
                value={settings.website}
                onChange={(v) => setSettings({ ...settings, website: v })}
                placeholder="https://monsite.fr"
              />
              <Field
                label="Téléphone"
                value={settings.phone}
                onChange={(v) => setSettings({ ...settings, phone: v })}
                placeholder="06 12 34 56 78"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Pitch / services (contexte pour Gemini)
              </label>
              <textarea
                value={settings.pitchContext}
                onChange={(e) =>
                  setSettings({ ...settings, pitchContext: e.target.value })
                }
                rows={3}
                placeholder="Je crée et refonds des sites web modernes, performants et responsives pour les TPE/PME..."
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-stone-700">
                  Exemple de pitch (modèle pour Gemini)
                </label>
                {!settings.pitchExample && (
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        pitchExample: DEFAULT_PITCH_EXAMPLE,
                      })
                    }
                    className="text-xs text-stone-500 underline hover:text-stone-800"
                  >
                    Utiliser l&apos;exemple par défaut
                  </button>
                )}
              </div>
              <textarea
                value={settings.pitchExample}
                onChange={(e) =>
                  setSettings({ ...settings, pitchExample: e.target.value })
                }
                rows={8}
                placeholder="Collez ici un email type que Gemini reproduira en ton et structure..."
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-stone-400">
                Gemini s&apos;inspire de ce modèle pour le ton et la structure,
                puis personnalise selon l&apos;audit de chaque prospect.
              </p>
            </div>

            {(settings.senderName || settings.website || settings.phone) && (
              <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-xs font-medium uppercase text-stone-500">
                  Aperçu signature
                </p>
                <div className="mt-2 text-sm text-stone-700">
                  <p>Cordialement,</p>
                  <p className="font-medium">{settings.senderName || "—"}</p>
                  <p>{settings.companyName || "—"}</p>
                  {settings.phone && <p>Tél. {settings.phone}</p>}
                  {settings.website && (
                    <p className="text-stone-600">{settings.website}</p>
                  )}
                  {(resendHealth?.replyTo || settings.senderEmail) && (
                    <p className="text-stone-600">
                      {resendHealth?.replyTo || settings.senderEmail}
                      {resendHealth?.replyTo && (
                        <span className="ml-1 text-[10px] text-stone-400">
                          (Reply-To Resend)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

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
            Réception des réponses email
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Les réponses prospects doivent transiter par Resend pour que le CRM
            les classifie automatiquement. Si elles arrivent directement dans
            Zimbra, Resend et le CRM ne les voient pas.
          </p>

          {resendHealth && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-xs">
                <p>
                  <span className="font-medium text-stone-700">Envoi (From) :</span>{" "}
                  {resendHealth.from || "—"}
                </p>
                <p className="mt-1">
                  <span className="font-medium text-stone-700">Réponses (Reply-To) :</span>{" "}
                  {resendHealth.replyTo || "—"}
                </p>
                <p className="mt-1">
                  <span className="font-medium text-stone-700">Webhook :</span>{" "}
                  {resendHealth.webhookConfigured ? "✓ secret configuré" : "✗ secret manquant"}
                </p>
                {resendHealth.webhookUrl && (
                  <p className="mt-2 break-all">
                    <span className="font-medium text-stone-700">
                      URL webhook Resend :
                    </span>
                    <br />
                    <code className="text-violet-800">{resendHealth.webhookUrl}</code>
                  </p>
                )}
              </div>

              {resendHealth.webhookUrl && (
                <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
                  Dans Resend → Webhooks, l&apos;URL doit être exactement celle
                  ci-dessus (avec{" "}
                  <code>/api/webhooks/resend</code>). Si vous mettez seulement
                  la racine du site (<code>/</code>), vous obtiendrez une erreur
                  405 Method Not Allowed.
                </p>
              )}

              {resendHealth.warnings.length > 0 && (
                <ul className="space-y-2">
                  {resendHealth.warnings.map((w) => (
                    <li
                      key={w}
                      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              )}

              <div className="text-xs text-stone-500">
                <p className="font-medium text-stone-700">Si vous utilisez Zimbra :</p>
                <ol className="mt-1 list-inside list-decimal space-y-1">
                  <li>
                    Resend → Receiving → récupérez une adresse{" "}
                    <code>@xxx.resend.app</code> ou créez un sous-domaine (ex.{" "}
                    <code>replies.votredomaine.fr</code>) avec l&apos;enregistrement MX Resend
                  </li>
                  <li>
                    Railway :{" "}
                    <code>RESEND_INBOUND_EMAIL=cette-adresse-resend</code>
                  </li>
                  <li>
                    Resend → Webhooks : événement{" "}
                    <code>email.received</code> →{" "}
                    <code>/api/webhooks/resend</code>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-stone-900">
            Maquettes Cursor (agent cloud)
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Dès qu&apos;un prospect répond avec un intérêt clair (statut HOT),
            un agent Cursor crée une page HTML dans votre repo GitHub — sans
            attendre qu&apos;il demande explicitement une maquette.
          </p>
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={settings.mockupAutoEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    mockupAutoEnabled: e.target.checked,
                  })
                }
                className="rounded border-stone-300"
              />
              Lancer automatiquement une maquette dès qu&apos;une réponse est
              classée chaude (HOT)
            </label>
            <Field
              label="Repo GitHub des maquettes"
              value={settings.mockupRepoUrl}
              onChange={(v) => setSettings({ ...settings, mockupRepoUrl: v })}
              placeholder="https://github.com/votre-org/maquettes-prospects"
            />
            <Field
              label="Branche de départ"
              value={settings.mockupRepoRef}
              onChange={(v) => setSettings({ ...settings, mockupRepoRef: v })}
              placeholder="main"
            />
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={settings.mockupAutoCreatePR}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    mockupAutoCreatePR: e.target.checked,
                  })
                }
                className="rounded border-stone-300"
              />
              Créer une Pull Request automatiquement
            </label>
            <p className="text-xs text-stone-400">
              Nécessite <code className="text-stone-600">CURSOR_API_KEY</code>{" "}
              dans Railway et l&apos;accès GitHub du compte Cursor au repo.
            </p>
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
              name="RESEND_FROM_EMAIL"
              desc="Adresse d'envoi vérifiée Resend"
            />
            <EnvItem
              name="CURSOR_API_KEY"
              desc="Clé API Cursor — agents cloud pour les maquettes (cursor.com/settings)"
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
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
