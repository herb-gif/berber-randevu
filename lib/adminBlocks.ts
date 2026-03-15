import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase";

export type BusyRange = { s: number; e: number };

type GetBlockBusyArgs = {
  dayStartISO: string;
  dayEndISO: string;
  needsHair?: boolean;
  needsNiyazi?: boolean;
  needsExternal?: boolean;
  barberId?: string | null;
  useAdmin?: boolean;
};

export async function getAdminBlockBusy({
  dayStartISO,
  dayEndISO,
  needsHair = false,
  needsNiyazi = false,
  needsExternal = false,
  barberId = null,
  useAdmin = false,
}: GetBlockBusyArgs): Promise<{
  hairBusy: BusyRange[];
  niyaziBusy: BusyRange[];
  externalBusy: BusyRange[];
  error: string | null;
}> {
  const db: any = useAdmin && supabaseAdmin ? supabaseAdmin : supabase;

  const [hairRes, niyaziRes, externalRes] = await Promise.all([
    needsHair
      ? db
          .from("admin_blocks")
          .select("start_at,end_at")
          .eq("is_active", true)
          .eq("resource", "hair")
          .eq("barber_id", barberId as string)
          .lt("start_at", dayEndISO)
          .gt("end_at", dayStartISO)
      : Promise.resolve({ data: [], error: null }),

    needsNiyazi
      ? db
          .from("admin_blocks")
          .select("start_at,end_at")
          .eq("is_active", true)
          .eq("resource", "niyazi")
          .lt("start_at", dayEndISO)
          .gt("end_at", dayStartISO)
      : Promise.resolve({ data: [], error: null }),

    needsExternal
      ? db
          .from("admin_blocks")
          .select("start_at,end_at")
          .eq("is_active", true)
          .eq("resource", "external")
          .lt("start_at", dayEndISO)
          .gt("end_at", dayStartISO)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const err =
    hairRes?.error?.message ||
    niyaziRes?.error?.message ||
    externalRes?.error?.message ||
    null;

  if (err) {
    return {
      hairBusy: [],
      niyaziBusy: [],
      externalBusy: [],
      error: err,
    };
  }

  return {
    hairBusy: (hairRes.data ?? []).map((a: any) => ({
      s: Date.parse(a.start_at),
      e: Date.parse(a.end_at),
    })),
    niyaziBusy: (niyaziRes.data ?? []).map((a: any) => ({
      s: Date.parse(a.start_at),
      e: Date.parse(a.end_at),
    })),
    externalBusy: (externalRes.data ?? []).map((a: any) => ({
      s: Date.parse(a.start_at),
      e: Date.parse(a.end_at),
    })),
    error: null,
  };
}
