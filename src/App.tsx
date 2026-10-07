import { useEffect, useState } from "react";
import "./App.css";
import './HUD/hudc/overrides.scss';
import { CSGO } from "csgogsi";
import { SettingsProvider, onGSI } from "./API/contexts/actions";
import Layout from "./HUD/Layout/Layout";
import "./API/socket";
import { Match } from "./API/types";
import api from "./API";
import { GSI } from "./API/HUD";
import { socket } from "./API/socket";

function App() {
  const [game, setGame] = useState<CSGO | null>(null);
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    const onMatchPing = () => {
      api.match
        .getCurrent()
        .then((match) => {
          if (!match) {
            setMatch(null);
            return;
          }
          setMatch(match);
        })
        .catch(() => {
          setMatch(null);
        });
    };
    socket.on("match", onMatchPing);
    onMatchPing();

    return () => {
      socket.off("match", onMatchPing);
    };
  }, []);

  onGSI(
    "data",
    (game) => {
      setGame(game);
    },
    []
  );

  if (!game) return null;
  return (
    <SettingsProvider>
      <Layout game={game} match={match} />
    </SettingsProvider>
  );
}

export default App;
