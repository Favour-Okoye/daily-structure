import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { awardCustom } from "./xp";
import type { AnchorDef, ChurchEvent } from "./anchors";

export interface AnchorLogRow {
  anchor_slug: string;
  status: "done" | "grace";
  done_at: string;
  meta: Record<string, unknown>;
}

/** All checkmarks for one app-day, keyed by slug (anchors + church events). */
export function useAnchorLog(day: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ds_anchor_log", session?.user.id, day],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<Record<string, AnchorLogRow>> => {
      const { data, error } = await supabase!
        .from("ds_anchor_log")
        .select("anchor_slug, status, done_at, meta")
        .eq("day", day);
      if (error) throw error;
      const map: Record<string, AnchorLogRow> = {};
      for (const row of (data ?? []) as AnchorLogRow[]) map[row.anchor_slug] = row;
      return map;
    },
  });
}

async function logAndAward(
  day: string,
  slug: string,
  action: string,
  refType: string,
  refId: string,
  points: number,
  meta: Record<string, unknown> = {}
) {
  if (!supabase) throw new Error("not connected");
  const { error } = await supabase
    .from("ds_anchor_log")
    .upsert(
      { day, anchor_slug: slug, status: "done", meta },
      { onConflict: "user_id,day,anchor_slug", ignoreDuplicates: true }
    );
  if (error) throw error;
  await awardCustom(action, refType, refId, points);
}

export function useCheckAnchor(day: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ def, meta }: { def: AnchorDef; meta?: Record<string, unknown> }) => {
      await logAndAward(day, def.slug, `anchor_${def.slug}`, "anchor", day, def.xp, meta ?? {});
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ds_anchor_log", session?.user.id, day] });
      void qc.invalidateQueries({ queryKey: ["ds_xp_days", session?.user.id] });
    },
  });
}

export function useCheckChurch(day: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ event }: { event: ChurchEvent }) => {
      await logAndAward(
        day,
        `church_${event.slug}`,
        "church_event",
        "event",
        `${day}:${event.slug}`,
        event.xp
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ds_anchor_log", session?.user.id, day] });
      void qc.invalidateQueries({ queryKey: ["ds_xp_days", session?.user.id] });
    },
  });
}

export interface DsSettings {
  confession_lines: string[];
  data: Record<string, unknown>;
}

export function useSettings() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ds_settings", session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<DsSettings> => {
      const { data, error } = await supabase!
        .from("ds_settings")
        .select("confession_lines, data")
        .maybeSingle();
      if (error) throw error;
      return (data as DsSettings) ?? { confession_lines: [], data: {} };
    },
  });
}

export function useSaveConfession() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lines: string[]) => {
      if (!supabase) throw new Error("not connected");
      const { error } = await supabase
        .from("ds_settings")
        .upsert({ user_id: session?.user.id, confession_lines: lines }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ds_settings", session?.user.id] }),
  });
}
