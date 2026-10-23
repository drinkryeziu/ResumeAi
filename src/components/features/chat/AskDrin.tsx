"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Volume2, VolumeX, X } from "lucide-react";
import type { Facts } from "@/lib/ask-drin/facts";
import { byId, STARTERS } from "@/lib/ask-drin/knowledge";
import { reply, type Reply } from "@/lib/ask-drin/match";
import { cn } from "@/lib/cn";
import { sentences } from "@/lib/ask-drin/speech-text";
import { pickVoices, score as voiceScore } from "@/lib/tour-voices";
import { DrinAvatar } from "./DrinAvatar";

type Turn = { from: "you"; text: string } | { from: "drin"; reply: Reply };

const GREETING = "Hi, I'm Drin. Ask me anything about how ResumeAi works, or pick a question below.";
/** How long Drin "thinks" before he starts to write (1 to 2 seconds), and how fast he types (characters every tick). */
const THINK_MIN_MS = 1000;
const THINK_MAX_MS = 2000;
const TICK_MS = 22;
const CHARS_PER_TICK = 2;
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const VOICE_KEY = "ask-drin-voice";
const speech = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined" ? window.speechSynthesis : null;

const VOICE_NAME_KEY = "ask-drin-voice-name";
/** The voice Drin uses when nobody has picked one, if the device has it ("Alex" comes with every Mac); otherwise the best one found. */
const PREFERRED_VOICE = "Alex";
/** How fast he talks: a little quicker than the default, which sounds drawn out for a helper. */
const RATE = 1.1;
/** The voices worth offering: English, without the novelty ones, best first. */
const goodVoices = () => (speech()?.getVoices() ?? []).filter((v) => voiceScore(v) > -10).sort((a, b) => voiceScore(b) - voiceScore(a));

/**
 * Reads text aloud, a sentence at a time so there is a breath between them, in the voice the person chose or else the most natural
 * man's voice the device has (the same picker the first-page tour uses). `onEnd` is called when it is finished or cut off.
 */
function say(text: string, onEnd: () => void, voiceName?: string, onStart?: () => void, plain = false) {
  const synth = speech();
  if (!synth) return onEnd();
  const pick = pickVoices(synth.getVoices());
  // "plain" is the last resort: no chosen voice, the device's own default.
  const named = (name: string) => synth.getVoices().find((v) => v.name === name && v.lang.toLowerCase().startsWith("en"));
  const voice = plain ? undefined : (voiceName && named(voiceName)) || named(PREFERRED_VOICE) || pick.explains;
  const parts = sentences(text);
  synth.cancel();
  synth.resume(); // some browsers stay paused after a tab was in the background
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-US";
    u.rate = RATE;
    u.pitch = voice?.name === PREFERRED_VOICE || voiceName || pick.distinct ? 1 : 0.92;
    if (i === 0) u.onstart = () => onStart?.();
    if (i === parts.length - 1) u.onend = onEnd;
    u.onerror = onEnd;
    synth.speak(u);
  });
}

/**
 * "Ask Drin": a small helper on every page. Questions are answered from the app's own information (what the app does, what it
 * costs), by matching the words of the question; Drin says so when he doesn't know. It runs in the browser, so it is instant,
 * free and never sends what people type anywhere.
 */
