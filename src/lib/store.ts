import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ====== Types (camelCase API for UI) ======
export type Media = {
  id: string;
  name: string;
  type: "image" | "video";
  url: string; // signed URL for display
  storagePath: string | null;
  createdAt: number;
};

export type Presentation = {
  id: string;
  name: string;
  mediaIds: string[];
  durationMs: number;
  loop: boolean;
  description?: string;
  transition?: "fade" | "zoom" | "slide" | "push";
};

export type Terminal = {
  id: string;
  name: string;
  presentationId: string | null;
  active: boolean;
  resolution: string;
  refreshToken: number;
  lastSync: number;
};

export type AppState = {
  media: Media[];
  presentations: Presentation[];
  terminals: Terminal[];
  ready: boolean;
  autoDeleteEnabled: boolean;
};

const BUCKET = "media";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

const state: AppState = { media: [], presentations: [], terminals: [], ready: false, autoDeleteEnabled: false };
const listeners = new Set<(s: AppState) => void>();
let initStarted = false;
let initPromise: Promise<void> | null = null;

function emit() {
  const snap = { ...state, media: [...state.media], presentations: [...state.presentations], terminals: [...state.terminals] };
  listeners.forEach((l) => l(snap));
}

// ====== Mappers ======
async function signUrl(path: string | null): Promise<string> {
  if (!path) return "";
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error || !data) return "";
  return data.signedUrl;
}

async function mapMediaRow(row: any): Promise<Media> {
  // Prefer fresh signed URL from storage_path; fallback to stored url
  const url = row.storage_path ? await signUrl(row.storage_path) : row.url ?? "";
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url,
    storagePath: row.storage_path ?? null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapPres(row: any): Presentation {
  return {
    id: row.id,
    name: row.name,
    mediaIds: row.media_ids ?? [],
    durationMs: row.duration_ms ?? 5000,
    loop: row.loop ?? true,
    description: row.description ?? "",
    transition: row.transition ?? "fade",
  };
}

function mapTerm(row: any): Terminal {
  return {
    id: row.id,
    name: row.name,
    presentationId: row.presentation_id,
    active: row.active,
    resolution: row.resolution,
    refreshToken: Number(row.refresh_token ?? 0),
    lastSync: new Date(row.last_sync).getTime(),
  };
}

// ====== Initial load + realtime ======
async function init() {
  if (initStarted) return initPromise!;
  initStarted = true;
  initPromise = (async () => {
    const [mRes, pRes, tRes, sRes] = await Promise.all([
      supabase.from("media").select("*").order("created_at", { ascending: false }),
      supabase.from("presentations").select("*").order("created_at", { ascending: false }),
      supabase.from("terminals").select("*").order("created_at", { ascending: true }),
      supabase.from("app_settings").select("*").eq("id", true).maybeSingle(),
    ]);
    if (mRes.data) state.media = await Promise.all(mRes.data.map(mapMediaRow));
    if (pRes.data) state.presentations = pRes.data.map(mapPres);
    if (tRes.data) state.terminals = tRes.data.map(mapTerm);
    if (sRes.data) state.autoDeleteEnabled = !!sRes.data.auto_delete_enabled;
    state.ready = true;
    emit();

    // Run retention sweep now, then every 30 minutes while tab is open
    runRetentionSweep();
    setInterval(runRetentionSweep, 30 * 60 * 1000);

    // Realtime subscriptions
    supabase
      .channel("ccp-media")
      .on("postgres_changes", { event: "*", schema: "public", table: "media" }, async (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const m = await mapMediaRow(payload.new);
          const idx = state.media.findIndex((x) => x.id === m.id);
          if (idx >= 0) state.media[idx] = m;
          else state.media.unshift(m);
        } else if (payload.eventType === "DELETE") {
          state.media = state.media.filter((x) => x.id !== (payload.old as any).id);
        }
        emit();
      })
      .subscribe();

    supabase
      .channel("ccp-pres")
      .on("postgres_changes", { event: "*", schema: "public", table: "presentations" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const p = mapPres(payload.new);
          const idx = state.presentations.findIndex((x) => x.id === p.id);
          if (idx >= 0) state.presentations[idx] = p;
          else state.presentations.unshift(p);
        } else if (payload.eventType === "DELETE") {
          state.presentations = state.presentations.filter((x) => x.id !== (payload.old as any).id);
        }
        emit();
      })
      .subscribe();

    supabase
      .channel("ccp-term")
      .on("postgres_changes", { event: "*", schema: "public", table: "terminals" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const t = mapTerm(payload.new);
          const idx = state.terminals.findIndex((x) => x.id === t.id);
          if (idx >= 0) state.terminals[idx] = t;
          else state.terminals.push(t);
        } else if (payload.eventType === "DELETE") {
          state.terminals = state.terminals.filter((x) => x.id !== (payload.old as any).id);
        }
        emit();
      })
      .subscribe();

    supabase
      .channel("ccp-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, (payload) => {
        const row: any = payload.new ?? payload.old;
        if (row) state.autoDeleteEnabled = !!row.auto_delete_enabled;
        emit();
        runRetentionSweep();
      })
      .subscribe();
  })();
  return initPromise;
}

