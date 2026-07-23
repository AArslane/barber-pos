"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SessionScope } from "@/lib/supabase/client";
import {
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type Barber,
  type Service,
} from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@/components/icons";

// Grille fixe 8h–21h en v1 ; les horaires par coiffeur viendront avec le
// booking par disponibilités (Phase 2).
const START_HOUR = 8;
const END_HOUR = 21;
const PX_PER_MIN = 1.2;
const SLOT_STEP_MIN = 15;
const GRID_MIN = (END_HOUR - START_HOUR) * 60;

// Clé sessionStorage lue par la page caisse : RDV → vente pré-remplie.
export const CAISSE_PREFILL_KEY = "caisse-agenda-prefill";
export type CaissePrefill = {
  appointment_id: string;
  barber_id: string | null;
  service_id: string | null;
};

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

function dayStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function minutesInGrid(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() - START_HOUR * 60;
}

// Répartit les RDV qui se chevauchent en couloirs côte à côte dans une colonne.
function layoutLanes(appts: Appointment[]): { appt: Appointment; lane: number; lanes: number }[] {
  const sorted = [...appts].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  const out: { appt: Appointment; lane: number; lanes: number }[] = [];
  let cluster: { appt: Appointment; lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const item of cluster) item.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const appt of sorted) {
    const start = new Date(appt.starts_at).getTime();
    const end = new Date(appt.ends_at).getTime();
    if (start >= clusterEnd) flush();
    clusterEnd = Math.max(clusterEnd, end);
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ appt, lane, lanes: 1 });
  }
  flush();
  return out;
}

type ModalState =
  | { mode: "create"; barberId: string | null; start: Date }
  | { mode: "edit"; appointment: Appointment };

