"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { firstStepOf, SCENES, sceneProgress, shownLines, STEPS, tourLength, type Speaker } from "@/lib/walkthrough";
import { TourScene } from "./TourScenes";

/** Reads a line aloud with a higher voice for the person asking and a lower one for the guide, when the browser can speak. */
function speak(text: string, who: Speaker, onEnd: () => void): () => void {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  const english = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  const voice = who === "asks" ? english[0] : (english[1] ?? english[0]);
  if (voice) u.voice = voice;
  u.pitch = who === "asks" ? 1.25 : 0.95;
  u.onend = onEnd;
  u.onerror = onEnd;
  synth.cancel();
  synth.speak(u);
  return () => {
    u.onend = null;
    u.onerror = null;
    synth.cancel();
  };
}

/**
 * The tour under the first page's headline: a drawn screen for each step of the app, and beside it a short conversation, one person
 * asking and the guide explaining. It starts only when someone presses play (nothing moves by itself), can be paused, skipped
 * and read aloud, and the whole conversation is also written out below for anyone who would rather read it.
 */
export function TourVideo() {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [i, setI] = useState(0);
  const [ended, setEnded] = useState(false);
  const [voice, setVoice] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const stepStarted = useRef(0);

  useEffect(() => setCanSpeak("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"), []);

  const step = STEPS[i]!;
  const advance = () => {
    if (i >= STEPS.length - 1) {
      setPlaying(false);
      setEnded(true);
    } else setI(i + 1);
  };

  // One line at a time: it stays up for its reading time, or until it has been read aloud, then the next one starts.
  useEffect(() => {
    if (!playing) return;
    stepStarted.current = performance.now();
    setElapsed(0);
    let stopSpeech = () => {};
    let timer: ReturnType<typeof setTimeout>;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    if (voice && canSpeak) {
      stopSpeech = speak(step.text, step.speaker, () => {
        timer = setTimeout(advance, 350);
      });
      fallback = setTimeout(advance, step.ms + 6000); // some browsers never say "done"
    } else timer = setTimeout(advance, step.ms);
    const tick = setInterval(() => setElapsed(performance.now() - stepStarted.current), 150);
    return () => {
      clearTimeout(timer);
      clearTimeout(fallback);
      clearInterval(tick);
      stopSpeech();
    };
    // `advance` changes with `i` only, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, i, voice, canSpeak]);

  useEffect(() => () => void (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.cancel()), []);

  const play = () => {
    setStarted(true);
    setEnded(false);
    setPlaying(true);
  };
  const restart = () => {
    setI(0);
    play();
  };
  const goTo = (scene: number) => {
    setI(firstStepOf(scene));
    play();
  };
  const sceneNow = step.scene;
  const lines = started ? shownLines(i) : [];

  return (
    <section aria-labelledby="tour-h" className="rounded-md bg-white p-ds-4 shadow-card md:p-ds-5">
      <div className="mb-ds-4 flex flex-wrap items-baseline justify-between gap-x-ds-4 gap-y-ds-1">
        <h2 id="tour-h" className="text-heading-section">
          See how ResumeAi works
        </h2>
        <p className="text-body-sm">A short conversation, about {tourLength()}. Press play, or read it below.</p>
      </div>

      <div className="grid gap-ds-4 lg:grid-cols-[1.15fr_1fr]">
        {/* The drawn screen */}
        <div className="relative flex min-h-[260px] flex-col overflow-hidden rounded-md bg-sky-50">
          <p className="px-ds-4 pt-ds-3 text-label-bold text-blue-700">
            Step {sceneNow + 1} of {SCENES.length}
            <span className="font-normal text-navy-900"> · {SCENES[sceneNow]!.title}</span>
          </p>
          <div aria-hidden="true" className="grid flex-1 place-items-center p-ds-4">
            <TourScene key={`${sceneNow}-${started ? 1 : 0}`} id={SCENES[sceneNow]!.id} />
          </div>
          {!started && (
            <div className="absolute inset-0 grid place-items-center bg-white/75 p-ds-4 backdrop-blur-[1px]">
              <Button type="button" variant="secondary" onClick={play} icon={<Play size={18} aria-hidden="true" />} aria-label={`Play the tour, about ${tourLength()}`}>
                Play the tour
              </Button>
            </div>
          )}
        </div>

        {/* The conversation */}
        <div className="flex flex-col gap-ds-3">
          <div role="log" aria-live="polite" aria-label="The conversation" className="flex min-h-[200px] flex-col gap-ds-3 rounded-md bg-gray-100 p-ds-3">
            {lines.length === 0 ? (
              <p className="m-auto max-w-[28ch] text-center text-body-sm">Listen in on a new user asking, and the ResumeAi guide explaining.</p>
            ) : (
              lines.map((l) => (
                <div key={`${l.scene}-${l.line}`} className={cn("wt-in flex max-w-[92%] flex-col gap-0.5", l.speaker === "asks" ? "items-start" : "items-end self-end")}>
                  <span className="text-caption">{l.speaker === "asks" ? "New user" : "ResumeAi guide"}</span>
                  <span className={cn("rounded-md px-ds-3 py-ds-2 text-body-sm", l.speaker === "asks" ? "bg-white text-navy-900 shadow-card" : "bg-blue-600 text-white")}>{l.text}</span>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center gap-ds-3">
            {ended ? (
              <Button type="button" variant="secondary" compact onClick={restart} icon={<RotateCcw size={16} aria-hidden="true" />}>
                Watch again
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                compact
                onClick={() => (playing ? setPlaying(false) : play())}
                icon={playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              >
                {playing ? "Pause" : started ? "Resume" : "Play"}
              </Button>
            )}
            <IconButton label="Previous step" disabled={sceneNow === 0} onClick={() => goTo(sceneNow - 1)} className="disabled:opacity-40">
              <ChevronLeft size={18} aria-hidden="true" />
            </IconButton>
            <IconButton label="Next step" disabled={sceneNow === SCENES.length - 1} onClick={() => goTo(sceneNow + 1)} className="disabled:opacity-40">
              <ChevronRight size={18} aria-hidden="true" />
            </IconButton>
            {canSpeak && (
              <button
                type="button"
                aria-pressed={voice}
                onClick={() => setVoice((v) => !v)}
                className={cn("ml-auto inline-flex items-center gap-1 rounded-pill px-ds-3 py-1.5 text-body-sm focus-visible:outline-2 focus-visible:outline-blue-600", voice ? "bg-sky-50 font-bold text-blue-700" : "text-navy-900 hover:bg-gray-100")}
              >
                {voice ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
                Read aloud
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Steps: each one jumps to its scene and shows how far the tour has got. */}
      <ol aria-label="Steps of the tour" className="mt-ds-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${SCENES.length}, minmax(0, 1fr))` }}>
        {SCENES.map((s, n) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => goTo(n)}
              aria-label={`Go to step ${n + 1}: ${s.title}`}
              aria-current={started && n === sceneNow ? "step" : undefined}
              className="group flex w-full flex-col gap-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span className="block h-1.5 overflow-hidden rounded-pill bg-gray-100">
                <span className="block h-full rounded-pill bg-blue-600" style={{ width: `${(started ? sceneProgress(n, i, elapsed) : 0) * 100}%` }} />
              </span>
              <span className={cn("hidden text-caption group-hover:text-blue-700 lg:block", started && n === sceneNow && "font-bold text-blue-700")}>{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <details className="mt-ds-3 text-body-sm">
        <summary className="w-fit cursor-pointer text-blue-700 underline">Read the whole conversation</summary>
        <div className="mt-ds-2 flex flex-col gap-ds-3">
          {SCENES.map((s, n) => (
            <div key={s.id}>
              <h3 className="text-label-bold">
                {n + 1}. {s.title}
              </h3>
              <ul className="mt-1 flex flex-col gap-1">
                {s.lines.map((l) => (
                  <li key={l.text}>
                    <span className="font-bold">{l.speaker === "asks" ? "New user: " : "Guide: "}</span>
                    {l.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
