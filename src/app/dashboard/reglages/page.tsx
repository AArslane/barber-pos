"use client";

import { useCallback, useEffect, useState } from "react";
import { hash } from "bcryptjs";
import { createClient } from "@/lib/supabase/client";
import type { Barber, BarberPrivate, Service } from "@/lib/types";

const inputCls =
  "rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-indigo-500";

export default function ReglagesPage() {
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    void createClient()
      .from("members")
      .select("shop_id")
      .limit(1)
      .single()
      .then(({ data }: { data: { shop_id: string } | null }) => setShopId(data?.shop_id ?? null));
  }, []);

  if (!shopId) return <p className="text-zinc-500">Chargement…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Réglages</h1>
      <BarbersSection shopId={shopId} />
      <ServicesSection shopId={shopId} />
    </div>
  );
}

function BarbersSection({ shopId }: { shopId: string }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [commissions, setCommissions] = useState<Record<string, number>>({});
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [barbersRes, privateRes] = await Promise.all([
      supabase.from("barbers").select("*").order("created_at"),
      supabase.from("barber_private").select("*"),
    ]);
    setBarbers((barbersRes.data as Barber[]) ?? []);
    setCommissions(
      Object.fromEntries(
        ((privateRes.data as BarberPrivate[]) ?? []).map((c) => [c.barber_id, Number(c.commission_pct)])
      )
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("barbers")
      .insert({ shop_id: shopId, display_name: newName.trim() })
      .select("id")
      .single();
    if (data) {
      await supabase.from("barber_private").insert({ barber_id: data.id, shop_id: shopId });
    }
    setNewName("");

    void load();
  }

  async function save(b: Barber) {
    const supabase = createClient();
    const pinDraft = pinDrafts[b.id];
    const pin_hash = pinDraft && /^\d{6}$/.test(pinDraft) ? await hash(pinDraft, 10) : undefined;
    await supabase
      .from("barbers")
      .update({
        display_name: b.display_name,
        color: b.color,
        active: b.active,
        ...(pin_hash ? { pin_hash } : {}),
      })
      .eq("id", b.id);
    await supabase
      .from("barber_private")
      .update({ commission_pct: commissions[b.id] ?? 0 })
      .eq("barber_id", b.id);
    setPinDrafts((prev) => ({ ...prev, [b.id]: "" }));

    void load();
  }

  function patch(id: string, changes: Partial<Barber>) {
    setBarbers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...changes } : b))
    );
  }

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm uppercase tracking-wide text-zinc-500">Coiffeurs</h2>
      <div className="space-y-3">
        {barbers.map((b) => (
          <div
            key={b.id}
            className={`flex flex-wrap items-center gap-3 p-3 rounded-xl bg-zinc-950/50 border border-zinc-800 ${
              b.active ? "" : "opacity-50"
            }`}
          >
            <input
              type="color"
              value={b.color}
              onChange={(e) => patch(b.id, { color: e.target.value })}
              className="w-9 h-9 rounded-lg bg-transparent border border-zinc-700 cursor-pointer"
            />
            <input
              value={b.display_name}
              onChange={(e) => patch(b.id, { display_name: e.target.value })}
              className={`${inputCls} w-36`}
              placeholder="Nom"
            />
            <label className="text-sm text-zinc-400 flex items-center gap-2">
              PIN
              <input
                value={pinDrafts[b.id] ?? ""}
                onChange={(e) =>
                  setPinDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))
                }
                maxLength={6}
                inputMode="numeric"
                placeholder={b.pin_hash ? "Réinitialiser (6 chiffres)" : "Définir (6 chiffres)"}
                className={`${inputCls} w-40`}
              />
            </label>
            <label className="text-sm text-zinc-400 flex items-center gap-2">
              Commission
              <input
                type="number"
                min={0}
                max={100}
                value={commissions[b.id] ?? 0}
                onChange={(e) =>
                  setCommissions((prev) => ({ ...prev, [b.id]: Number(e.target.value) }))
                }
                className={`${inputCls} w-20`}
              />
              %
            </label>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => {
                  patch(b.id, { active: !b.active });
                  void save({ ...b, active: !b.active });
                }}
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
              >
                {b.active ? "Désactiver" : "Activer"}
              </button>
              <button
                onClick={() => save(b)}
                className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors duration-150 font-medium"
              >
                Enregistrer
              </button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du nouveau coiffeur"
          className={`${inputCls} flex-1 max-w-xs`}
        />
        <button
          type="submit"
          className="text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors duration-150 font-medium"
        >
          + Ajouter
        </button>
      </form>
    </section>
  );
}

function ServicesSection({ shopId }: { shopId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [draft, setDraft] = useState({ name: "", price: "", category: "" });

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("services")
      .select("*")
      .order("category")
      .order("sort_order");
    setServices((data as Service[]) ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.price) return;
    await createClient().from("services").insert({
      shop_id: shopId,
      name: draft.name.trim(),
      price: Number(draft.price),
      category: draft.category.trim() || "Autre",
    });
    setDraft({ name: "", price: "", category: "" });
     
    void load();
  }

  async function save(s: Service) {
    await createClient()
      .from("services")
      .update({
        name: s.name,
        price: s.price,
        category: s.category,
        sort_order: s.sort_order,
        active: s.active,
      })
      .eq("id", s.id);
     
    void load();
  }

  function patch(id: string, changes: Partial<Service>) {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...changes } : s))
    );
  }

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm uppercase tracking-wide text-zinc-500">Prestations</h2>
      <div className="space-y-3">
        {services.map((s) => (
          <div
            key={s.id}
            className={`flex flex-wrap items-center gap-3 p-3 rounded-xl bg-zinc-950/50 border border-zinc-800 ${
              s.active ? "" : "opacity-50"
            }`}
          >
            <input
              value={s.name}
              onChange={(e) => patch(s.id, { name: e.target.value })}
              className={`${inputCls} w-44`}
              placeholder="Nom"
            />
            <label className="text-sm text-zinc-400 flex items-center gap-2">
              Prix
              <input
                type="number"
                min={0}
                step="0.5"
                value={s.price}
                onChange={(e) => patch(s.id, { price: Number(e.target.value) })}
                className={`${inputCls} w-24`}
              />
              €
            </label>
            <input
              value={s.category}
              onChange={(e) => patch(s.id, { category: e.target.value })}
              className={`${inputCls} w-32`}
              placeholder="Catégorie"
            />
            <label className="text-sm text-zinc-400 flex items-center gap-2">
              Ordre
              <input
                type="number"
                value={s.sort_order}
                onChange={(e) =>
                  patch(s.id, { sort_order: Number(e.target.value) })
                }
                className={`${inputCls} w-16`}
              />
            </label>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => {
                  patch(s.id, { active: !s.active });
                  void save({ ...s, active: !s.active });
                }}
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
              >
                {s.active ? "Désactiver" : "Activer"}
              </button>
              <button
                onClick={() => save(s)}
                className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors duration-150 font-medium"
              >
                Enregistrer
              </button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="flex flex-wrap gap-3">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Nouvelle prestation"
          className={`${inputCls} w-44`}
        />
        <input
          type="number"
          min={0}
          step="0.5"
          value={draft.price}
          onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          placeholder="Prix €"
          className={`${inputCls} w-24`}
        />
        <input
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          placeholder="Catégorie"
          className={`${inputCls} w-32`}
        />
        <button
          type="submit"
          className="text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors duration-150 font-medium"
        >
          + Ajouter
        </button>
      </form>
    </section>
  );
}
