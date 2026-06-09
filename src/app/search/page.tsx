"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card, Button } from "@/components/ui";
import { Loader2 } from "lucide-react";

export default function SearchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    sector: "",
    city: "",
    maxPages: 3,
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");

      router.push(`/prospects?campaign=${data.campaign.id}`);
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
                Pages à importer (20 résultats/page)
              </label>
              <select
                value={form.maxPages}
                onChange={(e) =>
                  setForm({ ...form, maxPages: Number(e.target.value) })
                }
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              >
                {[1, 2, 3, 5, 10].map((n) => (
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
                  Import en cours…
                </>
              ) : (
                "Lancer la recherche"
              )}
            </Button>
          </form>

          <p className="mt-4 text-xs text-stone-400">
            Recherche via Google Places API, enrichissement automatique SIRENE
            (gratuit) et Pappers si clé configurée.
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