async function runRetentionSweep() {
  if (!state.autoDeleteEnabled) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const expired = state.media.filter((m) => m.createdAt < cutoff);
  for (const m of expired) {
    try { await deleteMediaFromLibrary(m.id); } catch (e) { console.error("retention sweep", e); }
  }
}

export async function setAutoDeleteEnabled(enabled: boolean) {
  await supabase.from("app_settings").update({ auto_delete_enabled: enabled, updated_at: new Date().toISOString() }).eq("id", true);
}

export async function deleteMediaBulk(ids: string[]) {
  for (const id of ids) {
    try { await deleteMediaFromLibrary(id); } catch (e) { console.error(e); }
  }
}

export function useStore(): AppState {
  const [s, setS] = useState<AppState>(() => ({ ...state, media: [...state.media], presentations: [...state.presentations], terminals: [...state.terminals] }));
  useEffect(() => {
    const l = (n: AppState) => setS(n);
    listeners.add(l);
    if (typeof window !== "undefined") init();
    return () => { listeners.delete(l); };
  }, []);
  return s;
}

// ====== Session (admin/terminal login) ======
const AUTH_KEY = "clubeon_ccp_auth";
export type Session = { kind: "admin" } | { kind: "terminal"; terminalId: string } | null;

export function getSession(): Session {
  if (typeof window === "undefined") return null;
  try { const raw = sessionStorage.getItem(AUTH_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function setSession(s: Session) {
  if (typeof window === "undefined") return;
  if (s) sessionStorage.setItem(AUTH_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(AUTH_KEY);
}

// ====== Mutations ======
export async function addMedia(files: FileList | File[]): Promise<Media[]> {
  const arr = Array.from(files);
  const out: Media[] = [];
  for (const file of arr) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (up.error) { console.error(up.error); continue; }
    const type: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
    const url = await signUrl(path);
    const ins = await supabase.from("media").insert({ name: file.name, type, url, storage_path: path }).select().single();
    if (ins.error || !ins.data) { console.error(ins.error); continue; }
    const media: Media = { id: ins.data.id, name: ins.data.name, type, url, storagePath: path, createdAt: Date.now() };
    out.push(media);
    // optimistic local update (realtime will reconcile)
    if (!state.media.find((m) => m.id === media.id)) { state.media.unshift(media); emit(); }
  }
  return out;
}

export async function deleteMediaFromLibrary(id: string) {
  const m = state.media.find((x) => x.id === id);
  if (m?.storagePath) await supabase.storage.from(BUCKET).remove([m.storagePath]);
  await supabase.from("media").delete().eq("id", id);
  // Also remove from any presentations that reference it
  const affected = state.presentations.filter((p) => p.mediaIds.includes(id));
  await Promise.all(affected.map((p) =>
    supabase.from("presentations").update({ media_ids: p.mediaIds.filter((x) => x !== id) }).eq("id", p.id)
  ));
}

export async function renameMedia(id: string, name: string) {
  await supabase.from("media").update({ name }).eq("id", id);
}

export async function createPresentation(name: string): Promise<string | null> {
  const ins = await supabase.from("presentations").insert({ name, media_ids: [], duration_ms: 5000, loop: true, description: "", transition: "fade" }).select().single();
  if (ins.error || !ins.data) { console.error(ins.error); return null; }
  return ins.data.id;
}

export async function updatePresentation(id: string, patch: Partial<Presentation>) {
  const dbPatch: any = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.mediaIds !== undefined) dbPatch.media_ids = patch.mediaIds;
  if (patch.durationMs !== undefined) dbPatch.duration_ms = patch.durationMs;
  if (patch.loop !== undefined) dbPatch.loop = patch.loop;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.transition !== undefined) dbPatch.transition = patch.transition;
  await supabase.from("presentations").update(dbPatch).eq("id", id);
}

export async function deletePresentation(id: string) {
  await supabase.from("presentations").delete().eq("id", id);
}

export async function createTerminal(name: string) {
  await supabase.from("terminals").insert({ name, presentation_id: null, active: true, resolution: "1920x1080" });
}

export async function updateTerminal(id: string, patch: Partial<Terminal>) {
  const dbPatch: any = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.presentationId !== undefined) dbPatch.presentation_id = patch.presentationId;
  if (patch.active !== undefined) dbPatch.active = patch.active;
  if (patch.resolution !== undefined) dbPatch.resolution = patch.resolution;
  await supabase.from("terminals").update(dbPatch).eq("id", id);
}

export async function deleteTerminal(id: string) {
  await supabase.from("terminals").delete().eq("id", id);
}

// Bump refresh_token + last_sync — realtime UPDATE will reach every connected terminal/admin.
export async function pingTerminal(terminalId: string) {
  const t = state.terminals.find((x) => x.id === terminalId);
  const next = (t?.refreshToken ?? 0) + 1;
  await supabase.from("terminals").update({ refresh_token: next, last_sync: new Date().toISOString() }).eq("id", terminalId);
}