import { Lock } from "lucide-react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

// Bottom line of the note editor: export + encryption / sync status.
const EditorFooter = ({ readOnly = false }: { readOnly?: boolean }) => {
  const isOnline = useOnlineStatus();
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px]">
      <span>
        <span className="tok-kw">export default</span>{" "}
        <span className="text-[var(--fg)]">note</span>
        <span className="tok-punc">;</span>
        {readOnly && <span className="tok-com"> {"// read-only"}</span>}
      </span>
      <span className="flex items-center gap-1.5 tok-dim">
        <Lock className="size-3.5 tok-ok" />
        AES-GCM · {isOnline ? "syncs when saved" : "offline, queued for sync"}
      </span>
    </div>
  );
};

export default EditorFooter;
