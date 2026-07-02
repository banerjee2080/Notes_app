import { Editor } from "@tinymce/tinymce-react";

export default function Tiny({ value, onEditorChange, placeholder }) {
  return (
    <div className="tinymce-wrapper rounded-xl overflow-hidden shadow-inner border border-white/10 bg-white/5">
      <Editor
        apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
        value={value}
        onEditorChange={onEditorChange}
        init={{
          placeholder: placeholder,
          skin: "oxide-dark",
          content_css: "dark",
          plugins: [
            // Core editing features
            "anchor",
            "autolink",
            "charmap",
            "codesample",
            "emoticons",
            "link",
            "lists",
            "media",
            "searchreplace",
            "table",
            "visualblocks",
            "wordcount",
            // Premium features
            "checklist",
            "mediaembed",
            "casechange",
            "formatpainter",
            "pageembed",
            "a11ychecker",
            "tinymcespellchecker",
            "permanentpen",
            "powerpaste",
            "advtable",
            "advcode",
            "advtemplate",
            "tinymceai",
            "uploadcare",
            "mentions",
            "tinycomments",
            "tableofcontents",
            "footnotes",
            "mergetags",
            "autocorrect",
            "typography",
            "inlinecss",
            "markdown",
            "importword",
            "exportword",
            "exportpdf",
          ],
          toolbar:
            "undo redo | tinymceai-chat tinymceai-quickactions tinymceai-review | blocks fontfamily fontsize | bold italic underline strikethrough | link media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography uploadcare | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat",
          tinycomments_mode: "embedded",
          tinycomments_author: "Author name",
          mergetags_list: [
            { value: "First.Name", title: "First Name" },
            { value: "Email", title: "Email" },
          ],
          tinymceai_token_provider: async () => {
            await fetch(
              `https://demo.api.tiny.cloud/1/7pjvei3p2b6aljnab7s6w37zpzg8imqccqrrpr6afsdq08z6/auth/random`,
              { method: "POST", credentials: "include" },
            );
            return {
              token: await fetch(
                `https://demo.api.tiny.cloud/1/7pjvei3p2b6aljnab7s6w37zpzg8imqccqrrpr6afsdq08z6/jwt/tinymceai`,
                { credentials: "include" },
              ).then((r) => r.text()),
            };
          },
          uploadcare_public_key: "eafab09e495ebefcde07",
          content_style: `
            body { 
              background: transparent !important; 
              color: rgba(255, 255, 255, 0.9) !important; 
              font-family: 'Inter', sans-serif !important;
            }
          `,
        }}
      />
    </div>
  );
}
