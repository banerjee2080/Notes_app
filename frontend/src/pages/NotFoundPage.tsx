import { Link, useLocation } from "react-router";
import { ArrowLeft, TriangleAlert, Compass, MapPinOff } from "lucide-react";
import Dialog from "../components/ui/Dialog";
import { useCopy } from "../lib/voice";

// Any unknown URL. JS: "ReferenceError: page is not defined".
const NotFoundPage = () => {
  const { pathname } = useLocation();
  const { t, theme } = useCopy();

  if (theme !== "js")
    return (
      <div className="min-h-screen">
        <Dialog
          title={t({ js: "", common: "Page not found", pythagoras: "No such proposition" })}
          icon={theme === "pythagoras" ? <Compass className="size-4" /> : <MapPinOff className="size-4" />}
          showClose={false}
          closeOnBackdrop={false}
          footer={
            <Link to="/" className="ide-btn ide-btn-primary">
              <ArrowLeft className="size-4" />
              {t({ js: "", common: "Back to my notes", pythagoras: "Return to the Elements" })}
            </Link>
          }
        >
          <p className="text-[14px] text-[var(--fg)] break-all">
            {t({ js: "", common: "There's nothing at ", pythagoras: "" })}
            <span className="tok-str">{pathname}</span>
            {t({ js: "", common: ".", pythagoras: " cannot be constructed from the given postulates." })}
          </p>
          <p className="text-[13px] tok-com mt-2">
            {t({
              js: "",
              common: "The link may be old, or the note may have been deleted.",
              pythagoras: "Perhaps it was erased, or never drawn at all.",
            })}
          </p>
        </Dialog>
      </div>
    );

  return (
    <div className="min-h-screen">
      <Dialog
        title="Uncaught ReferenceError"
        tone="error"
        icon={<TriangleAlert className="size-4" />}
        showClose={false}
        closeOnBackdrop={false}
        footer={
          <Link to="/" className="ide-btn ide-btn-primary">
            <ArrowLeft className="size-4" />
            <span>
              location.assign(<span className="tok-str">"/"</span>)
            </span>
          </Link>
        }
      >
        <p className="text-[13.5px] text-[var(--fg)] break-all">
          <span className="tok-str">"{pathname}"</span> is not defined.
        </p>
        <p className="text-[12px] tok-com mt-2">
          {"    at Router.resolve (routes.jsx:404)"}
          <br />
          {"    at async Note.js"}
        </p>
      </Dialog>
    </div>
  );
};

export default NotFoundPage;
