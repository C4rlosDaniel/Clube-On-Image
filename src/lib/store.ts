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
  sizeBytes: number;
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
  showTicker: boolean;
};

export type TickerMessage = {
  id: string;
  text: string;
  label: string;
  color: string;
  priority: boolean;
  active: boolean;
  orderIndex: number;
  startsAt: number | null;
  endsAt: number | null;
  terminalIds: string[]; // empty = all
  createdAt: number;
};

export type AppState = {
  media: Media[];
  presentations: Presentation[];
  terminals: Terminal[];
  tickerMessages: TickerMessage[];
  ready: boolean;
  autoDeleteEnabled: boolean;
  tickerSettings: TickerSettings;
};

export type TickerSettings = {
  heightPx: number;
  fontFamily: string;
  fontMin: number;
  fontMax: number;
  bgColor: string;
  bgOpacity: number;
  /** Horizontal scroll speed multiplier. 1.0 = baseline; 2.0 = twice as fast. */
  scrollSpeed: number;
  /** Global on/off switch for the ticker across every terminal. */
  visibleAll: boolean;
};

// 96 dpi conversion. Kept as a single source of truth.
export const PX_PER_CM = 37.7952755906;
// New spec: 1.0cm .. 2.2cm. Old 5cm limit is fully removed.
export const TICKER_HEIGHT_MIN_CM = 1.0;
export const TICKER_HEIGHT_MAX_CM = 2.2;
export const TICKER_HEIGHT_MIN = Math.round(TICKER_HEIGHT_MIN_CM * PX_PER_CM); // ~38
export const TICKER_HEIGHT_MAX = Math.round(TICKER_HEIGHT_MAX_CM * PX_PER_CM); // ~83

// Scroll speed multiplier range for the ticker (1.0 = baseline).
export const TICKER_SPEED_MIN = 1.0;
export const TICKER_SPEED_MAX = 4.0;

// Manual text-size range for the ticker (px).
export const TICKER_FONT_MIN = 12;
export const TICKER_FONT_MAX = 24;

// Library storage cap (hard limit).
export const MEDIA_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB
export const MEDIA_WARN_BYTES = Math.round(MEDIA_LIMIT_BYTES * 0.9); // 450 MB

const DEFAULT_TICKER: TickerSettings = {
  heightPx: Math.round(1.5 * PX_PER_CM), // ~57px (~1.5cm)
  fontFamily: "Roboto",
  fontMin: 16,
  fontMax: 16,
  bgColor: "#ffffff",
  bgOpacity: 0.95,
  scrollSpeed: 1.0,
  visibleAll: true,
};

const BUCKET = "media";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

const state: AppState = {
  media: [], presentations: [], terminals: [], tickerMessages: [],
  ready: false, autoDeleteEnabled: false, tickerSettings: { ...DEFAULT_TICKER },
};
const listeners = new Set<(s: AppState) => void>();
let initStarted = false;
let initPromise: Promise<void> | null = null;

function emit() {
  const snap = { ...state, media: [...state.media], presentations: [...state.presentations], terminals: [...state.terminals], tickerMessages: [...state.tickerMessages], tickerSettings: { ...state.tickerSettings } };
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
    sizeBytes: Number(row.size_bytes ?? 0),
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
    showTicker: row.show_ticker ?? true,
  };
}

function mapTicker(row: any): TickerMessage {
  return {
    id: row.id,
    text: row.text,
    label: row.label ?? "AVISO",
    color: row.color ?? "#dc2626",
    priority: !!row.priority,
    active: !!row.active,
    orderIndex: row.order_index ?? 0,
    startsAt: row.starts_at ? new Date(row.starts_at).getTime() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).getTime() : null,
    terminalIds: row.terminal_ids ?? [],
    createdAt: new Date(row.created_at).getTime(),
  };
}

