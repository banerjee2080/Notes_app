import { Editor } from "@tinymce/tinymce-react";
import { useAuthStore } from "../stores/useAuthStore.js";

export default function Tiny({ value, onEditorChange, placeholder }) {
  const { authUser, themeMode } = useAuthStore();
  const isDark = themeMode !== "light";

  // The editor lives in an iframe, so it can't see our CSS variables.
  // Read the resolved token values once per theme and inline them.
  const css = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  const fg = css("--fg", isDark ? "#d8dce3" : "#22272e");
  const kw = css("--kw", "#c792ea");
  const fn = css("--fn", "#82aaff");
  const str = css("--str", "#a8d88a");
  const panel = css("--panel-2", isDark ? "#272c34" : "#e8ebef");
  const com = css("--com", "#6f7a8c");
  const editorBg = isDark ? "#16191e" : "#ffffff";

  return (
    <div className="tinymce-wrapper overflow-hidden border ide-divider rounded-md bg-[var(--win)]">
      <Editor
        key={`${themeMode}-${authUser?.main_colour}-${authUser?.accent_colour}`}
        tinymceScriptSrc="/tinymce/js/tinymce/tinymce.min.js"
        value={value}
        onEditorChange={onEditorChange}
        init={{
          placeholder: placeholder,
          skin: isDark ? "oxide-dark" : "oxide",
          content_css: isDark ? "dark" : "default",
          min_height: 340,
          menubar: false,
          promotion: false,
          plugins: [
            "anchor",
            "autolink",
            "charmap",
            "codesample",
            "emoticons",
            "image",
            "link",
            "lists",
            "searchreplace",
            "table",
            "visualblocks",
            "wordcount",
          ],
          toolbar:
            "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image table | align lineheight | numlist bullist indent outdent | codesample emoticons charmap | removeformat",
          content_style: `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono&display=swap');
            :root { color-scheme: ${isDark ? "dark" : "light"}; }
            html, body { background: ${editorBg} !important; }
            body {
              color: ${fg} !important;
              font-family: 'Inter', system-ui, sans-serif !important;
              font-size: 15px; line-height: 1.7; margin: 18px 22px;
              caret-color: ${kw};
            }
            ::selection { background: color-mix(in srgb, ${kw} 35%, transparent); }
            a { color: ${fn} !important; }
            h1, h2, h3 { color: ${fg}; }
            h1::before, h2::before, h3::before { content: "# "; color: ${kw}; opacity: .6; }
            code, pre { font-family: 'JetBrains Mono', monospace; background: ${panel}; border-radius: 4px; padding: 0 4px; color: ${str}; }
            pre { padding: 10px 12px; }
            blockquote { border-left: 3px solid ${kw}; margin-left: 0; padding-left: 12px; color: ${com}; font-style: italic; }
            .mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before {
              color: ${com} !important; font-family: 'JetBrains Mono', monospace; font-style: italic;
            }
          `,
          // Belt-and-braces: TinyMCE strips most of these itself, but an
          // explicit policy means the editor and lib/sanitize.js cannot drift.
          // The "media" plugin was removed above - it inserts <iframe>/<video>
          // embeds that the sanitizer strips anyway, so it was a toolbar button
          // that silently discarded the user's work.
          invalid_elements: "script,style,iframe,object,embed,form,input,button",
          extended_valid_elements: "",
          allow_script_urls: false,
          allow_html_in_named_anchor: false,
          convert_unsafe_embeds: true,
          sandbox_iframes: true,

          images_upload_handler: async (blobInfo) => {
            // Since the backend processes HTML base64 images during sync,
            // we just convert the image to base64 directly and insert it into the editor.
            return "data:" + blobInfo.blob().type + ";base64," + blobInfo.base64();
          },
        }}
      />
    </div>
  );
}
