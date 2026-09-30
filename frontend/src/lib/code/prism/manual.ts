// Must be imported before "prismjs": tells Prism not to auto-highlight every
// <code class="language-*"> in the app's own page when it loads (that would
// rewrite DOM that React owns). TinyMCE calls Prism explicitly instead.
//
// Prism reads `manual` off whatever global it finds, then fills the rest of
// the object in itself - so this deliberately incomplete stub is the contract.
globalThis.Prism = { manual: true } as unknown as typeof globalThis.Prism;
