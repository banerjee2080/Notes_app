import { Link, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import Dialog from "../components/ui/Dialog";
import { TriangleAlert } from "lucide-react";

// Any unknown URL: ReferenceError: page is not defined
const NotFoundPage = () => {
  const { pathname } = useLocation();
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
