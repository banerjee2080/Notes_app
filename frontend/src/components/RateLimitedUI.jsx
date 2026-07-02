const RateLimitedUI = () => {
  return (
    <div className="w-full max-w-4xl mx-auto mt-6 px-4">
      <div className="bg-white/5 backdrop-blur-md border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
            <span className="text-xl">⏳</span>
          </div>
          <div>
            <h1 className="text-white font-semibold">Rate-Limited</h1>
            <p className="text-white/60 text-sm">Please slow down your requests.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RateLimitedUI