export function AskDrin({ facts }: { facts: Facts }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  /** The answer being typed out right now, and how many of its characters are showing. */
  const [typing, setTyping] = useState<{ reply: Reply; shown: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ticker = useRef<ReturnType<typeof setInterval>>(undefined);
  const busy = thinking || typing !== null;
  /** Read aloud: the switch in the header (answers are read as they are typed), and which answer is being read now. */
  const [canSpeak, setCanSpeak] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  /** True when a reading did not start at all (no sound could be played). */
  const [silent, setSilent] = useState(false);
  const [voiceName, setVoiceName] = useState("");
  const voiceNameRef = useRef("");
  const voiceRef = useRef(false);
  const spoken = useRef(0);

  /** Starts reading `text`; a newer reading (or a stop) makes the older one's "finished" signal harmless. */
  const read = (text: string) => {
    const mine = ++spoken.current;
    setSpeaking(text);
    const done = () => spoken.current === mine && setSpeaking(null);
    // Some voices are listed but not installed, and then the browser stays silent. If nothing starts within three seconds, try the
    // device's default voice, and if that is silent too, say so instead of leaving the person wondering.
    const attempt = (plain: boolean) => {
      let started = false;
      say(
        text,
        done,
        voiceNameRef.current,
        () => {
          started = true;
          setSilent(false);
        },
        plain,
      );
      setTimeout(() => {
        if (spoken.current !== mine || started) return;
        if (!plain) return attempt(true);
        speech()?.cancel();
        setSilent(true);
        setSpeaking(null);
      }, 3000);
    };
    attempt(false);
  };
  const hush = () => {
    spoken.current++;
    speech()?.cancel();
    setSpeaking(null);
  };
  /** The person picked a voice from the list ("" is the automatic choice): remember it and let them hear it. */
  const chooseVoice = (name: string) => {
    setVoiceName(name);
    voiceNameRef.current = name;
    try {
      localStorage.setItem(VOICE_NAME_KEY, name);
    } catch {}
    read("Hi, I'm Drin. This is how I sound.");
  };
  const toggleVoice = () => {
    const on = !voiceOn;
    setVoiceOn(on);
    voiceRef.current = on;
    try {
      localStorage.setItem(VOICE_KEY, on ? "1" : "0");
    } catch {}
    if (!on) hush();
  };

  useEffect(() => {
    const synth = speech();
    const load = () => setVoices(goodVoices().map((v) => v.name)); // some browsers load their voices late
    setCanSpeak(synth !== null);
    if (synth) {
      load();
      synth.addEventListener?.("voiceschanged", load);
      try {
        const on = localStorage.getItem(VOICE_KEY) === "1";
        setVoiceOn(on);
        voiceRef.current = on;
        const name = localStorage.getItem(VOICE_NAME_KEY) ?? "";
        setVoiceName(name);
        voiceNameRef.current = name;
      } catch {}
    }
    return () => {
      clearTimeout(timer.current);
      clearInterval(ticker.current);
      synth?.removeEventListener?.("voiceschanged", load);
      synth?.cancel();
    };
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, thinking, typing?.shown, open]);

  const close = () => {
    hush();
    setOpen(false);
    launcher.current?.focus();
  };

  /** Drin thinks for a moment, then types the answer out; the whole answer is only announced to screen readers once it is written. */
  const ask = (text: string) => {
    const q = text.trim().slice(0, 300);
    if (!q || busy) return;
    hush();
    setTurns((t) => [...t, { from: "you", text: q }]);
    setDraft("");
    setThinking(true);
    const calm = prefersReducedMotion();
    const answer = reply(q, facts);
    const finish = () => {
      clearInterval(ticker.current);
      setTyping(null);
      setTurns((t) => [...t, { from: "drin", reply: answer }]);
    };
    timer.current = setTimeout(
      () => {
        setThinking(false);
        if (voiceRef.current) read(answer.text);
        if (calm) return finish();
        setTyping({ reply: answer, shown: 0 });
        let shown = 0;
        ticker.current = setInterval(() => {
          shown += CHARS_PER_TICK;
          if (shown >= answer.text.length) return finish();
          setTyping({ reply: answer, shown });
        }, TICK_MS);
      },
      calm ? 400 : THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS),
    );
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Ask Drin"
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="fixed right-3 bottom-3 z-40 flex max-h-[min(640px,calc(100dvh-24px))] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_-20px_rgba(50,25,150,0.55)] sm:right-5 sm:bottom-5"
        >
          <header className="au-grad flex items-center gap-ds-3 px-ds-4 py-ds-3 text-white">
            <DrinAvatar size={44} className="shrink-0 rounded-full ring-2 ring-white/70" />
            <div className="min-w-0 flex-1">
              <p className="text-card-title">Ask Drin</p>
              <p className="text-caption text-white/90">Questions about ResumeAi, answered from the app</p>
            </div>
            {canSpeak && (
              <button
                type="button"
                onClick={toggleVoice}
                aria-pressed={voiceOn}
                aria-label="Read answers aloud"
                title={voiceOn ? "Reading answers aloud: on" : "Read answers aloud"}
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white",
                  voiceOn && "bg-white/25",
                )}
              >
                {voiceOn ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
              </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close Ask Drin"
              className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          {silent && (
            <p role="status" className="bg-warning-tint px-ds-4 py-ds-2 text-caption text-warning">
              I couldn&apos;t play any sound. Check that your volume is up, or pick another voice from the list.
            </p>
          )}
          {canSpeak && voiceOn && voices.length > 0 && (
            <div className="flex items-center gap-ds-2 bg-white px-ds-4 py-ds-2">
              <label htmlFor="ask-drin-voice" className="shrink-0 text-caption">
                Voice
              </label>
              <select
                id="ask-drin-voice"
                value={voiceName}
                onChange={(e) => chooseVoice(e.target.value)}
                className="min-w-0 flex-1 rounded-pill bg-gray-100 px-ds-3 py-1.5 text-body-sm outline-none focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <option value="">{voices.includes(PREFERRED_VOICE) ? `${PREFERRED_VOICE} (default)` : "Automatic (best on this device)"}</option>
                {voices.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            role="log"
            aria-live="polite"
            aria-label="Conversation with Drin"
            className="flex min-h-[180px] flex-1 flex-col gap-ds-3 overflow-y-auto bg-sky-50 p-ds-4"
          >
            <Bubble from="drin">{GREETING}</Bubble>
            {turns.map((t, i) =>
              t.from === "you" ? (
                <Bubble key={i} from="you">
                  {t.text}
                </Bubble>
              ) : (
                <div key={i} className="flex flex-col gap-ds-2">
                  <Bubble from="drin">{t.reply.text}</Bubble>
                  {canSpeak && (
                    <button
                      type="button"
                      onClick={() => (speaking === t.reply.text ? hush() : read(t.reply.text))}
                      className="inline-flex items-center gap-1 self-start rounded-pill px-ds-2 py-1 text-caption text-blue-700 hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {speaking === t.reply.text ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
                      {speaking === t.reply.text ? "Stop" : "Listen"}
                    </button>
                  )}
                  {t.reply.link && (
                    <Link
                      href={t.reply.link.href}
                      onClick={() => setOpen(false)}
                      className="self-start rounded-pill bg-white px-ds-3 py-1.5 text-label-bold text-blue-700 shadow-card no-underline hover:bg-gray-100"
                    >
                      {t.reply.link.label}
                    </Link>
                  )}
                  {t.reply.related.length > 0 && (
                    <Chips label={t.reply.id ? "You might also ask" : undefined} ids={t.reply.related.map((r) => r.id)} onPick={(q) => ask(q)} />
                  )}
                </div>
              ),
            )}
            {thinking && (
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-caption">Drin</span>
                <span className="flex items-center gap-1.5 rounded-[18px_18px_18px_6px] bg-white px-ds-4 py-ds-3 shadow-card" aria-hidden="true">
                  <span className="drin-dot" />
                  <span className="drin-dot" style={{ animationDelay: "160ms" }} />
                  <span className="drin-dot" style={{ animationDelay: "320ms" }} />
                </span>
                <span className="sr-only" role="status">
                  Drin is typing
                </span>
              </div>
            )}
            {typing && (
              <div aria-hidden="true">
                <Bubble from="drin">{typing.reply.text.slice(0, typing.shown)}</Bubble>
              </div>
            )}
            {turns.length === 0 && !busy && <Chips label="Popular questions" ids={[...STARTERS]} onPick={(q) => ask(q)} />}
            <div ref={end} />
          </div>

          <form onSubmit={submit} className="flex items-center gap-ds-2 border-t border-gray-100 bg-white p-ds-3">
            <label htmlFor="ask-drin-input" className="sr-only">
              Your question
            </label>
            <input
              id="ask-drin-input"
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={300}
              autoComplete="off"
              placeholder="Type your question"
              className="min-w-0 flex-1 rounded-pill bg-gray-100 px-ds-4 py-2.5 text-body outline-none placeholder:text-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600"
            />
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              aria-label="Send question"
              className="au-grad grid size-11 shrink-0 place-items-center rounded-full text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-gray-100 disabled:[background-image:none] disabled:text-gray-400"
            >
              <ArrowUp size={20} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}

      {!open && (
        <button
          ref={launcher}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="au-grad fixed right-3 bottom-3 z-40 flex items-center gap-2.5 rounded-pill py-1.5 pr-5 pl-1.5 text-label-bold text-white shadow-[0_16px_36px_-10px_rgba(109,74,255,0.75)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:right-5 sm:bottom-5"
        >
          <DrinAvatar size={40} className="rounded-full ring-2 ring-white/80" />
          Ask Drin
        </button>
      )}
    </>
  );
}

function Bubble({ from, children }: { from: "you" | "drin"; children: string }) {
  return (
    <div className={cn("flex max-w-[88%] flex-col gap-0.5", from === "you" ? "items-end self-end" : "items-start")}>
      <span className="text-caption">{from === "you" ? "You" : "Drin"}</span>
      <span
        className={cn(
          "px-ds-3 py-ds-2 text-body-sm",
          from === "you" ? "au-grad rounded-[18px_18px_6px_18px] text-white" : "rounded-[18px_18px_18px_6px] bg-white text-navy-900 shadow-card",
        )}
      >
        {children}
      </span>
    </div>
  );
}

function Chips({ label, ids, onPick }: { label?: string; ids: string[]; onPick: (question: string) => void }) {
  return (
    <div className="flex flex-col gap-ds-2">
      {label && <p className="text-caption">{label}</p>}
      <ul className="flex flex-wrap gap-ds-2">
        {ids.map((id) => {
          const e = byId(id);
          return e ? (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPick(e.question)}
                className="rounded-pill bg-white px-ds-3 py-1.5 text-left text-body-sm text-blue-700 shadow-[inset_0_0_0_1.5px_var(--blue-600)] hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {e.question}
              </button>
            </li>
          ) : null;
        })}
      </ul>
    </div>
  );
}
