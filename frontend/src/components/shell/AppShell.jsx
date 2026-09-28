import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import TitleBar from "./TitleBar.jsx";
import Sidebar from "./Sidebar.jsx";
import StatusBar from "./StatusBar.jsx";
import { useUiStore } from "../../stores/useUiStore.js";
import { useKonami } from "../../hooks/useKonami.js";

const RAIN_TOKENS = ["{}", "=>", ";", "()", "[]", "===", "JS", "?.", "??", "`${}`", "...", "&&"];

// The floating IDE window from the mockup. Every logged-in page renders inside.
const AppShell = ({ toolbar, children }) => {
  const { maximized } = useUiStore();
  const [rain, setRain] = useState(null);

  const onKonami = useCallback(() => {
    const drops = Array.from({ length: 42 }, (_, i) => ({
      id: i,
      token: RAIN_TOKENS[i % RAIN_TOKENS.length],
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      dur: 2.2 + Math.random() * 1.8,
      size: 12 + Math.random() * 14,
    }));
    setRain(drops);
    setTimeout(() => setRain(null), 4500);
    toast("Cheat unlocked. JavaScript took 10 days; you took 10 keys.", {
      icon: "🎮",
      id: "konami",
    });
  }, []);
  useKonami(onKonami);

  return (
    <div
      className={`h-[100dvh] flex transition-[padding] duration-300 ${maximized ? "p-0" : "p-0 md:p-5 lg:p-8"}`}
    >
      <div
        className={`ide-window relative flex flex-col w-full h-full overflow-hidden mx-auto transition-[border-radius,max-width] duration-300 ${
          maximized ? "rounded-none max-w-none" : "md:rounded-xl max-w-[1500px]"
        }`}
      >
        <TitleBar />
        <div className="flex flex-1 min-h-0 relative">
          <Sidebar />
          <main className="flex-1 min-w-0 flex flex-col">
            {toolbar}
            <div className="flex-1 overflow-y-auto ide-scroll">{children}</div>
          </main>
        </div>
        <StatusBar />
      </div>

      {rain && (
        <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
          {rain.map((d) => (
            <span
              key={d.id}
              className="absolute top-[-40px] font-bold"
              style={{
                left: `${d.left}%`,
                fontSize: d.size,
                color: d.id % 3 === 0 ? "var(--js)" : d.id % 3 === 1 ? "var(--kw)" : "var(--fn)",
                animation: `code-rain ${d.dur}s linear ${d.delay}s forwards`,
              }}
            >
              {d.token}
            </span>
          ))}
          <style>{`@keyframes code-rain { to { transform: translateY(110vh) rotate(25deg); opacity: .2; } }`}</style>
        </div>
      )}
    </div>
  );
};

export default AppShell;
