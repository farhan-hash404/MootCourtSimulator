import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Figure } from "@/components/courtroom-scene";

/**
 * The court assembling itself — the landing hero.
 *
 * Sibling of `courtroom-scene.tsx`, not a replacement for it. That stage is
 * lit from live session state and never animates its furniture; this one has no
 * state at all and animates nothing else. Splitting them keeps a cinematic
 * entrance out of the component the session view depends on, which is not a
 * thing to be editing in the week of a viva. The figures are imported rather
 * than redrawn, because the people are what a viewer recognises and two
 * hand-built sets would drift on the first edit to either.
 *
 * The room builds back to front — air, floor, bench, rails, then the people
 * rise into place and the gallery light comes up last. That order is the whole
 * effect: a room being made ready, not a picture fading in.
 *
 * Three things bound it, and all three are the design rather than politeness:
 *   - CURTAIN_MS caps the sequence. A judge reloading mid-demo must not wait.
 *   - It plays once per session. sessionStorage, not localStorage: a fresh
 *     browser session at the venue should still get the opening beat.
 *   - prefers-reduced-motion drops straight to the final frame.
 */

/** Total sequence length. The last beat resolves inside this. */
const CURTAIN_MS = 1200;

/** A decelerating settle. Things come to rest like a gavel set down. */
const EASE = [0.22, 1, 0.36, 1] as const;

const PLAYED_KEY = "adalat-curtain-played";

/** Was the opening beat already spent in this browser session? */
function alreadyPlayed(): boolean {
  try {
    return sessionStorage.getItem(PLAYED_KEY) === "1";
  } catch {
    // Private mode and locked-down profiles throw on access. Losing the
    // once-per-session guarantee is a far smaller failure than a blank hero.
    return false;
  }
}

function markPlayed(): void {
  try {
    sessionStorage.setItem(PLAYED_KEY, "1");
  } catch {
    /* see alreadyPlayed */
  }
}

