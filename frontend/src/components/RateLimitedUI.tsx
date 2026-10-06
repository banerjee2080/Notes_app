import { useCopy } from "../lib/voice";

const RateLimitedUI = () => {
  const { t } = useCopy();
  return (
    <div className="w-full max-w-3xl mx-auto mt-6 px-4">
      <div className="ide-note is-warn">
        <div className="tok-warn font-semibold">
          {t({
            js: "RangeError: Too many requests (429)",
            common: "Too many requests",
            pythagoras: "Too many constructions at once",
          })}
        </div>
        <div className="tok-com">
          {t({
            js: "// Slow down a little — await new Promise(r => setTimeout(r, 1000));",
            common: "Please wait a moment, then try again.",
            pythagoras: "Rest the compass a moment, then continue.",
          })}
        </div>
      </div>
    </div>
  );
};

export default RateLimitedUI;
