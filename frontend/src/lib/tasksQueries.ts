import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { appDay, shiftDay } from "./day";
import { awardCustom, DS_XP } from "./xp";

export interface DsTask {
  id: string;
  title: string;
  notes: string | null;
  kind: "general" | "job_application" | "job_followup" | "bi_practice" | "church" | "errand";
  due_on: string | null;
  est_minutes: number;
  status: "open" | "done" | "dropped";
  completed_on: string | null;
}

export interface DsEvent {
  id: string;
  title: string;
  day: string;
  start_min: number;
  end_min: number;
}

export function taskXp(t: Pick<DsTask, "kind" | "est_minutes">): number {
  if (t.kind === "job_application") return DS_XP.job_application;
  if (t.kind === "job_followup") return DS_XP.job_followup;
  if (t.est_minutes <= 30) return DS_XP.task_small;
  if (t.est_minutes <= 90) return DS_XP.task_medium;
  return DS_XP.task_large;
}

export function useOpenTasks() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ds_tasks_open", session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<DsTask[]> => {
      const { data, error } = await supabase!
        .from("ds_tasks")
        .select("id, title, notes, kind, due_on, est_minutes, status, completed_on")
        .eq("status", "open")
        .order("due_on", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DsTask[];
    },
  });
}

export function useRecentDoneTasks() {
  const { session } = useAuth();
  const from = shiftDay(appDay(), -7);
  return useQuery({
    queryKey: ["ds_tasks_done", session?.user.id, from],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<DsTask[]> => {
      const { data, error } = await supabase!
        .from("ds_tasks")
        .select("id, title, notes, kind, due_on, est_minutes, status, completed_on")
        .eq("status", "done")
        .gte("completed_on", from)
        .order("completed_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DsTask[];
    },
  });
}

function useInvalidateTasks() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["ds_tasks_open", session?.user.id] });
    void qc.invalidateQueries({ queryKey: ["ds_tasks_done", session?.user.id] });
    void qc.invalidateQueries({ queryKey: ["ds_xp_days", session?.user.id] });
  };
}

export function useAddTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: async (t: {
      title: string;
      kind: DsTask["kind"];
      due_on: string | null;
      est_minutes: number;
    }) => {
      if (!supabase) throw new Error("not connected");
      const { error } = await supabase.from("ds_tasks").insert(t);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useCompleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: async (t: DsTask) => {
      if (!supabase) throw new Error("not connected");
      const today = appDay();
      const { error } = await supabase
        .from("ds_tasks")
        .update({ status: "done", completed_on: today })
        .eq("id", t.id);
      if (error) throw error;
      await awardCustom("task_done", "task", t.id, taskXp(t));
      if (t.due_on && today <= t.due_on) {
        await awardCustom("task_on_time", "task_bonus", t.id, DS_XP.task_on_time);
      }
    },
    onSuccess: () => invalidate(),
  });
}

export function useDropTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("not connected");
      const { error } = await supabase.from("ds_tasks").update({ status: "dropped" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useEvents() {
  const { session } = useAuth();
  const from = appDay();
  return useQuery({
    queryKey: ["ds_events", session?.user.id, from],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<DsEvent[]> => {
      const { data, error } = await supabase!
        .from("ds_events")
        .select("id, title, day, start_min, end_min")
        .gte("day", from)
        .order("day")
        .order("start_min");
      if (error) throw error;
      return (data ?? []) as DsEvent[];
    },
  });
}

export function useAddEvent() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { title: string; day: string; start_min: number; end_min: number }) => {
      if (!supabase) throw new Error("not connected");
      const { error } = await supabase.from("ds_events").insert(e);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ds_events", session?.user.id] }),
  });
}

export function useDeleteEvent() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("not connected");
      const { error } = await supabase.from("ds_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ds_events", session?.user.id] }),
  });
}

/** Today's approved plan (written by the ceremony the night before). */
export function useDayPlan(day: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ds_day_plan", session?.user.id, day],
    enabled: !!supabase && !!session,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("ds_day_plans")
        .select("plan, approved_at")
        .eq("day", day)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}
