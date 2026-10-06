import { CloudUpload } from "lucide-react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useVoice } from "../../lib/voice";

// Bottom line of the note editor: export + sync status.
const EditorFooter = ({ readOnly = false }: { readOnly?: boolean }) => {
  const isOnline = useOnlineStatus();
  const { voice } = useVoice();
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px]">
      {voice ? (
        <span className="tok-dim">
          {voice.editorFooter}
          {readOnly && " · read-only"}
        </span>
      ) : (
        <span>
          <span className="tok-kw">export default</span>{" "}
          <span className="text-[var(--fg)]">note</span>
          <span className="tok-punc">;</span>
          {readOnly && <span className="tok-com"> {"// read-only"}</span>}
        </span>
      )}
      <span className="flex items-center gap-1.5 tok-dim">
        <CloudUpload className="size-3.5 tok-ok" />
        {isOnline ? "syncs when saved" : "offline, queued for sync"}
      </span>
    </div>
  );
};

export default EditorFooter;
