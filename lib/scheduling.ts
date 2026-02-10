export type ServiceRow = {
  id: string;
  name: string;
  default_duration_min: number;
  service_type?: string | null;
  resource_group?: string | null; // hair | niyazi | external
};

const ORDER: Record<string, number> = {
  hair: 1,
  facial: 2,
  laser: 3,
  brow: 4,
  other: 9,
};

export function inferTypeFromName(name: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("lazer") || n.includes("laser")) return "laser";
  if (n.includes("hydra") || n.includes("facial")) return "facial";
  if (n.includes("kaş") || n.includes("kas") || n.includes("brow")) return "brow";
  return "hair";
}

export function normalizeType(s: ServiceRow): string {
  const t = (s.service_type || "").toLowerCase().trim();
  if (t === "hair" || t === "laser" || t === "facial" || t === "brow") return t;
  return inferTypeFromName(s.name);
}

// ✅ resource_group varsa onu kullan (asıl kural)
export function resourceFor(s: ServiceRow): "hair" | "niyazi" | "external" {
  const g = (s.resource_group || "").toLowerCase().trim();
  if (g === "hair" || g === "niyazi" || g === "external") return g as any;

  // fallback: type'a göre
  const t = normalizeType(s);
  return t === "hair" ? "hair" : "niyazi";
}

export function sortServices(services: ServiceRow[]): ServiceRow[] {
  return [...services].sort((a, b) => {
    const ta = normalizeType(a);
    const tb = normalizeType(b);
    return (ORDER[ta] ?? ORDER.other) - (ORDER[tb] ?? ORDER.other);
  });
}

export function buildSegments(args: {
  startMs: number;
  services: ServiceRow[];
  barberId: string | null;
}) {
  let t = args.startMs;
  let sort = 1;

  const segs: Array<{
    service_id: string;
    resource: "hair" | "niyazi" | "external";
    barber_id: string | null;
    sort_order: number;
    startMs: number;
    endMs: number;
  }> = [];

  for (const s of args.services) {
    const dur = Number(s.default_duration_min || 0);
    const resource = resourceFor(s);

    const startMs = t;
    const endMs = t + dur * 60_000;

    segs.push({
      service_id: s.id,
      resource,
      barber_id: resource === "hair" ? args.barberId : null,
      sort_order: sort++,
      startMs,
      endMs,
    });

    t = endMs;
  }

  return { segments: segs, endMs: t };
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return !(aEnd <= bStart || aStart >= bEnd);
}

export function hhmmToMinute(hhmm: string) {
  const [hh, mm] = hhmm.split(":").map((x) => Number(x));
  return hh * 60 + mm;
}