// ====== Initial load + realtime ======
async function init() {
  if (initStarted) return initPromise!;
  initStarted = true;
  initPromise = (async () => {
    const [mRes, pRes, tRes, sRes, kRes] = await Promise.all([
      supabase.from("media").select("*").order("created_at", { ascending: false }),
      supabase.from("presentations").select("*").order("created_at", { ascending: false }),
      supabase.from("terminals").select("*").order("created_at", { ascending: true }),
      supabase.from("app_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("ticker_messages").select("*").order("order_index", { ascending: true }),
    ]);
    if (mRes.data) state.media = await Promise.all(mRes.data.map(mapMediaRow));
    if (pRes.data) state.presentations = pRes.data.map(mapPres);
    if (tRes.data) state.terminals = tRes.data.map(mapTerm);
    if (sRes.data) {
      state.autoDeleteEnabled = !!sRes.data.auto_delete_enabled;
      state.tickerSettings = mapSettings(sRes.data);
    }
    if (kRes.data) state.tickerMessages = kRes.data.map(mapTicker);
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
        if (row) {
          state.autoDeleteEnabled = !!row.auto_delete_enabled;
          state.tickerSettings = mapSettings(row);
        }
        emit();
        runRetentionSweep();
      })
      .subscribe();

    supabase
      .channel("ccp-ticker")
      .on("postgres_changes", { event: "*", schema: "public", table: "ticker_messages" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const m = mapTicker(payload.new);
          const idx = state.tickerMessages.findIndex((x) => x.id === m.id);
          if (idx >= 0) state.tickerMessages[idx] = m;
          else state.tickerMessages.push(m);
          state.tickerMessages.sort((a, b) => a.orderIndex - b.orderIndex);
        } else if (payload.eventType === "DELETE") {
          state.tickerMessages = state.tickerMessages.filter((x) => x.id !== (payload.old as any).id);
        }
        emit();
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

function mapSettings(row: any): TickerSettings {
  const rawHeight = Number(row.ticker_height_px ?? DEFAULT_TICKER.heightPx);
  const heightPx = Math.max(TICKER_HEIGHT_MIN, Math.min(TICKER_HEIGHT_MAX, Math.round(rawHeight)));
  return {
    heightPx,
    fontFamily: row.ticker_font_family ?? DEFAULT_TICKER.fontFamily,
    fontMin: Number(row.ticker_font_min ?? DEFAULT_TICKER.fontMin),
    fontMax: Number(row.ticker_font_max ?? DEFAULT_TICKER.fontMax),
    bgColor: row.ticker_bg_color ?? DEFAULT_TICKER.bgColor,
    bgOpacity: Number(row.ticker_bg_opacity ?? DEFAULT_TICKER.bgOpacity),
    scrollSpeed: Math.max(TICKER_SPEED_MIN, Math.min(TICKER_SPEED_MAX, Number(row.ticker_scroll_speed ?? DEFAULT_TICKER.scrollSpeed))),
    visibleAll: row.ticker_visible_all ?? DEFAULT_TICKER.visibleAll,
  };
}

export async function updateTickerSettings(patch: Partial<TickerSettings>) {
  const db: any = { updated_at: new Date().toISOString() };
  if (patch.heightPx !== undefined) db.ticker_height_px = Math.max(TICKER_HEIGHT_MIN, Math.min(TICKER_HEIGHT_MAX, Math.round(patch.heightPx)));
  if (patch.fontFamily !== undefined) db.ticker_font_family = patch.fontFamily;
  if (patch.fontMin !== undefined) db.ticker_font_min = patch.fontMin;
  if (patch.fontMax !== undefined) db.ticker_font_max = patch.fontMax;
  if (patch.bgColor !== undefined) db.ticker_bg_color = patch.bgColor;
  if (patch.bgOpacity !== undefined) db.ticker_bg_opacity = patch.bgOpacity;
  if (patch.scrollSpeed !== undefined) db.ticker_scroll_speed = Math.max(TICKER_SPEED_MIN, Math.min(TICKER_SPEED_MAX, Number(patch.scrollSpeed)));
  if (patch.visibleAll !== undefined) db.ticker_visible_all = !!patch.visibleAll;
  await supabase.from("app_settings").update(db).eq("id", true);
}

// ====== Library storage helpers ======
export function getMediaTotalBytes(): number {
  return state.media.reduce((acc, m) => acc + (m.sizeBytes || 0), 0);
}
export type AddMediaResult = {
  added: Media[];
  blocked: boolean;
  reason?: "over-limit";
  attemptedBytes: number;
};

export async function deleteMediaBulk(ids: string[]) {
  for (const id of ids) {
    try { await deleteMediaFromLibrary(id); } catch (e) { console.error(e); }
  }
}

export function useStore(): AppState {
  const [s, setS] = useState<AppState>(() => ({ ...state, media: [...state.media], presentations: [...state.presentations], terminals: [...state.terminals], tickerMessages: [...state.tickerMessages] }));
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
export async function addMedia(files: FileList | File[]): Promise<AddMediaResult> {
  const arr = Array.from(files);
  const attemptedBytes = arr.reduce((a, f) => a + f.size, 0);
  const used = getMediaTotalBytes();
  // Gate the entire batch: if it wouldn't fit, reject as a whole.
  if (used + attemptedBytes > MEDIA_LIMIT_BYTES) {
    return { added: [], blocked: true, reason: "over-limit", attemptedBytes };
  }
  const out: Media[] = [];
  for (const file of arr) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (up.error) { console.error(up.error); continue; }
    const type: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
    const url = await signUrl(path);
    const ins = await supabase.from("media").insert({ name: file.name, type, url, storage_path: path, size_bytes: file.size }).select().single();
    if (ins.error || !ins.data) { console.error(ins.error); continue; }
    const media: Media = { id: ins.data.id, name: ins.data.name, type, url, storagePath: path, createdAt: Date.now(), sizeBytes: file.size };
    out.push(media);
    if (!state.media.find((m) => m.id === media.id)) { state.media.unshift(media); emit(); }
  }
  return { added: out, blocked: false, attemptedBytes };
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
  if (patch.showTicker !== undefined) dbPatch.show_ticker = patch.showTicker;
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

// ====== Ticker messages ======
export async function createTickerMessage(patch: Partial<TickerMessage> & { text: string }) {
  const orderIndex = (state.tickerMessages.reduce((m, x) => Math.max(m, x.orderIndex), 0) ?? 0) + 1;
  const row: any = {
    text: patch.text,
    label: patch.label ?? "AVISO",
    color: patch.color ?? "#dc2626",
    priority: patch.priority ?? false,
    active: patch.active ?? true,
    order_index: patch.orderIndex ?? orderIndex,
    starts_at: patch.startsAt ? new Date(patch.startsAt).toISOString() : null,
    ends_at: patch.endsAt ? new Date(patch.endsAt).toISOString() : null,
    terminal_ids: patch.terminalIds ?? [],
  };
  const ins = await supabase.from("ticker_messages").insert(row).select().single();
  if (ins.error) console.error(ins.error);
  return ins.data?.id ?? null;
}

export async function updateTickerMessage(id: string, patch: Partial<TickerMessage>) {
  const db: any = {};
  if (patch.text !== undefined) db.text = patch.text;
  if (patch.label !== undefined) db.label = patch.label;
  if (patch.color !== undefined) db.color = patch.color;
  if (patch.priority !== undefined) db.priority = patch.priority;
  if (patch.active !== undefined) db.active = patch.active;
  if (patch.orderIndex !== undefined) db.order_index = patch.orderIndex;
  if (patch.startsAt !== undefined) db.starts_at = patch.startsAt ? new Date(patch.startsAt).toISOString() : null;
  if (patch.endsAt !== undefined) db.ends_at = patch.endsAt ? new Date(patch.endsAt).toISOString() : null;
  if (patch.terminalIds !== undefined) db.terminal_ids = patch.terminalIds;
  await supabase.from("ticker_messages").update(db).eq("id", id);
}

export async function deleteTickerMessage(id: string) {
  await supabase.from("ticker_messages").delete().eq("id", id);
}

export async function reorderTickerMessages(orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, i) => updateTickerMessage(id, { orderIndex: i })));
}