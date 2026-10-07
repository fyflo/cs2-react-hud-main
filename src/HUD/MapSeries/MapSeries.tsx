import * as I from "csgogsi";
import TeamLogo from "../MatchBar/TeamLogo";
import "./mapseries.scss";
import { Match, Veto } from "../../API/types";

interface IProps {
  match: Match | null;
  teams: I.Team[];
  isFreezetime: boolean;
  map: I.Map;
}

interface IVetoProps {
  veto: Veto;
  teams: I.Team[];
  active: boolean;
  match: Match | null;
}

const VetoEntry = ({ veto, teams, active, match }: IVetoProps) => {
  // Порядок счёта должен соответствовать порядку команд в teams: [left(CT), right(T)]
  const leftTeam = teams[0] as any;
  const rightTeam = teams[1] as any;
  // Цифры счёта НЕ должны свапаться при перестановке команд — используем left/right, а не id
  const vs = (veto.score as any) || null;
  // Счёт не должен свапаться. Приоритет чтения:
  // 1) Явные ключи left/right
  // 2) Если их нет — читаем первые два ключа объекта (порядок сохранён редактором реле: left, right)
  let leftScore: any = "-";
  let rightScore: any = "-";
  if (vs && typeof vs === "object") {
    if (
      Object.prototype.hasOwnProperty.call(vs, "left") ||
      Object.prototype.hasOwnProperty.call(vs, "right")
    ) {
      leftScore = (vs as any).left ?? "-";
      rightScore = (vs as any).right ?? "-";
    } else {
      const ks = Object.keys(vs);
      if (ks.length >= 2) {
        leftScore = (vs as any)[ks[0]];
        rightScore = (vs as any)[ks[1]];
      }
    }
  }
  // Надёжный поиск команд для TeamLogo: по id/_id, затем по стороне, затем по имени
  const findTeamByIdOrSide = (tid?: string) => {
    const byId = teams.find((t: any) => t && (t.id === tid || t._id === tid));
    if (byId) return byId;
    const side = (veto as any).side as any;
    if (side === "CT" || side === "T") {
      const bySide = teams.find((t: any) => t && t.side === side);
      if (bySide) return bySide;
    }
    return undefined as any;
  };
  const pickerTeam = findTeamByIdOrSide(veto.teamId);
  const winnerTeam = (() => {
    const byId = findTeamByIdOrSide((veto as any).winner);
    if (byId) return byId;
    const l = Number(leftScore), r = Number(rightScore);
    if (!isNaN(l) && !isNaN(r)) {
      return l > r ? teams[0] : l < r ? teams[1] : undefined as any;
    }
    return undefined as any;
  })();
  return (
    <div className={`veto_container ${active ? "active" : ""}`}>
      <div className="veto_map_name">{veto.mapName}</div>
      <div className="veto_picker">
        <TeamLogo team={pickerTeam} />
      </div>
      <div className="veto_winner">
        <TeamLogo team={winnerTeam} />
      </div>
      <div className="veto_score">{`${leftScore}:${rightScore}`}</div>
      <div className="active_container">
        <div className="active">Currently playing</div>
      </div>
    </div>
  );
};

const MapSeries = ({ match, teams, isFreezetime, map }: IProps) => {
  if (!match || !match.vetos || !match.vetos.length) return null;
  // Зафиксировать порядок и id команд на основе match.left/right, чтобы TeamLogo мог подтянуть лого по id
  const findTeamById = (id?: string | null) =>
    teams.find((t: any) => t && (t.id === id || (t as any)._id === id));
  const leftInit: any =
    findTeamById(match.left?.id) || teams.find((t: any) => t.side === "CT") || teams[0];
  const rightInit: any =
    findTeamById(match.right?.id) || teams.find((t: any) => t.side === "T") || teams[1];
  if (match.left?.id) {
    leftInit.id = (match.left as any).id;
    (leftInit as any)._id = (match.left as any).id;
    (leftInit as any).logo = true;
  }
  if (match.right?.id) {
    rightInit.id = (match.right as any).id;
    (rightInit as any)._id = (match.right as any).id;
    (rightInit as any).logo = true;
  }
  const enrichedTeams = [leftInit, rightInit] as any;
  return (
    <div className={`map_series_container ${isFreezetime ? "show" : "hide"}`}>
      <div className="title_bar">
        <div className="picked">Picked</div>
        <div className="winner">Winner</div>
        <div className="score">Score</div>
      </div>
      {match.vetos
        .filter((veto) => veto.type !== "ban")
        .map((veto) => {
          if (!veto.mapName) return null;
          return (
            <VetoEntry
              key={`${match.id}${veto.mapName}${veto.teamId}${veto.side}`}
              veto={veto}
              teams={enrichedTeams}
              active={map.name.includes(veto.mapName)}
              match={match}
            />
          );
        })}
    </div>
  );
};
export default MapSeries;
