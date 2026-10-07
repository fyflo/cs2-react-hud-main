import * as I from "csgogsi";
import { Match } from "../../API/types";

interface Props {
  map: I.Map;
  match: Match | null;
}

const SeriesBox = ({ map, match }: Props) => {
  const amountOfMaps =
    (match && Math.floor(Number(match.matchType.substr(-1)) / 2) + 1) || 0;
  const bo = (match && Number(match.matchType.substr(-1))) || 0;
  // Принудительно: CT слева, T справа + счёт серии из match.left/right
  const left = (() => {
    const out: any = { ...map.team_ct, orientation: "left" };
    const m = match as any;
    if (m?.left?.name) out.name = m.left.name;
    if (m?.left?.id) {
      out.id = m.left.id;
      out._id = m.left.id;
      out.logo = true;
    }
    if (typeof m?.left?.wins === "number")
      out.matches_won_this_series = m.left.wins;
    return out;
  })();
  const right = (() => {
    const out: any = { ...map.team_t, orientation: "right" };
    const m = match as any;
    if (m?.right?.name) out.name = m.right.name;
    if (m?.right?.id) {
      out.id = m.right.id;
      out._id = m.right.id;
      out.logo = true;
    }
    if (typeof m?.right?.wins === "number")
      out.matches_won_this_series = m.right.wins;
    return out;
  })();
  return (
    <div id="encapsulator">
      <div className="container left">
        <div className={`series_wins left `}>
          <div className={`wins_box_container`}>
            {new Array(amountOfMaps).fill(0).map((_, i) => (
              <div
                key={i}
                className={`wins_box ${
                  left.matches_won_this_series > i ? "win" : ""
                } ${left.side}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div id="series_container">
        <div id="series_text">{bo ? `BEST OF ${bo}` : ""}</div>
      </div>
      <div className="container right">
        <div className={`series_wins right `}>
          <div className={`wins_box_container`}>
            {new Array(amountOfMaps).fill(0).map((_, i) => (
              <div
                key={i}
                className={`wins_box ${
                  right.matches_won_this_series > i ? "win" : ""
                } ${right.side}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeriesBox;
