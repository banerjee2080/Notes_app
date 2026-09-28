// `keepUnlocked: true, // 7 days` — the "remember me" checkbox, as code.
const RememberToggle = ({ checked, onChange }) => (
  <label className="flex items-center gap-2.5 cursor-pointer select-none text-[13px]">
    <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
    <span
      className={`size-4 rounded-[4px] border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--kw)] ${
        checked ? "bg-[var(--kw)] border-[var(--kw)]" : "border-[var(--line)] bg-[var(--panel)]"
      }`}
    >
      {checked && (
        <svg className="size-3 text-[var(--win)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
    <span>
      <span className="text-[var(--fg)]">keepUnlocked</span>
      <span className="tok-punc">: </span>
      <span className="tok-kw">{String(checked)}</span>
      <span className="tok-punc">,</span>{" "}
      <span className="tok-com">{"// for 7 days on this device"}</span>
    </span>
  </label>
);

export default RememberToggle;