export function ChamberCurtain() {
  const reduce = useReducedMotion();
  // Resolved once, at mount: flipping mid-sequence would restart every spring.
  const [skipped, setSkipped] = useState(() => alreadyPlayed());
  const instant = Boolean(reduce) || skipped;

  useEffect(() => {
    if (instant) return;
    markPlayed();
    const timer = window.setTimeout(() => setSkipped(true), CURTAIN_MS);
    const onKey = () => setSkipped(true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [instant]);

  /**
   * One element's entrance, as a complete set of motion props.
   *
   * When the sequence is not playing this returns `initial={false}`, which
   * mounts the element at its final values with no transition at all. That is
   * not a shortcut — it is the point. Every element's *resting* state here is
   * opacity 0, so anything that stops an animation from running leaves a blank
   * stage: a throttled requestAnimationFrame in a background tab, a device in
   * low-power mode, a first frame that arrives late on a venue laptop. With
   * `initial={false}` the finished scene depends on no animation frame ever
   * arriving, and reduced-motion gets the completed room instantly rather than
   * a fade it did not ask for.
   */
  const enter = ({
    at,
    dy = 0,
    to = 1,
    ms = 440,
    scaleFrom,
  }: {
    at: number;
    dy?: number;
    to?: number;
    ms?: number;
    scaleFrom?: number;
  }) =>
    instant
      ? {
          initial: false as const,
          animate: { opacity: to, y: 0, ...(scaleFrom ? { scale: 1 } : {}) },
        }
      : {
          initial: {
            opacity: 0,
            ...(dy ? { y: dy } : {}),
            ...(scaleFrom ? { scale: scaleFrom } : {}),
          },
          animate: { opacity: to, y: 0, ...(scaleFrom ? { scale: 1 } : {}) },
          transition: { duration: ms / 1000, delay: at / 1000, ease: EASE },
        };

  return (
    <div
      className="courtroom-stage aspect-[12/7] w-full"
      onClick={() => setSkipped(true)}
    >
      <svg
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label="A courtroom being made ready: the bench, the witness stand and two counsel tables under a warm gallery light."
      >
        <defs>
          <radialGradient id="curtain-spot" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="hsl(var(--spot))" stopOpacity="0.5" />
            <stop offset="55%" stopColor="hsl(var(--spot))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--spot))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="curtain-ambient" cx="50%" cy="18%" r="85%">
            <stop offset="0%" stopColor="hsl(var(--stage-air))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--wood-4))" stopOpacity="0.85" />
          </radialGradient>
          <linearGradient id="curtain-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--stage-floor))" />
            <stop offset="100%" stopColor="hsl(var(--wood-4))" />
          </linearGradient>
          <linearGradient id="curtain-bench" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--wood-2))" />
            <stop offset="100%" stopColor="hsl(var(--wood-3))" />
          </linearGradient>
          <linearGradient id="curtain-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--wood-1))" />
            <stop offset="100%" stopColor="hsl(var(--wood-3))" />
          </linearGradient>
        </defs>

        {/* ---- 1. the air, and the panelled wall behind everything ---- */}
        <motion.g {...enter({ at: 0, ms: 420 })}>
          <rect x="0" y="0" width="1200" height="700" fill="hsl(var(--stage-air))" />
          <rect x="0" y="0" width="1200" height="430" fill="hsl(var(--wood-2))" />
        </motion.g>

        {/* ---- 2. panel seams drop down the wall ---- */}
        <motion.g {...enter({ at: 90, to: 0.7, ms: 380 })}>
          {Array.from({ length: 13 }, (_, i) => (
            <rect key={i} x={i * 96} y={0} width={4} height={430} fill="hsl(var(--wood-3))" />
          ))}
          <rect x="0" y="0" width="1200" height="10" fill="hsl(var(--wood-1))" opacity="0.5" />
        </motion.g>

        {/* ---- 3. the floor comes up under the room ---- */}
        <motion.g {...enter({ at: 180, dy: 26, ms: 420 })}>
          <polygon points="0,430 1200,430 1200,700 0,700" fill="url(#curtain-floor)" />
          {Array.from({ length: 9 }, (_, i) => {
            const fx = (i - 4) * 150;
            return (
              <line
                key={i}
                x1={600 + fx}
                y1={700}
                x2={600 + fx * 0.16}
                y2={430}
                stroke="hsl(var(--wood-4))"
                strokeOpacity="0.35"
                strokeWidth="1.5"
              />
            );
          })}
          <line x1="0" y1="430" x2="1200" y2="430" stroke="hsl(var(--wood-4))" strokeOpacity="0.6" strokeWidth="2" />
        </motion.g>

        {/* ---- 4. the bench rises onto its dais ---- */}
        <motion.g {...enter({ at: 320, dy: 60, ms: 460 })}>
          <polygon points="430,430 770,430 770,452 430,452" fill="hsl(var(--wood-4))" />
          <rect x="560" y="196" width="80" height="150" rx="14" fill="hsl(var(--wood-4))" />
        </motion.g>

        {/* ---- 5. the witness stand ---- */}
        <motion.g {...enter({ at: 390, dy: 48, ms: 440 })}>
          <polygon points="292,352 452,352 470,452 274,452" fill="url(#curtain-bench)" />
          <polygon points="292,352 452,352 452,362 292,362" fill="hsl(var(--wood-1))" opacity="0.55" />
          <rect x="284" y="322" width="6" height="130" fill="hsl(var(--wood-3))" />
          <rect x="454" y="322" width="6" height="130" fill="hsl(var(--wood-3))" />
          <line x1="284" y1="330" x2="460" y2="330" stroke="hsl(var(--gold))" strokeWidth="3" opacity="0.8" />
        </motion.g>

        {/* ---- 6. the people take their places ---- */}
        {(
          [
            { variant: "judge", x: 600, y: 292, scale: 1.05, at: 620 },
            { variant: "witness", x: 372, y: 352, scale: 0.86, at: 690 },
            { variant: "you", x: 250, y: 520, scale: 1.16, at: 760 },
            { variant: "opposing", x: 950, y: 520, scale: 1.16, at: 830 },
          ] as const
        ).map((who) => (
          <motion.g key={who.variant} {...enter({ at: who.at, dy: 40, ms: 420 })}>
            <g transform={`translate(${who.x} ${who.y}) scale(${who.scale})`}>
              <Figure variant={who.variant} />
            </g>
          </motion.g>
        ))}

        {/* ---- 7. the bench desk closes in front of the judge ---- */}
        <motion.g {...enter({ at: 700, dy: 34, ms: 440 })}>
          <polygon points="446,352 754,352 780,432 420,432" fill="url(#curtain-bench)" />
          <polygon points="446,352 754,352 754,366 446,366" fill="hsl(var(--wood-1))" opacity="0.6" />
          <rect x="470" y="378" width="120" height="42" rx="3" fill="none" stroke="hsl(var(--wood-4))" strokeOpacity="0.6" strokeWidth="2" />
          <rect x="610" y="378" width="120" height="42" rx="3" fill="none" stroke="hsl(var(--wood-4))" strokeOpacity="0.6" strokeWidth="2" />
          {/* gavel and sound block, set down on the bench top */}
          <g transform="translate(700 348)">
            <rect x="-16" y="0" width="32" height="7" rx="2" fill="hsl(var(--wood-4))" />
            <rect x="-14" y="-9" width="20" height="8" rx="3" fill="hsl(30 40% 30%)" transform="rotate(-18 -4 -5)" />
            <rect x="4" y="-16" width="5" height="18" rx="2" fill="hsl(30 40% 34%)" transform="rotate(-18 6 -7)" />
          </g>
        </motion.g>

        {/* ---- 8. the bar, drawn across the well ---- */}
        <motion.line
          x1="60" y1="474" x2="1140" y2="474"
          stroke="hsl(var(--wood-4))" strokeOpacity="0.5" strokeWidth="3"
          initial={instant ? false : { pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={instant ? undefined : { duration: 0.42, delay: 0.54, ease: EASE }}
        />

        {/* ---- 9. counsel tables slide into the foreground ---- */}
        <motion.g {...enter({ at: 600, dy: 80, ms: 460 })}>
          <polygon points="96,592 404,592 428,672 72,672" fill="url(#curtain-table)" />
          <polygon points="96,592 404,592 404,606 96,606" fill="hsl(var(--wood-1))" opacity="0.7" />
          <rect x="150" y="600" width="52" height="30" rx="1.5" fill="hsl(40 24% 88%)" transform="rotate(-6 176 615)" />
          <g transform="translate(320 600)">
            <rect x="-1.5" y="0" width="3" height="18" fill="hsl(var(--wood-4))" />
            <ellipse cx="0" cy="-2" rx="4.5" ry="7" fill="hsl(220 10% 30%)" />
          </g>
        </motion.g>
        <motion.g {...enter({ at: 660, dy: 80, ms: 460 })}>
          <polygon points="796,592 1104,592 1128,672 772,672" fill="url(#curtain-table)" />
          <polygon points="796,592 1104,592 1104,606 796,606" fill="hsl(var(--wood-1))" opacity="0.7" />
          <rect x="998" y="600" width="52" height="30" rx="1.5" fill="hsl(40 24% 88%)" transform="rotate(6 1024 615)" />
          <g transform="translate(880 600)">
            <rect x="-1.5" y="0" width="3" height="18" fill="hsl(var(--wood-4))" />
            <ellipse cx="0" cy="-2" rx="4.5" ry="7" fill="hsl(220 10% 30%)" />
          </g>
        </motion.g>

        {/* ---- 10. the scales, struck in brass above the bench ---- */}
        <motion.g
          transform="translate(600 92)"
          stroke="hsl(var(--gold))"
          strokeWidth="2.4"
          fill="none"
          {...enter({ at: 430, to: 0.92, ms: 520, scaleFrom: 0.86 })}
          style={{ transformOrigin: "600px 92px" }}
        >
          <circle cx="0" cy="0" r="52" strokeOpacity="0.5" />
          <line x1="0" y1="-34" x2="0" y2="26" />
          <path d="M -6 26 L 6 26 L 10 34 L -10 34 Z" fill="hsl(var(--gold))" stroke="none" />
          <line x1="-34" y1="-26" x2="34" y2="-26" />
          <circle cx="0" cy="-30" r="3.4" fill="hsl(var(--gold))" stroke="none" />
          <line x1="-34" y1="-26" x2="-34" y2="-10" />
          <line x1="34" y1="-26" x2="34" y2="-10" />
          <path d="M -50 -10 A 16 10 0 0 0 -18 -10 Z" />
          <path d="M 18 -10 A 16 10 0 0 0 50 -10 Z" />
        </motion.g>

        {/* ---- 11. the gallery light comes up last ---- */}
        <motion.ellipse
          cx="600" cy="252" rx="230" ry="250"
          fill="url(#curtain-spot)"
          {...enter({ at: 860, ms: 340 })}
        />

        {/* Seats the lit scene inside the page. Never animated: the vignette is
            the frame, and a frame that fades in reads as a mistake. */}
        <rect x="0" y="0" width="1200" height="700" fill="url(#curtain-ambient)" pointerEvents="none" />

        <motion.text
          x="34" y="42"
          fontFamily="'Courier Prime', monospace"
          fontSize="13"
          letterSpacing="1.5"
          fill="hsl(var(--spot))"
          fillOpacity="0.72"
          style={{ textTransform: "uppercase" }}
          {...enter({ at: 980, ms: 300 })}
        >
          Court in session
        </motion.text>
      </svg>

      {/* Skip is a real control, not a click-anywhere secret: someone who wants
          the page now should be able to reach that with the keyboard. Removed
          from the tree the moment the sequence is spent, so it never sits over
          a finished scene. */}
      {!instant && (
        <button
          type="button"
          onClick={() => setSkipped(true)}
          className="apparatus absolute bottom-3 right-3 rounded-sm bg-black/45 px-2.5 py-1 text-[hsl(var(--spot))] backdrop-blur-sm transition-opacity hover:opacity-80"
        >
          Skip
        </button>
      )}
    </div>
  );
}
