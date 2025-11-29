import { usePhaseLooper } from "./hooks/usePhaseLooper";

export default function Page() {
  const {
    isSupported,
    isEnabling,
    isEnabled,
    isRecording,
    hasPhrase,
    isPhasePlaying,
    status,
    enable,
    startRecording,
    stopRecording,
    startPhase,
    stopPhase,
    reset,
  } = usePhaseLooper({
    basePlaybackRate: 1.0,
    fastPlaybackRate: 1.003,
    gain: 0.8,
    panLeft: -0.8,
    panRight: 0.8,
  });

  const handlePrimaryClick = () => {
    if (!isEnabled) return enable();
    if (!isRecording && !hasPhrase) return startRecording();
    if (isRecording) return stopRecording();
    if (!isPhasePlaying) return startPhase();
    return stopPhase();
  };

  const disabled = !isSupported || isEnabling;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#f4f1e8] text-black px-8 text-base">
      <div className="w-full max-w-xl border border-black/40 bg-[#f9f6ee] px-8 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-black/40 pb-3 mb-4">
          <div className="font-mono text-sm tracking-[0.16em] uppercase">
            Phase Looper
          </div>
          <div className="font-mono text-sm text-black/70">
            System: Web Audio
          </div>
        </div>

        {/* Description row */}
        <div className="mb-6">
          <p className="font-mono text-sm leading-relaxed text-black/80">
            A Web Audio API demo inspired by Steve Reich&apos;s{" "}
            <a
              href="https://en.wikipedia.org/wiki/Come_Out_(Reich)"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-black/40 hover:decoration-black transition-colors"
            >
              <em>Come Out</em>
            </a>
            .
          </p>
        </div>

        {/* Main control row */}
        <div className="grid grid-cols-[auto,1fr] gap-10 items-center">
          {/* Primary control block */}
          <div className="flex flex-col items-center gap-4">
            <div className="font-mono text-sm uppercase tracking-[0.12em] border-b border-black/40 pb-1">
              Control
            </div>

            <button
              onClick={handlePrimaryClick}
              disabled={disabled}
              className="
                relative flex items-center justify-center
                size-24
                border border-black
                bg-[#f9f6ee]
                hover:bg-black hover:text-[#f9f6ee]
                transition-colors
                disabled:opacity-40 disabled:hover:bg-[#f9f6ee] disabled:hover:text-black disabled:cursor-not-allowed
              "
            >
              {/* Enable text */}
              {!isEnabled && (
                <span className="font-mono text-sm uppercase tracking-[0.14em]">
                  Enable
                </span>
              )}

              {/* Armed to record — hollow circle (black) */}
              {isEnabled && !isRecording && !hasPhrase && (
                <div className="size-7 rounded-full border-2 border-black" />
              )}

              {/* Recording — solid red circle */}
              {isRecording && (
                <div className="size-7 rounded-full bg-red-600" />
              )}

              {/* Ready to play — triangle (black) */}
              {!isRecording && hasPhrase && !isPhasePlaying && (
                <div className="w-0 h-0 border-t-[14px] border-b-[14px] border-l-[22px] border-l-black border-transparent ml-[2px]" />
              )}

              {/* Playing — square (black) */}
              {isPhasePlaying && <div className="size-7 bg-black" />}
            </button>
          </div>

          {/* Status + meta */}
          <div className="flex flex-col gap-4">
            {/* Status block */}
            <div className="border border-black/40 px-4 py-3">
              <div className="font-mono text-sm uppercase tracking-[0.12em] mb-2">
                Status
              </div>
              <div className="font-mono text-sm">
                {status ||
                  (isRecording
                    ? "STATE: RECORDING"
                    : isPhasePlaying
                    ? "STATE: PLAYING (OUT OF PHASE)"
                    : hasPhrase
                    ? "STATE: PHRASE CAPTURED"
                    : "STATE: IDLE / WAITING")}
              </div>
            </div>

            {/* Info row */}
            <div className="flex items-center justify-between font-mono text-sm text-black/80">
              <span>Loop length: variable</span>
              <button
                onClick={reset}
                className="underline underline-offset-2 decoration-black/40 hover:decoration-black"
              >
                RESET
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
