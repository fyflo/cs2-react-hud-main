import React, { useEffect, useState } from "react";
import { Player } from "csgogsi";
import Weapon from "./../Weapon/Weapon";
import Avatar from "./Avatar";
import TeamLogo from "./../MatchBar/TeamLogo";
import "./observed.scss";
import { getCountry } from "./../countries";
import {
  ArmorHelmet,
  ArmorFull,
  HealthFull,
  Bullets,
} from "./../../assets/Icons";
import { apiUrl } from "./../../API";
import { Match } from "../../API/types";
import { resolveDirectCameraUrl } from "../../API/directCamera";

// How often the HUD re-checks the API for the observed player's camera signal.
const CAMERA_STATUS_REFRESH_MS = 2000;

const Statistic = React.memo(
  ({ label, value }: { label: string; value: string | number }) => {
    return (
      <div className="stat">
        <div className="label">{label}</div>
        <div className="value">{value}</div>
      </div>
    );
  }
);

const Observed = ({
  player,
  match,
}: {
  player: Player | null;
  match: Match | null;
}) => {
  // Camera visibility is driven by the API signal: the feed is shown only when
  // the API reports a live/active camera for the observed player (active:true /
  // status:live -> resolveDirectCameraUrl().enabled === true). No manual toggle.
  const [showCam, setShowCam] = useState(false);

  useEffect(() => {
    if (!player) {
      setShowCam(false);
      return;
    }

    let mounted = true;
    const steamid = player.steamid;

    const refreshCamera = () => {
      resolveDirectCameraUrl(steamid)
        .then((result) => {
          if (!mounted) return;
          setShowCam(Boolean(result.enabled));
        })
        .catch(() => {
          if (!mounted) return;
          setShowCam(false);
        });
    };

    refreshCamera();
    const timer = window.setInterval(refreshCamera, CAMERA_STATUS_REFRESH_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [player?.steamid]);

  if (!player) return null;

  // ÐŸÐ¾Ð´Ð¼ÐµÑˆÐ¸Ð²Ð°ÐµÐ¼ Ð±Ñ€ÐµÐ½Ð´ ÐºÐ¾Ð¼Ð°Ð½Ð´Ñ‹ Ð¸Ð· Ð°ÐºÑ‚Ð¸Ð²Ð½Ð¾Ð³Ð¾ Ð¼Ð°Ñ‚Ñ‡Ð° Ð¿Ð¾ ÑÑ‚Ð¾Ñ€Ð¾Ð½Ðµ Ð¸Ð³Ñ€Ð¾ÐºÐ°, Ñ‡Ñ‚Ð¾Ð±Ñ‹ TeamLogo Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ð» ÐºÐ¾Ñ€Ñ€ÐµÐºÑ‚Ð½Ñ‹Ð¹ id/logo
  const effectiveTeam = (() => {
    const base: any = { ...(player.team as any) };
    const side = base.side;
    const m: any = match as any;
    if (side === "CT" && m?.left) {
      if (m.left.name) base.name = m.left.name;
      if (m.left.id) {
        base.id = m.left.id;
        base._id = m.left.id;
        base.logo = true;
      }
    }
    if (side === "T" && m?.right) {
      if (m.right.name) base.name = m.right.name;
      if (m.right.id) {
        base.id = m.right.id;
        base._id = m.right.id;
        base.logo = true;
      }
    }
    return base;
  })();

  const country = player.country || effectiveTeam.country;
  const currentWeapon = player.weapons.filter(
    (weapon) => weapon.state === "active"
  )[0];
  const grenades = player.weapons.filter((weapon) => weapon.type === "Grenade");
  const { stats } = player;
  const ratio = stats.deaths === 0 ? stats.kills : stats.kills / stats.deaths;
  const countryName = country ? getCountry(country) : null;
  return (
    <div className={`observed ${player.team.side}`}>
      <div className="main_row">
        <Avatar
          teamId={(effectiveTeam as any).id}
          url={player.avatar}
          steamid={player.steamid}
          height={140}
          width={140}
          showCam={showCam}
          slot={player.observer_slot}
        />
        <TeamLogo team={effectiveTeam} height={35} width={35} />
        <div className="username_container">
          <div className="username">{player.name}</div>
          <div className="real_name">{player.realName}</div>
        </div>
        <div className="flag">
          {countryName ? (
            <img
              src={`${apiUrl}files/img/flags/${countryName.replace(
                / /g,
                "-"
              )}.png`}
              alt={countryName}
            />
          ) : (
            ""
          )}
        </div>
        <div className="grenade_container">
          {grenades.map((grenade) => (
            <React.Fragment
              key={`${player.steamid}_${grenade.name}_${
                grenade.ammo_reserve || 1
              }`}
            >
              <Weapon
                weapon={grenade.name}
                active={grenade.state === "active"}
                isGrenade
              />
              {grenade.ammo_reserve === 2 ? (
                <Weapon
                  weapon={grenade.name}
                  active={grenade.state === "active"}
                  isGrenade
                />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="stats_row">
        <div className="health_armor_container">
          <div className="health-icon icon">
            <HealthFull />
          </div>
          <div className="health text">{player.state.health}</div>
          <div className="armor-icon icon">
            {player.state.helmet ? <ArmorHelmet /> : <ArmorFull />}
          </div>
          <div className="health text">{player.state.armor}</div>
        </div>
        <div className="statistics">
          <Statistic label={"K"} value={stats.kills} />
          <Statistic label={"A"} value={stats.assists} />
          <Statistic label={"D"} value={stats.deaths} />
          <Statistic label={"K/D"} value={ratio.toFixed(2)} />
        </div>
        <div className="ammo">
          <div className="ammo_icon_container">
            <Bullets />
          </div>
          <div className="ammo_counter">
            <div className="ammo_clip">
              {(currentWeapon && currentWeapon.ammo_clip) || "-"}
            </div>
            <div className="ammo_reserve">
              /{(currentWeapon && currentWeapon.ammo_reserve) || "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Observed;