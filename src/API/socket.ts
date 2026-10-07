import { io } from "socket.io-client";
import { isDev, port } from ".";
import { GSI, hudIdentity } from "./HUD";
import { CSGORaw } from "csgogsi";
import { actions, configs } from "./contexts/actions";
import { initiateConnection } from "./HUD/camera";

export const socket = io(isDev ? `localhost:${port}` : "/");

type RoundPlayerDamage = {
  steamid: string;
  damage: number;
};
type RoundDamage = {
  round: number;
  players: RoundPlayerDamage[];
};

socket.on("update", (data: any, damage: any) => {
  if (damage) {
    GSI.damage = damage;
  }
  GSI.digest(data);
});

const isInWindow = !!window.parent.ipcApi;

if (isInWindow) {
  window.parent.ipcApi.receive(
    "raw",
    (data: CSGORaw, damage?: RoundDamage[]) => {
      if (damage) {
        GSI.damage = damage;
      }
      GSI.digest(data);
    }
  );
}

const href = window.location.href;

socket.emit("started");

if (isDev) {
  hudIdentity.name = (Math.random() * 1000 + 1)
    .toString(36)
    .replace(/[^a-z]+/g, "")
    .substr(0, 15);
  hudIdentity.isDev = true;
} else {
  const segment = href.substr(href.indexOf("/huds/") + 6);
  hudIdentity.name = segment.substr(0, segment.lastIndexOf("/"));
}

socket.on("readyToRegister", () => {
  socket.emit(
    "register",
    hudIdentity.name,
    isDev,
    "cs2",
    isInWindow ? "IPC" : "DEFAULT"
  );
  initiateConnection();
});
socket.on(`hud_config`, (data: any) => {
  configs.save(data);
});
socket.on(`hud_action`, (data: any) => {
  actions.execute(data.action, data.data);
});
socket.on("keybindAction", (action: string) => {
  actions.execute(action);
});

socket.on("refreshHUD", () => {
  window.top?.location.reload();
});

// Normalize MIRV payloads and dispatch to HUD
const normalizeMirv = (data: any) => {
  if (!data || typeof data !== "object") return null;
  const name = data.name || "player_death";
  const keys: any = data.keys || {};
  const wrap = (v: any) => {
    if (
      v &&
      typeof v === "object" &&
      ("xuid" in v || "value" in v || "name" in v)
    ) {
      const xuid = String((v as any).xuid ?? (v as any).value ?? "0");
      const value = Number((v as any).value ?? (v as any).xuid ?? 0);
      const name =
        typeof (v as any).name === "string" ? (v as any).name : undefined;
      return name !== undefined ? { xuid, value, name } : { xuid, value };
    }
    return { xuid: String(v ?? "0"), value: Number(v ?? 0) };
  };
  const out = {
    name,
    clientTime:
      typeof data.clientTime === "number" ? data.clientTime : Date.now() / 1000,
    keys: {
      ...keys,
      userid: wrap(keys.userid),
      attacker: wrap(keys.attacker),
      assister: wrap(keys.assister ?? 0),
    },
  };
  // Preserve relay-enriched fields
  try {
    const anyOut: any = out;
    if (data && typeof data === "object") {
      if ((data as any)._players) anyOut._players = (data as any)._players;
      if ((data as any)._players_ordered)
        anyOut._players_ordered = (data as any)._players_ordered;
      if ((data as any)._players_orderedMeta)
        anyOut._players_orderedMeta = (data as any)._players_orderedMeta;
      if ((data as any).killer) anyOut.killer = (data as any).killer;
      if ((data as any).victim) anyOut.victim = (data as any).victim;
      if ((data as any).assister) anyOut.assister = (data as any).assister;
      // Lift killfeed fields (weapon/flags) to top-level for HUD
      if (typeof (data as any).weapon === "string")
        anyOut.weapon = String((data as any).weapon);
      if ("headshot" in (data as any))
        anyOut.headshot = Boolean((data as any).headshot);
      if ("thrusmoke" in (data as any))
        anyOut.thrusmoke = Boolean((data as any).thrusmoke);
      if ("noscope" in (data as any))
        anyOut.noscope = Boolean((data as any).noscope);
      if ("attackerblind" in (data as any))
        anyOut.attackerblind = Boolean((data as any).attackerblind);
      if ("flashed" in (data as any))
        anyOut.flashed = Boolean((data as any).flashed);
      if ("wallbang" in (data as any))
        anyOut.wallbang = Boolean((data as any).wallbang);
    }
  } catch {}
  // Не отбрасываем по keys: релей уже обогатил событие killer/victim/assister
  return out;
};

const handleMirv = (data: any) => {
  const norm = normalizeMirv(data);
  if (!norm) return;
  // Do not early-return by keys; rely on enriched payload
  GSI.digestMIRV(norm as any);
  try {
    window.dispatchEvent(new CustomEvent("mirv_kill", { detail: norm }));
  } catch {}
};

socket.on("update_mirv", handleMirv);
socket.on("mirv", handleMirv);
