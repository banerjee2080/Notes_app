const RateLimitedUI = () => {
  return (
    <div className="w-full max-w-3xl mx-auto mt-6 px-4">
      <div className="ide-note is-warn">
        <div className="tok-warn font-semibold">RangeError: Too many requests (429)</div>
        <div className="tok-com">
          {"// Slow down a little — await new Promise(r => setTimeout(r, 1000));"}
        </div>
      </div>
    </div>
  );
};

export default RateLimitedUI;
