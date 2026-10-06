import AppShell from "../components/shell/AppShell";
import Navbar from "../components/Navbar";
import { TIMELINE } from "../lib/jsLore";
import { COMMON_TIMELINE } from "../lib/commonLore";
import { PYTH_TIMELINE } from "../lib/pythagorasLore";
import { renderLatex, useKatex } from "../lib/math/katex";
import { useCopy } from "../lib/voice";

interface Entry {
  year: string;
  title: string;
  body: string;
  /** Under the body: JS code, a Common aside, or Pythagoras' formula. */
  foot: React.ReactNode;
}

// Each theme's history: JavaScript since 1995 (JS), writing things down
// (Common), and the theorem before and after Pythagoras (Pythagoras).
const HistoryPage = () => {
  const { theme, t } = useCopy();
  const katexReady = useKatex(theme === "pythagoras");

  const entries: Entry[] =
    theme === "js"
      ? TIMELINE.map((e) => ({
          ...e,
          foot: (
            <code className="mt-2 inline-block text-[12px] px-2 py-0.5 rounded bg-[var(--panel-2)] tok-str">{e.code}</code>
          ),
        }))
      : theme === "common"
        ? COMMON_TIMELINE.map((e) => ({
            ...e,
            foot: <p className="mt-2 text-[13px] italic tok-fn" style={{ fontFamily: "var(--font-content)" }}>{e.aside}</p>,
          }))
        : PYTH_TIMELINE.map((e) => {
            const html = katexReady ? renderLatex(e.latex, false) : null;
            return {
              ...e,
              foot: (
                <div className="mt-2 inline-block px-2.5 py-1 border ide-divider bg-[var(--panel-2)] text-[var(--fg)]">
                  {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <code className="text-[12px]">{e.latex}</code>}
                </div>
              ),
            };
          });

  return (
    <AppShell toolbar={<Navbar crumb={t({ js: "history.js", common: "History", pythagoras: "Chronology" })} />}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {theme === "js" ? (
          <>
            <p className="text-[13px] tok-com mb-1">{"/**"}</p>
            <p className="text-[13px] tok-com mb-1">{" * JavaScript, 1995 → today."}</p>
            <p className="text-[13px] tok-com mb-1">{" * Ten days of prototyping, thirty years of running the web."}</p>
            <p className="text-[13px] tok-com mb-6">{" */"}</p>
            <h1 className="text-lg md:text-xl mb-6">
              <span className="tok-kw">export const</span> <span className="tok-fn">timeline</span>{" "}
              <span className="tok-punc">= [</span>
            </h1>
          </>
        ) : (
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-semibold" style={{ fontFamily: "var(--font-content)" }}>
              {t({ js: "", common: "A short history of writing things down", pythagoras: "Chronology of a theorem" })}
            </h1>
            <p className="mt-2 tok-dim text-[15px] max-w-xl" style={{ fontFamily: "var(--font-content)" }}>
              {t({
                js: "",
                common: "Five thousand years of notes, from wet clay to this page.",
                pythagoras: "Pythagoras was not the first to know it, and Euclid was not the last to prove it.",
              })}
            </p>
          </header>
        )}

        <ol className="relative border-l-2 ide-divider ml-3 md:ml-5 space-y-6">
          {entries.map((e, i) => (
            <li
              key={e.year + e.title}
              className="pl-6 md:pl-8 relative animate-slide-up opacity-0"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span
                className={`absolute -left-[9px] top-1.5 size-4 border-2 border-[var(--win)] ${theme === "pythagoras" ? "rotate-45" : "rounded-full"}`}
                style={{
                  background:
                    theme === "pythagoras"
                      ? ["var(--byrne-red)", "var(--byrne-yellow)", "var(--byrne-blue)"][i % 3]
                      : i % 2
                        ? "var(--fn)"
                        : "var(--kw)",
                }}
              />
              <div className="ide-card px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <span className="tok-num font-semibold">{e.year}</span>
                  <span className="text-[var(--fg)] font-semibold">{e.title}</span>
                </div>
                <p
                  className={`leading-6 text-[var(--fg-muted)] ${theme === "js" ? "text-[13px] font-sans" : "text-[15px]"}`}
                  style={theme === "js" ? undefined : { fontFamily: "var(--font-content)" }}
                >
                  {e.body}
                </p>
                {e.foot}
              </div>
            </li>
          ))}
        </ol>

        {theme === "js" ? (
          <>
            <p className="mt-6 text-lg tok-punc">];</p>
            <p className="mt-2 text-[12px] tok-com">
              {"// Happy 30th, JavaScript. typeof null is still 'object', and we love you anyway."}
            </p>
          </>
        ) : (
          <p className="mt-8 text-[14px] tok-dim" style={{ fontFamily: "var(--font-content)" }}>
            {t({
              js: "",
              common: "Your own notes are the next entry.",
              pythagoras: "Q.E.D. Your own propositions come next.",
            })}
          </p>
        )}
      </div>
    </AppShell>
  );
};

export default HistoryPage;
