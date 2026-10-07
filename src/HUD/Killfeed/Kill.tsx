import React from "react";
import Weapon from "./../Weapon/Weapon";
import flash_assist from "./../../assets/flash_assist.png";
import {
  C4,
  Defuse,
  FlashedKill,
  Headshot,
  NoScope,
  SmokeKill,
  Suicide,
  Wallbang,
} from "./../../assets/Icons";
import { ExtendedKillEvent, BombEvent } from "./Killfeed";
import { GSI } from "../../API/HUD";

const Kill = ({ event }: { event: ExtendedKillEvent | BombEvent }) => {
  if (event.type !== "kill") {
    return (
      <div className={`single_kill`}>
        <div className={`killer_name ${event.player.team.side}`}>
          {event.player.name}
        </div>
        <div className="way">
          {event.type === "plant" ? (
            <C4 height="18px" />
          ) : (
            <Defuse height="18px" />
          )}
        </div>
        <div className={`victim_name`}>
          {event.type === "plant" ? "planted the bomb" : "defused the bomb"}
        </div>
      </div>
    );
  }
  let weapon = <Weapon weapon={event.weapon} active={false} />;
  const isSuicide =
    !!(event as any).killer &&
    !!(event as any).victim &&
    ((event as any).killer === (event as any).victim ||
      (event as any).killer?.steamid === (event as any).victim?.steamid);
  if (isSuicide) {
    weapon = <Suicide />;
  } else if (event.weapon === "planted_c4") {
    weapon = <Weapon weapon={"c4"} active={false} />;
  }
  // Используем enriched поля события / GSI, без _mirv/keys
  const enrichedPlayers: any = (event as any)._players || null;
  const resolvePlayerSide = (steamid: string | null) => {
    try {
      if (!steamid) return null;
      const key = String(steamid);
      if (enrichedPlayers && enrichedPlayers[key])
        return enrichedPlayers[key]?.team?.side || null;
      if ((event as any).killer && (event as any).killer.steamid === steamid)
        return (event as any).killer.team?.side || null;
      if ((event as any).victim && (event as any).victim.steamid === steamid)
        return (event as any).victim.team?.side || null;
    } catch {}
    return null;
  };
  const short = (s: string) => (s ? s.slice(-6) : "");
  const getSideFromGSI = (steamid?: string | null, name?: string | null) => {
    try {
      const all: any = (GSI as any)?.last?.allplayers || {};
      const key = steamid ? String(steamid) : "";
      if (key && all[key] && (all[key].team?.side || all[key].team)) {
        return all[key].team?.side || all[key].team || null;
      }
      if (name) {
        const n = String(name);
        for (const pid of Object.keys(all)) {
          const p = all[pid];
          if (p?.name === n || p?.defaultName === n) {
            return p.team?.side || p.team || null;
          }
        }
      }
    } catch {}
    return null;
  };
  const victimSideFromEvent = (event as any)?.victim?.team?.side || null;
  const killerSideFromEvent = (event as any)?.killer?.team?.side || null;
  const victimSide =
    victimSideFromEvent ||
    resolvePlayerSide((event as any)?.victim?.steamid || null) ||
    getSideFromGSI(
      (event as any)?.victim?.steamid,
      (event as any)?.victim?.name
    );
  const killerSide =
    killerSideFromEvent ||
    resolvePlayerSide((event as any)?.killer?.steamid || null) ||
    getSideFromGSI(
      (event as any)?.killer?.steamid,
      (event as any)?.killer?.name
    );
  return (
    <div className="single_kill_container">
      <div className={`single_kill`}>
        {event.attackerblind ? <FlashedKill /> : null}
        {(event as any).killer ? (
          <div
            className={`killer_name ${
              (event as any).killer.team?.side ||
              resolvePlayerSide((event as any).killer?.steamid || null) ||
              killerSide ||
              getSideFromGSI(
                (event as any).killer?.steamid,
                (event as any).killer?.name
              ) ||
              ""
            }`}
          >
            {(function () {
              try {
                const sid = String((event as any).killer?.steamid || "");
                const ext = (GSI as any)?.players?.find(
                  (x: any) => String(x?.steamid) === sid
                );
                const dbName = ext?.name && String(ext.name).trim();
                return dbName || (event as any).killer.name;
              } catch {
                return (event as any).killer.name;
              }
            })()}
          </div>
        ) : null}
        {(event as any).assister ? (
          <React.Fragment>
            <div className="plus">+</div>
            {event.flashed ? (
              <img
                src={flash_assist}
                className="flash_assist"
                alt={"[FLASH]"}
              />
            ) : null}
            <div
              className={`assister_name ${
                (event as any).assister.team?.side ||
                resolvePlayerSide((event as any).assister?.steamid || null) ||
                getSideFromGSI(
                  (event as any).assister?.steamid,
                  (event as any).assister?.name
                ) ||
                killerSide ||
                ""
              }`}
            >
              {(function () {
                try {
                  const sid = String((event as any).assister?.steamid || "");
                  const ext = (GSI as any)?.players?.find(
                    (x: any) => String(x?.steamid) === sid
                  );
                  const dbName = ext?.name && String(ext.name).trim();
                  return dbName || (event as any).assister.name;
                } catch {
                  return (event as any).assister.name;
                }
              })()}
            </div>
          </React.Fragment>
        ) : (
          ""
        )}
        <div className="way">
          {weapon}
          {event.thrusmoke ? <SmokeKill /> : null}
          {event.noscope ? <NoScope /> : null}
          {event.wallbang ? <Wallbang /> : null}
          {event.headshot ? <Headshot /> : null}
        </div>
        <div
          className={`victim_name ${
            (event as any)?.victim?.team?.side ||
            resolvePlayerSide((event as any)?.victim?.steamid || null) ||
            victimSide ||
            getSideFromGSI(
              (event as any)?.victim?.steamid,
              (event as any)?.victim?.name
            ) ||
            ""
          }`}
        >
          {(function () {
            const fallback = (event as any)?.victim?.name || "";
            try {
              const sid = String((event as any)?.victim?.steamid || "");
              const ext = (GSI as any)?.players?.find(
                (x: any) => String(x?.steamid) === sid
              );
              const dbName = ext?.name && String(ext.name).trim();
              return dbName || fallback;
            } catch {
              return fallback;
            }
          })()}
        </div>
      </div>
    </div>
  );
};
export default Kill;
