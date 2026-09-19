import { Editor } from "@tinymce/tinymce-react";
import { useAuthStore } from "../stores/useAuthStore.js";

export default function Tiny({ value, onEditorChange, placeholder }) {
  const { authUser } = useAuthStore();
  const mainColor = authUser?.main_colour || "#3b82f6";
  const accentColor = authUser?.accent_colour || "#6366f1";

  return (
    <div className="tinymce-wrapper rounded-xl overflow-hidden shadow-inner border border-white/10 bg-white/5">
      <Editor
        tinymceScriptSrc="/tinymce/js/tinymce/tinymce.min.js"
        value={value}
        onEditorChange={onEditorChange}
        init={{
          placeholder: placeholder,
          skin: "oxide-dark",
          content_css: "dark",
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
            "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image table | align lineheight | numlist bullist indent outdent | emoticons charmap | removeformat",
          content_style: `
            body { 
              background: transparent !important; 
              color: rgba(255, 255, 255, 0.9) !important; 
              font-family: 'Inter', sans-serif !important;
            }
            body::selection {
              background: ${mainColor} !important;
              color: #fff !important;
            }
            a {
              color: ${accentColor} !important;
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
