"use client";

import { AgendaDay } from "@/components/agenda/AgendaDay";
import { useActiveShopId } from "@/components/dashboard/ActiveShopContext";

export default function AgendaPage() {
  const shopId = useActiveShopId();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Agenda</h1>
      <AgendaDay scope="owner" shopId={shopId} />
    </div>
  );
}
