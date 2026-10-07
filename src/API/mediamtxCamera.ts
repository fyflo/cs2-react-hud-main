// MediaMTX-based camera source (WHEP) for a given SteamID.
//
// Assumption used by default:
// - VDO.Ninja streamId == SteamID (digits are allowed), so MediaMTX path is `vdo/<steamid>`.
// - WHEP endpoint becomes: http://localhost:8889/vdo/<steamid>/whep
//
// You can override via Vite envs:
// - VITE_VDO_BIND_API
//     If set, HUD will query this registry to resolve SteamID -> WHEP URL.
//     Expected endpoint: {VITE_VDO_BIND_API}/api/steamid/<steamid>
//     Expected response JSON: { "mediamtxWhepUrl": "http://.../whep" }
//
// - VITE_MEDIAMTX_HTTP_BASE (default http://localhost:8889)
// - VITE_MEDIAMTX_WHEP_TEMPLATE (default /vdo/{id}/whep)
//     Used when VITE_VDO_BIND_API is NOT set.
//
// - VITE_MEDIAMTX_STREAMID_OVERRIDES
//     Optional SteamID -> streamId mapping list (comma/space/semicolon separated).
//     Format per entry: <steamid>:<streamId>
//     Example: 76561198160486877:_mediamtx_vdo_test
//
// - VITE_MEDIAMTX_CAMERA_STEAMIDS (comma/space/semicolon separated list)

const DEFAULT_ENABLED = "76561198160486877";

function isDigits(v: string) {
  return /^\d+$/.test(String(v));
}

function splitList(v: string | undefined | null) {
  return String(v || "")
    .split(/[;,\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseOverrides(v: string | undefined | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const entry of splitList(v)) {
    const idx = entry.indexOf(":");
    if (idx <= 0) continue;
    const key = entry.slice(0, idx).trim();
    const val = entry.slice(idx + 1).trim();
    if (!key || !val) continue;
    m.set(String(key), String(val));
  }
  return m;
}

function buildDirectWhepUrlForSteamid(steamid: string): string {
  // NOTE: despite the name, the input can be either:
  // - a SteamID64 (digits)
  // - or an arbitrary streamId (like "_mediamtx_vdo_test")
  // If it's a SteamID64, allow overrides SteamID -> streamId.
  const overrides = parseOverrides(import.meta.env.VITE_MEDIAMTX_STREAMID_OVERRIDES);
  const id = isDigits(steamid) ? overrides.get(String(steamid)) || String(steamid) : String(steamid);

  const httpBase = String(import.meta.env.VITE_MEDIAMTX_HTTP_BASE || "http://localhost:8889").replace(/\/$/, "");
  const template = String(import.meta.env.VITE_MEDIAMTX_WHEP_TEMPLATE || "/vdo/{id}/whep");
  const path = template.replace("{id}", encodeURIComponent(id));
  return `${httpBase}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function getMediaMTXWhepUrlForSteamid(steamid: string): string | null {
  const enabled = splitList(import.meta.env.VITE_MEDIAMTX_CAMERA_STEAMIDS || DEFAULT_ENABLED);
  const key = String(steamid);
  if (enabled.length > 0 && !(enabled.includes("*") || enabled.includes(key))) return null;

  // Preferred: ask relay registry (link-service) for the bound WHEP URL.
  // This allows players to use arbitrary VDO tokens, while HUD still references SteamID.
  const bindApi = String(import.meta.env.VITE_VDO_BIND_API || "").trim();
  // bind-api typically expects digits-only SteamID64.
  // If HUD is configured with a non-digit id (for example, a raw MediaMTX path name),
  // skip bind-api and go direct.
  if (bindApi && isDigits(key)) {
    const base = bindApi.replace(/\/$/, "");
    return `${base}/api/steamid/${encodeURIComponent(String(steamid))}`;
  }

  // Fallback: build direct MediaMTX WHEP url.
  return buildDirectWhepUrlForSteamid(steamid);
}

export async function resolveMediaMTXWhepUrlForSteamid(steamid: string): Promise<string | null> {
  const endpoint = getMediaMTXWhepUrlForSteamid(steamid);
  if (!endpoint) return null;

  // If endpoint already looks like a WHEP URL, return it.
  if (/\/whep$/i.test(endpoint) && (endpoint.startsWith("http://") || endpoint.startsWith("https://"))) {
    return endpoint;
  }

  // Otherwise it is the bind-API endpoint returning JSON with mediamtxWhepUrl.
  try {
    // add a cache buster, in case a proxy is caching 404s
    const u = new URL(endpoint);
    u.searchParams.set("_", String(Date.now()));
    const res = await fetch(u.toString(), { method: "GET" });
    if (!res.ok) {
      // Bind-api can be disabled/misconfigured (common reason: 405 Method Not Allowed).
      // In that case, try direct WHEP URL as a fallback.
      // eslint-disable-next-line no-console
      console.warn(`[camera] bind-api resolve failed for ${steamid}: HTTP ${res.status}. Falling back to direct WHEP url.`);
      return buildDirectWhepUrlForSteamid(steamid);
    }
    const json = (await res.json()) as any;
    const url =
      (typeof json?.mediamtxWhepUrl === "string" && json.mediamtxWhepUrl) ||
      (typeof json?.whepUrl === "string" && json.whepUrl) ||
      null;
    return url;
  } catch {
    return buildDirectWhepUrlForSteamid(steamid);
  }
}