export function AgendaDay({ scope, shopId }: { scope: SessionScope; shopId: string }) {
  const [day, setDay] = useState<Date>(() => dayStart(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const supabase = createClient(scope);
    const start = dayStart(day);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [apptsRes, barbersRes, servicesRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*")
        .eq("shop_id", shopId)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .neq("status", "cancelled")
        .order("starts_at"),
      supabase.from("barbers").select("*").eq("shop_id", shopId).eq("active", true),
      supabase.from("services").select("*").eq("shop_id", shopId).eq("active", true),
    ]);
    if (apptsRes.error || barbersRes.error || servicesRes.error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    setAppointments(apptsRes.data as Appointment[]);
    setBarbers(barbersRes.data as Barber[]);
    setServices(servicesRes.data as Service[]);
    setLoading(false);
  }, [scope, shopId, day]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch async, setState après await (faux positif)
    void load();
    const supabase = createClient(scope);
    const channel = supabase
      .channel(`agenda-${scope}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `shop_id=eq.${shopId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, scope, shopId]);

  // Colonne "Non assigné" seulement si des RDV du jour n'ont pas de coiffeur
  // (résa web "sans préférence") — on ne l'affiche pas à vide.
  const hasUnassigned = appointments.some((a) => a.barber_id === null);
  const columns: { id: string | null; label: string; color: string }[] = [
    ...barbers.map((b) => ({ id: b.id as string | null, label: b.display_name, color: b.color })),
    ...(hasUnassigned ? [{ id: null, label: "Non assigné", color: "#9ca3af" }] : []),
  ];

  const byColumn = useMemo(() => {
    const map = new Map<string | null, ReturnType<typeof layoutLanes>>();
    for (const col of columns) {
      map.set(col.id, layoutLanes(appointments.filter((a) => a.barber_id === col.id)));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columns dérive de barbers+appointments
  }, [appointments, barbers, hasUnassigned]);

  function shiftDay(delta: number) {
    const next = new Date(day);
    next.setDate(next.getDate() + delta);
    setDay(dayStart(next));
  }

  function clickColumn(barberId: string | null, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = (e.clientY - rect.top) / PX_PER_MIN;
    const snapped = Math.floor(minutes / SLOT_STEP_MIN) * SLOT_STEP_MIN;
    const start = new Date(day);
    start.setHours(START_HOUR, snapped, 0, 0);
    setModal({ mode: "create", barberId, start });
  }

  const dayLabel = day.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const isToday = dayStart(new Date()).getTime() === day.getTime();
  const nowMin = minutesInGrid(new Date().toISOString());

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-md" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="text-center py-10 space-y-3">
        <p className="font-semibold">Agenda indisponible</p>
        <p className="text-sm text-muted">
          Impossible de charger les rendez-vous. Vérifiez la connexion internet, puis réessayez.
        </p>
        <Button onClick={() => { setLoading(true); void load(); }}>Réessayer</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => shiftDay(-1)} aria-label="Jour précédent">
          <ChevronUpIcon className="w-4 h-4 -rotate-90" />
        </Button>
        <Button onClick={() => shiftDay(1)} aria-label="Jour suivant">
          <ChevronDownIcon className="w-4 h-4 -rotate-90" />
        </Button>
        {!isToday && (
          <Button variant="ghost" onClick={() => setDay(dayStart(new Date()))}>
            Aujourd&apos;hui
          </Button>
        )}
        <span className="font-semibold capitalize">{dayLabel}</span>
        <Input
          type="date"
          value={toDateInputValue(day)}
          onChange={(e) => {
            if (e.target.value) setDay(dayStart(new Date(`${e.target.value}T00:00`)));
          }}
          className="w-auto"
        />
        <span className="flex-1" />
        <Button
          variant="primary"
          onClick={() =>
            setModal({
              mode: "create",
              barberId: null,
              start: (() => {
                const s = new Date(day);
                const h = isToday ? Math.min(Math.max(new Date().getHours() + 1, START_HOUR), END_HOUR - 1) : 10;
                s.setHours(h, 0, 0, 0);
                return s;
              })(),
            })
          }
        >
          <PlusIcon className="w-4 h-4" />
          Nouveau RDV
        </Button>
      </div>

      {columns.length === 0 ? (
        <Card className="text-center py-10 text-muted">
          Aucun coiffeur actif. Ajoutez l&apos;équipe depuis le dashboard → Réglages.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <div className="min-w-fit">
            {/* En-têtes de colonnes */}
            <div className="flex border-b border-border sticky top-0 bg-surface z-10">
              <div className="w-14 shrink-0" />
              {columns.map((col) => (
                <div
                  key={col.id ?? "unassigned"}
                  className="flex-1 min-w-36 px-2 py-3 text-center font-semibold flex items-center justify-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="truncate">{col.label}</span>
                </div>
              ))}
            </div>

            <div className="flex">
              {/* Gouttière des heures */}
              <div className="w-14 shrink-0 relative" style={{ height: GRID_MIN * PX_PER_MIN }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <span
                    key={i}
                    className="absolute right-2 -translate-y-1/2 text-xs text-faint"
                    style={{ top: i * 60 * PX_PER_MIN }}
                  >
                    {START_HOUR + i}h
                  </span>
                ))}
              </div>

              {columns.map((col) => (
                <div
                  key={col.id ?? "unassigned"}
                  className="flex-1 min-w-36 relative border-l border-border cursor-pointer"
                  style={{ height: GRID_MIN * PX_PER_MIN }}
                  onClick={(e) => clickColumn(col.id, e)}
                >
                  {/* Lignes d'heures */}
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                    <div
                      key={i}
                      className="absolute inset-x-0 border-t border-border/50"
                      style={{ top: i * 60 * PX_PER_MIN }}
                    />
                  ))}
                  {/* Trait "maintenant" */}
                  {isToday && nowMin >= 0 && nowMin <= GRID_MIN && (
                    <div
                      className="absolute inset-x-0 border-t-2 border-gold-500 z-10 pointer-events-none"
                      style={{ top: nowMin * PX_PER_MIN }}
                    />
                  )}
                  {(byColumn.get(col.id) ?? []).map(({ appt, lane, lanes }) => {
                    const top = Math.max(minutesInGrid(appt.starts_at), 0) * PX_PER_MIN;
                    const height = Math.max(
                      (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000,
                      20,
                    ) * PX_PER_MIN;
                    const service = services.find((s) => s.id === appt.service_id);
                    return (
                      <button
                        key={appt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ mode: "edit", appointment: appt });
                        }}
                        className={cn(
                          "absolute rounded-lg border-l-4 px-2 py-1 text-left text-xs overflow-hidden transition-opacity",
                          appt.status !== "booked" && "opacity-50",
                        )}
                        style={{
                          top,
                          height,
                          left: `calc(${(lane / lanes) * 100}% + 2px)`,
                          width: `calc(${100 / lanes}% - 4px)`,
                          borderLeftColor: col.color,
                          backgroundColor: `${col.color}26`,
                        }}
                      >
                        <span className="block font-semibold truncate">
                          {fmtTime(appt.starts_at)} · {appt.client_name}
                        </span>
                        <span className="block text-muted truncate">
                          {service?.name ?? appt.title ?? ""}
                          {appt.status !== "booked" && ` · ${APPOINTMENT_STATUS_LABELS[appt.status]}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {modal && (
        <AppointmentModal
          scope={scope}
          shopId={shopId}
          barbers={barbers}
          services={services}
          state={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
          onError={(msg) => toast.error(msg)}
        />
      )}
    </div>
  );
}

function AppointmentModal({
  scope,
  shopId,
  barbers,
  services,
  state,
  onClose,
  onSaved,
  onError,
}: {
  scope: SessionScope;
  shopId: string;
  barbers: Barber[];
  services: Service[];
  state: ModalState;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const router = useRouter();
  const editing = state.mode === "edit" ? state.appointment : null;
  const initialStart = editing ? new Date(editing.starts_at) : state.mode === "create" ? state.start : new Date();
  const initialDuration = editing
    ? Math.round((new Date(editing.ends_at).getTime() - new Date(editing.starts_at).getTime()) / 60000)
    : 30;

  const [clientName, setClientName] = useState(editing?.client_name ?? "");
  const [clientPhone, setClientPhone] = useState(editing?.client_phone ?? "");
  const [barberId, setBarberId] = useState<string>(
    editing ? (editing.barber_id ?? "") : (state.mode === "create" ? (state.barberId ?? "") : ""),
  );
  const [serviceId, setServiceId] = useState<string>(editing?.service_id ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [dateStr, setDateStr] = useState(toDateInputValue(initialStart));
  const [timeStr, setTimeStr] = useState(toTimeInputValue(initialStart));
  const [durationMin, setDurationMin] = useState(initialDuration);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const durationTouched = useRef(false);

  const canSave = clientName.trim().length > 0 && dateStr !== "" && timeStr !== "" && !saving;

  function pickService(id: string) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc && !durationTouched.current) setDurationMin(svc.duration_min);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const starts = new Date(`${dateStr}T${timeStr}`);
    const ends = new Date(starts.getTime() + durationMin * 60000);
    const row = {
      shop_id: shopId,
      barber_id: barberId === "" ? null : barberId,
      service_id: serviceId === "" ? null : serviceId,
      title: serviceId === "" ? (title.trim() === "" ? null : title.trim()) : null,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() === "" ? null : clientPhone.trim(),
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      notes: notes.trim() === "" ? null : notes.trim(),
    };
    const supabase = createClient(scope);
    const { error } = editing
      ? await supabase.from("appointments").update(row).eq("id", editing.id)
      : await supabase.from("appointments").insert(row);
    setSaving(false);
    if (error) {
      onError("Enregistrement impossible. Vérifiez la connexion internet.");
      return;
    }
    onSaved();
  }

  async function setStatus(status: "cancelled" | "no_show" | "booked") {
    if (!editing) return;
    setSaving(true);
    const supabase = createClient(scope);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", editing.id);
    setSaving(false);
    if (error) {
      onError("Action impossible. Vérifiez la connexion internet.");
      return;
    }
    onSaved();
  }

  // RDV → vente pré-remplie : la page caisse lit ce prefill au montage.
  function toCheckout() {
    if (!editing) return;
    const prefill: CaissePrefill = {
      appointment_id: editing.id,
      barber_id: editing.barber_id,
      service_id: editing.service_id,
    };
    sessionStorage.setItem(CAISSE_PREFILL_KEY, JSON.stringify(prefill));
    router.push("/caisse");
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <Card className="space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {editing ? "Rendez-vous" : "Nouveau rendez-vous"}
          </h2>
          {editing && editing.source === "web" && (
            <span className="text-xs text-gold-400 font-semibold uppercase tracking-wide">
              Résa web
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Client *">
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nom du client"
              maxLength={120}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              inputMode="tel"
              placeholder="06 12 34 56 78"
              maxLength={30}
            />
          </Field>
          <Field label="Coiffeur">
            <Select value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              <option value="">Non assigné</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prestation">
            <Select value={serviceId} onChange={(e) => pickService(e.target.value)}>
              <option value="">Autre (texte libre)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          {serviceId === "" && (
            <Field label="Libellé" className="sm:col-span-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Coupe + soin"
                maxLength={120}
              />
            </Field>
          )}
          <Field label="Date">
            <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Heure">
              <Input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} step={300} />
            </Field>
            <Field label="Durée">
              <Select
                value={String(durationMin)}
                onChange={(e) => {
                  durationTouched.current = true;
                  setDurationMin(Number(e.target.value));
                }}
              >
                {[...new Set([...DURATIONS, durationMin])]
                  .sort((a, b) => a - b)
                  .map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes" className="sm:col-span-2">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionnel"
              maxLength={1000}
            />
          </Field>
        </div>

        {editing && (
          <p className="text-xs text-muted">
            Statut : {APPOINTMENT_STATUS_LABELS[editing.status]}
            {editing.client_email ? ` · ${editing.client_email}` : ""}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {editing && scope === "caisse" && editing.status === "booked" && (
            <Button variant="primary" onClick={toCheckout}>
              Encaisser ce RDV
            </Button>
          )}
          {editing && editing.status === "booked" && (
            <>
              <Button onClick={() => void setStatus("no_show")} disabled={saving}>
                Absent
              </Button>
              <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={saving}>
                Annuler le RDV
              </Button>
            </>
          )}
          {editing && editing.status === "no_show" && (
            <Button onClick={() => void setStatus("booked")} disabled={saving}>
              Rétablir
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!canSave}>
            {saving ? "…" : "Enregistrer"}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        title="Annuler ce rendez-vous ?"
        message={`Le rendez-vous de ${clientName} sera marqué annulé et disparaîtra de l'agenda.`}
        confirmLabel="Annuler le RDV"
        danger
        onConfirm={() => {
          setConfirmCancel(false);
          void setStatus("cancelled");
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </Modal>
  );
}
