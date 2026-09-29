// Must be imported before "prismjs": tells Prism not to auto-highlight every
// <code class="language-*"> in the app's own page when it loads (that would
// rewrite DOM that React owns). TinyMCE calls Prism explicitly instead.
globalThis.Prism = { manual: true };
