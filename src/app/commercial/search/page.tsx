"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card, Button } from "@/components/ui";
import {
  COMMERCIAL_SEGMENTS,
  buildCommercialSearchQueries,
  type CommercialSegment,
} from "@/lib/commercial/segments";
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

const SEGMENTS = Object.values(COMMERCIAL_SEGMENTS);

export default function CommercialSearchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    segment: "B2B_BRAND" as CommercialSegment,
    niche: "",
    city: "",
    maxPages: 2,
  });

  const segmentConfig = COMMERCIAL_SEGMENTS[form.segment];
  const previewQueries =
    form.city.trim()
      ? buildCommercialSearchQueries(
          form.segment,
          form.niche.trim(),
          form.city
        )
      : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          sector: form.niche,
          city: form.city,
          maxPages: form.maxPages,
          campaignType: "SALES_TOOL",
          commercialSegment: form.segment,
          niche: form.niche,
        }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(String(data.error ?? "Erreur"));

      const campaign = data.campaign as { id: string };
      router.push(
        `/commercial/prospects?campaign=${campaign.id}&importing=1`
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
        title="Prospection B2B — vendeurs"
        description="Ciblez marques, grossistes et fabricants qui vendent à des magasins ou entreprises — pitch CRM de prospection sur mesure"
      />

      <div className="mx-auto max-w-2xl p-8">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Objectif : contacter des <strong>entreprises B2B</strong> (ex. une
              marque de surf qui vend à des shops), pas des magasins retail ni
              des commerciaux freelance. Vous leur proposez d&apos;installer
              votre outil de prospection automatique, personnalisé à leur secteur.
            </div>

            <Field
              label="Nom de la campagne"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Ex: Marques surf Sud-Ouest — Juillet 2026"
              required
            />

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-stone-700">
                Type d&apos;entreprise B2B
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {SEGMENTS.map((seg) => (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        segment: seg.id,
                        niche: form.niche || seg.defaultNiches[0] || "",
                      })
                    }
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                      form.segment === seg.id
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                    }`}
                  >
                    <p className="font-medium">{seg.shortLabel}</p>
                    <p
                      className={`mt-1 text-xs ${
                        form.segment === seg.id
                          ? "text-stone-300"
                          : "text-stone-500"
                      }`}
                    >
                      {seg.description}
                    </p>
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <Field
                label="Secteur / produit"
                value={form.niche}
                onChange={(v) => setForm({ ...form, niche: v })}
                placeholder={`Ex: ${segmentConfig.defaultNiches.slice(0, 3).join(", ")}`}
                required
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {segmentConfig.defaultNiches.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, niche: n })}
                    className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs text-stone-600 hover:bg-stone-50"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Ex. « surf » → marques/grossistes surf qui vendent aux magasins,
                pas les clubs ni les surf shops retail.
              </p>
            </div>

            <Field
              label="Ville ou zone"
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
              placeholder="Ex: Biarritz, Pays basque, Nouvelle-Aquitaine"
              required
            />

            {previewQueries.length > 0 && (
              <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">
                <p className="font-medium text-stone-700">
                  Requêtes Google Places ({previewQueries.length}) + filtre B2B
                </p>
                <ul className="mt-2 list-inside list-disc space-y-0.5">
                  {previewQueries.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <p className="mt-2 text-stone-500">
                  Exclus : magasins retail, boutiques, clubs, écoles, restos.
                </p>
              </div>
            )}

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
                    {n} page{n > 1 ? "s" : ""} (~{n * 20} résultats)
                  </option>
                ))}
              </select>
            </div>

            <details className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-stone-800">
                Aperçu du pitch ({segmentConfig.shortLabel})
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-stone-600">
                {segmentConfig.pitchContext}
              </p>
            </details>

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
                "Lancer la campagne B2B"
              )}
            </Button>
          </form>
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
