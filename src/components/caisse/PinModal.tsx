"use client";

import { useEffect, useState } from "react";
import { compare } from "bcryptjs";
import type { Barber } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 3;
const THROTTLE_MS = 30_000;

function throttleKey(barberId: string): string {
  return `barber-pos-pin-throttle-${barberId}`;
}

function readThrottleUntil(barberId: string): number {
  const raw = localStorage.getItem(throttleKey(barberId));
  return raw ? Number(raw) : 0;
}

export function PinModal({
  barber,
  onSuccess,
  onCancel,
}: {
  barber: Barber;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [entered, setEntered] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(() => readThrottleUntil(barber.id));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lockedUntil <= now) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil, now]);

  const locked = lockedUntil > now;

  async function press(digit: string) {
    if (locked || checking) return;
    const next = entered + digit;
    if (next.length < PIN_LENGTH) {
      setEntered(next);
      return;
    }
    setEntered(next);
    setChecking(true);
    const ok = barber.pin_hash ? await compare(next, barber.pin_hash) : false;
    setChecking(false);
    if (ok) {
      onSuccess();
      return;
    }
    setEntered("");
    setShake(true);
    setTimeout(() => setShake(false), 400);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (nextAttempts >= MAX_ATTEMPTS) {
      // eslint-disable-next-line react-hooks/purity -- appelé depuis un event handler, pas pendant le render
      const until = Date.now() + THROTTLE_MS;
      localStorage.setItem(throttleKey(barber.id), String(until));
      setLockedUntil(until);
      setAttempts(0);
    }
  }

  const secondsLeft = locked ? Math.ceil((lockedUntil - now) / 1000) : 0;

  return (
    <Modal onClose={onCancel} maxWidth="max-w-xs">
      <Card className="p-6">
        <p className="text-center font-semibold mb-1">{barber.display_name}</p>
        <p className="text-center text-sm text-muted mb-4">
          {locked ? `Trop d'essais, réessayez dans ${secondsLeft}s` : "Code PIN"}
        </p>
        <div
          className={cn("flex justify-center gap-2 mb-6", shake && "animate-shake")}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={cn(
                "w-4 h-4 rounded-full border",
                i < entered.length
                  ? "bg-gold-500 border-gold-500"
                  : shake
                    ? "border-danger"
                    : "border-border-strong",
              )}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => void press(d)}
              disabled={locked || checking}
              className="h-14 rounded-xl bg-surface-2 hover:bg-border-strong/50 disabled:opacity-40 transition-colors duration-150 text-xl font-semibold"
            >
              {d}
            </button>
          ))}
          <button
            onClick={onCancel}
            className="h-14 rounded-xl text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors duration-150"
          >
            Annuler
          </button>
          <button
            onClick={() => void press("0")}
            disabled={locked || checking}
            className="h-14 rounded-xl bg-surface-2 hover:bg-border-strong/50 disabled:opacity-40 transition-colors duration-150 text-xl font-semibold"
          >
            0
          </button>
          <button
            onClick={() => setEntered("")}
            disabled={locked || checking}
            className="h-14 rounded-xl text-sm text-muted hover:text-foreground hover:bg-surface-2 disabled:opacity-40 transition-colors duration-150"
          >
            Effacer
          </button>
        </div>
      </Card>
    </Modal>
  );
}
