import AppShell from "../components/shell/AppShell.jsx";
import Navbar from "../components/Navbar.jsx";
import { TIMELINE } from "../lib/jsLore.js";

// import history from '95' — a short timeline of the language this app runs on.
const HistoryPage = () => {
  return (
    <AppShell toolbar={<Navbar crumb="history.js" />}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <p className="text-[13px] tok-com mb-1">{"/**"}</p>
        <p className="text-[13px] tok-com mb-1">{" * JavaScript, 1995 → today."}</p>
        <p className="text-[13px] tok-com mb-1">{" * Ten days of prototyping, thirty years of running the web."}</p>
        <p className="text-[13px] tok-com mb-6">{" */"}</p>

        <h1 className="text-lg md:text-xl mb-6">
          <span className="tok-kw">export const</span> <span className="tok-fn">timeline</span>{" "}
          <span className="tok-punc">= [</span>
        </h1>

        <ol className="relative border-l-2 ide-divider ml-3 md:ml-5 space-y-6">
          {TIMELINE.map((e, i) => (
            <li
              key={e.year + e.title}
              className="pl-6 md:pl-8 relative animate-slide-up opacity-0"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span
                className="absolute -left-[9px] top-1.5 size-4 rounded-full border-2 border-[var(--win)]"
                style={{ background: i % 2 ? "var(--fn)" : "var(--kw)" }}
              />
              <div className="ide-card px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <span className="tok-num font-semibold">{e.year}</span>
                  <span className="text-[var(--fg)] font-semibold">{e.title}</span>
                </div>
                <p className="text-[13px] leading-6 text-[var(--fg-muted)] font-sans">{e.body}</p>
                <code className="mt-2 inline-block text-[12px] px-2 py-0.5 rounded bg-[var(--panel-2)] tok-str">
                  {e.code}
                </code>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-lg tok-punc">];</p>
        <p className="mt-2 text-[12px] tok-com">
          {"// Happy 30th, JavaScript. typeof null is still 'object', and we love you anyway."}
        </p>
      </div>
    </AppShell>
  );
};

export default HistoryPage;
