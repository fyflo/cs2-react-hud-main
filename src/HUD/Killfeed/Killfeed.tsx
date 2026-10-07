import React, { useEffect, useRef, useState } from "react";

import { KillEvent, Player } from "csgogsi";
import Kill from "./Kill";
import "./killfeed.scss";
import { onGSI } from "../../API/contexts/actions";

export interface ExtendedKillEvent extends KillEvent {
  type: "kill";
}

export interface BombEvent {
  player: Player;
  type: "plant" | "defuse";
}

const Killfeed = () => {
  const [events, setEvents] = useState<
    (BombEvent | (ExtendedKillEvent & any))[]
  >([]);
  const lastMapRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const DEDUP_WINDOW_MS = 800;
  const getIds = (e: any) => {
    const killerId = String((e?.killer?.steamid || "") as string);
    const victimId = String((e?.victim?.steamid || "") as string);
    const assisterId = String((e?.assister?.steamid || "") as string);
    return { killerId, victimId, assisterId };
  };
  const isSameKill = (a: any, b: any) => {
    if (!a || !b) return false;
    if (a.type !== "kill" || b.type !== "kill") return false;
    const A = getIds(a);
    const B = getIds(b);
    if (!A.victimId || !B.victimId) return false;
    if (A.victimId !== B.victimId) return false;
    const killersMatch =
      A.killerId === B.killerId || !A.killerId || !B.killerId;
    if (!killersMatch) return false;
    const aw = String((a?.weapon || "") as string);
    const bw = String((b?.weapon || "") as string);
    return aw === bw || !aw || !bw;
  };
  const mergeKill = (base: any, extra: any) => {
    const merged: any = { ...base };
    const fields = [
      "weapon",
      "headshot",
      "thrusmoke",
      "noscope",
      "attackerblind",
      "flashed",
      "wallbang",
    ];
    for (const f of fields) {
      if (merged[f] == null && extra[f] != null) merged[f] = extra[f];
      if (typeof extra[f] === "boolean" && extra[f]) merged[f] = true;
    }
    if (!merged.killer && extra.killer) merged.killer = extra.killer;
    if (!merged.assister && extra.assister) merged.assister = extra.assister;
    if (!merged.victim && extra.victim) merged.victim = extra.victim;
    merged._ts = Math.max(base?._ts || 0, extra?._ts || 0, Date.now());
    return merged;
  };
  // GSI kills
  onGSI(
    "kill",
    (kill) => {
      setEvents((prev) => {
        const now = Date.now();
        const hasKiller = Boolean((kill as any)?.killer?.steamid);
        const incoming: any = {
          ...kill,
          type: "kill",
          _src: "gsi",
          _ts: now,
          _pendingUntil: hasKiller ? 0 : now + 20,
        };
        for (let i = prev.length - 1; i >= 0 && i >= prev.length - 10; i--) {
          const e: any = prev[i];
          if (
            e &&
            now - (e._ts || 0) < DEDUP_WINDOW_MS &&
            isSameKill(e, incoming)
          ) {
            const merged = mergeKill(e, incoming);
            const next = [...prev];
            next[i] = merged;
            return next;
          }
        }
        return [...prev, incoming];
      });
      // force a quick refresh to lift pending if MIRV already arrived
      try {
        setTimeout(() => setEvents((ev) => [...ev]), 25);
      } catch {}
    },
    []
  );
  // MIRV (enriched) — используем данные от релея напрямую
  useEffect(() => {
    const handler = (ev: any) => {
      const data = ev && ev.detail ? ev.detail : null;
      if (!data) return;
      const sig = [
        String((data as any)?.killer?.steamid || ""),
        String((data as any)?.victim?.steamid || ""),
        String((data as any)?.assister?.steamid || ""),
        String((data as any)?.clientTime || ""),
      ].join("|");
      setEvents((prev) => {
        const now = Date.now();
        // upsert по sig в окне 300мс
        for (let i = prev.length - 1; i >= 0 && i >= prev.length - 10; i--) {
          const e: any = prev[i];
          if (e && e._sig === sig && now - (e._ts || 0) < 300) {
            const merged: any = { ...e };
            const fieldsToCopy = [
              "weapon",
              "headshot",
              "thrusmoke",
              "noscope",
              "attackerblind",
              "flashed",
              "wallbang",
              "killer",
              "victim",
              "assister",
              "_players",
              "_players_ordered",
              "_players_orderedMeta",
            ];
            for (const f of fieldsToCopy) {
              if ((data as any)[f] !== undefined)
                (merged as any)[f] = (data as any)[f];
            }
            merged._ts = now;
            const next = [...prev];
            next[i] = merged;
            return next;
          }
        }
        // дедупликация с уже пришедшими событиями (в т.ч. от GSI)
        const candidate: any = {
          ...data,
          type: "kill",
          _src: "mirv",
          _ts: now,
        };
        for (let i = prev.length - 1; i >= 0 && i >= prev.length - 10; i--) {
          const e: any = prev[i];
          if (
            e &&
            now - (e._ts || 0) < DEDUP_WINDOW_MS &&
            isSameKill(e, candidate)
          ) {
            const merged = mergeKill(e, candidate);
            const next = [...prev];
            next[i] = merged;
            return next;
          }
        }
        return [...prev, { ...candidate, _sig: sig }];
      });
    };
    window.addEventListener("mirv_kill", handler as any);
    return () => window.removeEventListener("mirv_kill", handler as any);
  }, []);
  onGSI(
    "data",
    (data) => {
      // Очистка при смене карты
      const currentMap: string | null = data?.map?.name || null;
      if (currentMap && currentMap !== lastMapRef.current) {
        lastMapRef.current = currentMap;
        setEvents([]);
        return;
      }
      // Очистка при входе в фризтайм (начало нового раунда)
      const phase: string | null = data?.round?.phase || null;
      if (phase !== lastPhaseRef.current) {
        if (phase === "freezetime") {
          setEvents([]);
        }
        lastPhaseRef.current = phase;
      }
    },
    []
  );
  return (
    <div className="killfeed">
      {events
        .filter((e: any) => {
          if (!e || e.type !== "kill") return true;
          const ready = !e._pendingUntil || Date.now() >= e._pendingUntil;
          const hasKiller = Boolean(e?.killer);
          return !e._pendingUntil ? hasKiller : ready && hasKiller;
        })
        .map((event, idx) => (
          <Kill key={idx} event={event} />
        ))}
    </div>
  );
};

export default React.memo(Killfeed);
