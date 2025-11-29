import { useCallback, useEffect, useRef, useState } from "react";

const isBrowser = typeof window !== "undefined";

type UsePhaseLooperOptions = {
  /** Base playback rate for the slower loop */
  basePlaybackRate?: number;
  /** Playback rate for the faster loop (e.g. 1.003) */
  fastPlaybackRate?: number;
  /** Overall gain (0–1) */
  gain?: number;
  /** Left/right pan for each channel */
  panLeft?: number;
  panRight?: number;
};

type PhaseLooperState = {
  isSupported: boolean;
  isEnabling: boolean;
  isEnabled: boolean;
  isRecording: boolean;
  hasPhrase: boolean;
  isPhasePlaying: boolean;
  status: string;
};

type UsePhaseLooperReturn = PhaseLooperState & {
  enable: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  startPhase: () => void;
  stopPhase: () => void;
  reset: () => void;
};

const getInitialState = (): PhaseLooperState => ({
  isSupported:
    typeof window !== "undefined" &&
    !!window.AudioContext &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined",
  isEnabling: false,
  isEnabled: false,
  isRecording: false,
  hasPhrase: false,
  isPhasePlaying: false,
  status: "",
});

export function usePhaseLooper(
  options: UsePhaseLooperOptions = {}
): UsePhaseLooperReturn {
  const {
    basePlaybackRate = 1.0,
    fastPlaybackRate = 1.003,
    gain = 0.8,
    panLeft = -0.8,
    panRight = 0.8,
  } = options;

  useEffect(() => {
    if (!isBrowser) return;
  }, []);

  const [state, setState] = useState<PhaseLooperState>(getInitialState());

  // Audio graph + recording refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const phraseBufferRef = useRef<AudioBuffer | null>(null);

  const source1Ref = useRef<AudioBufferSourceNode | null>(null);
  const source2Ref = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const ignoreNextOnStopRef = useRef(false);

  const setStatus = useCallback((status: string) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  // Enable AudioContext + mic / MediaRecorder
  const enable = useCallback(async () => {
    if (!state.isSupported) {
      setStatus("Web Audio or MediaRecorder not supported in this browser.");
      return;
    }
    if (state.isEnabled || state.isEnabling) return;

    setState((prev) => ({ ...prev, isEnabling: true }));

    try {
      const AudioCtx = window.AudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const audioCtx = audioCtxRef.current;

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        chunksRef.current = [];
        setState((prev) => ({ ...prev, isRecording: true }));
        setStatus("Recording your phrase…");
      };

      recorder.onstop = async () => {
        if (ignoreNextOnStopRef.current) {
          // We triggered this stop as part of a reset; ignore it.
          ignoreNextOnStopRef.current = false;
          return;
        }
        setState((prev) => ({ ...prev, isRecording: false }));
        setStatus("Processing recording…");

        if (!audioCtxRef.current) return;

        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);

          phraseBufferRef.current = buffer;
          setState((prev) => ({ ...prev, hasPhrase: true }));
          setStatus(
            `Captured phrase: ${buffer.duration.toFixed(
              2
            )}s. Ready to start phase loop.`
          );
        } catch (err) {
          console.error(err);
          setStatus("Error decoding audio buffer.");
        }
      };

      setState((prev) => ({
        ...prev,
        isEnabled: true,
        isEnabling: false,
      }));
      setStatus("Mic enabled. Click Record and speak your phrase.");
    } catch (err) {
      console.error(err);
      setState((prev) => ({ ...prev, isEnabling: false }));
      setStatus("Error accessing microphone. Check permissions.");
    }
  }, [setStatus, state.isEnabled, state.isEnabling, state.isSupported]);

  const startRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "recording") return;
    recorder.start();
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  }, []);

  const stopPhase = useCallback(() => {
    const s1 = source1Ref.current;
    const s2 = source2Ref.current;
    const g = gainRef.current;

    if (s1) {
      try {
        s1.stop();
      } catch {
        /* ignore */
      }
      s1.disconnect();
      source1Ref.current = null;
    }
    if (s2) {
      try {
        s2.stop();
      } catch {
        /* ignore */
      }
      s2.disconnect();
      source2Ref.current = null;
    }
    if (g) {
      g.disconnect();
      gainRef.current = null;
    }

    setState((prev) => ({ ...prev, isPhasePlaying: false }));
  }, []);

  const startPhase = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    const buffer = phraseBufferRef.current;

    if (!audioCtx || !buffer) return;

    // Stop any existing loop
    stopPhase();

    const source1 = audioCtx.createBufferSource();
    const source2 = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();

    source1.buffer = buffer;
    source2.buffer = buffer;

    source1.loop = true;
    source2.loop = true;

    source1.playbackRate.value = basePlaybackRate;
    source2.playbackRate.value = fastPlaybackRate;

    const panner1 = new StereoPannerNode(audioCtx, { pan: panLeft });
    const panner2 = new StereoPannerNode(audioCtx, { pan: panRight });

    gainNode.gain.value = gain;

    source1.connect(panner1).connect(gainNode).connect(audioCtx.destination);
    source2.connect(panner2).connect(gainNode).connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    source1.start(now);
    source2.start(now);

    source1Ref.current = source1;
    source2Ref.current = source2;
    gainRef.current = gainNode;

    setState((prev) => ({ ...prev, isPhasePlaying: true }));
    setStatus(
      "Phase loop playing. One channel is slightly faster, so they’ll drift over time."
    );
  }, [
    basePlaybackRate,
    fastPlaybackRate,
    gain,
    panLeft,
    panRight,
    stopPhase,
    setStatus,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        stopPhase();
      } catch {
        /* ignore */
      }

      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stopPhase]);

  const reset = useCallback(() => {
    // 1. Stop phase playback and disconnect nodes
    try {
      stopPhase();
    } catch {
      /* ignore */
    }

    // 2. Stop recording if in progress; mark that we should ignore onstop handler
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      ignoreNextOnStopRef.current = true;
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }

    // 3. Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // 4. Close AudioContext
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
    }

    // 5. Clear all audio/recording refs
    recorderRef.current = null;
    chunksRef.current = [];
    phraseBufferRef.current = null;
    source1Ref.current = null;
    source2Ref.current = null;
    gainRef.current = null;

    // 6. Reset state to initial
    setState(getInitialState());
  }, [stopPhase]);

  return {
    ...state,
    reset,
    enable,
    startRecording,
    stopRecording,
    startPhase,
    stopPhase,
  };
}
