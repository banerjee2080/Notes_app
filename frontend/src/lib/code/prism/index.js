// frontend/src/lib/code/prism/index.js
//
// TinyMCE's codesample plugin ships a small Prism build (no Go, Kotlin,
// TypeScript or JSON). With `codesample_global_prismjs: true` it uses
// window.Prism instead, so we expose a build with every language the code
// editor offers. Components register themselves on the global Prism, which
// is why the import order below matters.
import "./manual.js";
import Prism from "prismjs";
import "prismjs/components/prism-clike.js";
import "prismjs/components/prism-c.js";
import "prismjs/components/prism-cpp.js";
import "prismjs/components/prism-java.js";
import "prismjs/components/prism-go.js";
import "prismjs/components/prism-kotlin.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-csharp.js";
import "prismjs/components/prism-ruby.js";
import "prismjs/components/prism-markup-templating.js";
import "prismjs/components/prism-php.js";

globalThis.Prism = Prism;
export default Prism;
