import Host from "./pages/Host";
import Join from "./pages/Join";
import Control from "./pages/Control";
import Results from "./pages/Results";
import Home from "./pages/Home";
import ReadmePage from "./components/Readme";

// A handful of screens, so a tiny path switch is all the routing we need.
//   /host…    the big screen (projector), display only
//   /control  the control phone that runs everything (/score still works)
//   /join     players
//   /results  everyone's results, after the podium
export default function App() {
  const path = location.pathname.replace(/\/$/, "");
  if (path === "/host" || path.startsWith("/host/")) return <Host />;
  if (path === "/control" || path === "/score") return <Control />;
  if (path === "/results") return <Results />;
  if (path === "/join") return <Join />;
  if (path === "/guide") return <ReadmePage />; // the README, phone-friendly
  return <Home />;
}
