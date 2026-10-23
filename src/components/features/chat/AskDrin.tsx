"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, X } from "lucide-react";
import type { Facts } from "@/lib/ask-drin/facts";
import { byId, STARTERS } from "@/lib/ask-drin/knowledge";
import { reply, type Reply } from "@/lib/ask-drin/match";
import { cn } from "@/lib/cn";
import { DrinAvatar } from "./DrinAvatar";

type Turn = { from: "you"; text: string } | { from: "drin"; reply: Reply };

const GREETING = "Hi, I'm Drin. Ask me anything about how ResumeAi works, or pick a question below.";
/** How long Drin "thinks" before he starts to write (1 to 2 seconds), and how fast he types (characters every tick). */
const THINK_MIN_MS = 1000;
const THINK_MAX_MS = 2000;
const TICK_MS = 22;
const CHARS_PER_TICK = 2;
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearInterval(ticker.current);
    },
    [],
  );
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, thinking, typing?.shown, open]);

  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };

  /** Drin thinks for a moment, then types the answer out; the whole answer is only announced to screen readers once it is written. */
  const ask = (text: string) => {
    const q = text.trim().slice(0, 300);
    if (!q || busy) return;
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
            <button
              type="button"
              onClick={close}
              aria-label="Close Ask Drin"
              className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

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
