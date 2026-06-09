"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card, Button } from "@/components/ui";
import { Loader2 } from "lucide-react";

async function parseApiResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (text.toLowerCase().includes("upstream")) {
      throw new Error(
        "Le serveur a expiré (timeout). Réessayez avec 1 page, ou attendez le redéploiement."
      );
    }
    throw new Error(text.slice(0, 200) || "Réponse serveur invalide");
  }
}

export default function SearchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    sector: "",
    city: "",
    maxPages: 2,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(String(data.error ?? "Erreur"));

      const campaign = data.campaign as { id: string };
      router.push(
        `/prospects?campaign=${campaign.id}&importing=1`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Nouvelle recherche"
        description="Importez des entreprises via Google Places, enrichies avec SIRENE"
      />

      <div className="mx-auto max-w-xl p-8">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              label="Nom de la campagne"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Ex: Plombiers Paris — Juin 2026"
              required
            />
            <Field
              label="Secteur d'activité"
              value={form.sector}
              onChange={(v) => setForm({ ...form, sector: v })}
              placeholder="Ex: plombier, restaurant, avocat"
              required
            />
            <Field
              label="Ville"
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
              placeholder="Ex: Paris, Lyon, Bordeaux"
              required
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Pages à importer (~20 résultats/page)
              </label>
              <select
                value={form.maxPages}
                onChange={(e) =>
                  setForm({ ...form, maxPages: Number(e.target.value) })
                }
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              >
                {[1, 2, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} page{n > 1 ? "s" : ""} (~{n * 20} entreprises)
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lancement…
                </>
              ) : (
                "Lancer la recherche"
              )}
            </Button>
          </form>

          <p className="mt-4 text-xs text-stone-400">
            L&apos;import se fait en arrière-plan. Les emails sont recherchés
            lors de l&apos;audit (bouton « Auditer tous »).
          </p>
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
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
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
        required={required}
        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
      />
    </div>
  );
}
