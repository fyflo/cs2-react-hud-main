import { Map, CSGO } from "csgogsi";
import { Match } from "../../API/types";

interface IProps {
  phase: CSGO["phase_countdowns"] | null;
  map: Map;
  match: Match | null;
}

const Timeout = ({ phase, map, match }: IProps) => {
  const time = phase && Math.abs(Math.ceil(phase.phase_ends_in));
  const isTTimeout = phase && phase.phase === "timeout_t";
  // Определяем сторону, затем подмешиваем бренд из активного матча
  const baseTeam = isTTimeout ? map.team_t : map.team_ct;
  const branded = (() => {
    const m: any = match as any;
    const out: any = { ...(baseTeam as any) };
    if (isTTimeout) {
      // T сторона — match.right
      if (m?.right?.name) out.name = m.right.name;
      if (m?.right?.id) {
        out.id = m.right.id;
        out._id = m.right.id;
        out.logo = true;
      }
      out.side = "T";
    } else {
      // CT сторона — match.left
      if (m?.left?.name) out.name = m.left.name;
      if (m?.left?.id) {
        out.id = m.left.id;
        out._id = m.left.id;
        out.logo = true;
      }
      out.side = "CT";
    }
    return out;
  })();
  // Цвет по стороне
  const sideClass =
    (branded?.side || branded?.orientation) === "CT" ? "ct" : "t";

  return (
    <div
      id={`timeout`}
      className={`${
        time &&
        time > 2 &&
        phase &&
        (phase.phase === "timeout_t" || phase.phase === "timeout_ct")
          ? "show"
          : ""
      } ${sideClass}`}
    >
      {branded?.name || baseTeam?.name} TIMEOUT
    </div>
  );
};
export default Timeout;
