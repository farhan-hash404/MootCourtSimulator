import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

/**
 * The chamber — a 2.5D courtroom drawn as one inline SVG.
 *
 * This is pure presentation. It renders no data of its own: the judge, the two
 * advocates and the witness are lit entirely from `activity`, which the session
 * page derives from the same session turns and live voice cues the record is
 * built from. Nothing here calls the API, and nothing here decides who is
 * speaking — it only shows it. A courtroom is wood and low light whether the
 * page around it is parchment or midnight, so the stage keeps its own warm
 * palette (--wood-*, --stage-*, --spot in index.css) rather than the page's.
 *
 * SVG rather than a WebGL engine on purpose: at four figures and a fixed camera
 * a hand-built vector stage gives depth, crisp text for the nameplates and
 * perfect theme-awareness for a fraction of the weight, which is the trade the
 * project asks for (no heavy 3D where 2.5D will do).
 */

export type CourtActor = "you" | "judge" | "opposing" | "witness";
export type SceneMode = "speaking" | "thinking" | "idle";

export interface SceneActivity {
  actor: CourtActor | null;
  mode: SceneMode;
}

export interface CourtroomSceneProps {
  activity: SceneActivity;
  phaseLabel: string;
  youLabel: string;
  opposingLabel: string;
  /** Non-null once a witness has been called; drives the entrance onto the stand. */
  witnessOnStand: { name: string; role?: string } | null;
  /** The bench's most recent disposition, stamped briefly on the bench front. */
  lastRuling?: "SUSTAINED" | "OVERRULED" | null;
}

/** Where each figure's head sits, for spotlight, glow and speaking cues. */
const ANCHOR: Record<CourtActor, { x: number; y: number }> = {
  judge: { x: 600, y: 292 },
  witness: { x: 372, y: 352 },
  you: { x: 250, y: 520 },
  opposing: { x: 950, y: 520 },
};

const HEAD = "hsl(35 28% 71%)"; // one stage-lit stone tone, both themes
const HEAD_SHADE = "hsl(30 26% 60%)";

/* ------------------------------------------------------------------ *
 * Figures. Near-silhouettes, not portraits: a robe, a collar and the
 * white bands a Pakistani advocate actually wears, with one reserved
 * accent per role. No faces — a courtroom sketch reads as dignified
 * exactly where a cartoon face would not.
 * ------------------------------------------------------------------ */

export type FigureVariant = "judge" | "you" | "opposing" | "witness";

/**
 * Exported so the landing hero (`chamber-curtain.tsx`) draws the same people
 * this stage does. Two hand-built figure sets would drift apart on the first
 * edit to either, and the figures are the part a viewer recognises.
 */
export function Figure({ variant }: { variant: FigureVariant }) {
  // Robe/coat colour and the one accent that tells the role apart.
  const robe =
    variant === "witness" ? "hsl(215 16% 30%)" : "hsl(220 26% 11%)";
  const robeLight =
    variant === "witness" ? "hsl(215 16% 38%)" : "hsl(220 22% 17%)";
  const accent =
    variant === "judge"
      ? "hsl(var(--primary))"
      : variant === "you"
        ? "hsl(var(--seal))"
        : variant === "opposing"
          ? "hsl(var(--stamp))"
          : "hsl(var(--muted-foreground))";

  return (
    <g>
      {/* shoulders / robe */}
      <path
        d="M -66 150 C -60 74 -34 44 0 44 C 34 44 60 74 66 150 Z"
        fill={robe}
      />
      {/* lit near shoulder, for a little roundness */}
      <path
        d="M -66 150 C -60 74 -40 48 -6 46 L -10 150 Z"
        fill={robeLight}
        opacity="0.6"
      />
      {/* collar / shirt V */}
      <path d="M -16 50 L 0 92 L 16 50 Z" fill="hsl(40 30% 92%)" />
      {/* the two white bands */}
      <path d="M -7 54 L -3 82 L 0 72 Z" fill="hsl(40 30% 96%)" />
      <path d="M 7 54 L 3 82 L 0 72 Z" fill="hsl(40 30% 96%)" />
      {/* role accent — judge sash / advocate lapel flash / witness none-bright */}
      {variant === "judge" ? (
        <>
          <path d="M -18 52 L -30 150 L -20 150 L -10 58 Z" fill={accent} opacity="0.9" />
          <path d="M 18 52 L 30 150 L 20 150 L 10 58 Z" fill={accent} opacity="0.9" />
        </>
      ) : (
        <path
          d={
            variant === "witness"
              ? "M -14 54 L -18 120 L -12 120 L -9 56 Z"
              : "M 12 52 L 26 108 L 18 112 L 8 58 Z"
          }
          fill={accent}
          opacity={variant === "witness" ? "0.5" : "0.85"}
        />
      )}
      {/* neck */}
      <rect x="-8" y="30" width="16" height="20" rx="6" fill={HEAD_SHADE} />
      {/* head */}
      <ellipse cx="0" cy="14" rx="19" ry="21" fill={HEAD} />
      <path d="M -19 12 A 19 21 0 0 0 0 35 L 0 -7 Z" fill={HEAD_SHADE} opacity="0.5" />
      {/* judge wears the suggestion of a hairline/wig band; others hair */}
      <path
        d="M -19 8 C -17 -14 17 -14 19 8 C 12 -2 -12 -2 -19 8 Z"
        fill={variant === "judge" ? "hsl(40 20% 88%)" : "hsl(220 20% 9%)"}
      />
    </g>
  );
}

/** Small brass nameplate with engraved label. */
function Nameplate({
  x,
  y,
  w,
  label,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={-w / 2}
        y={0}
        width={w}
        height={19}
        rx={2.5}
        fill="hsl(var(--gold))"
      />
      <rect
        x={-w / 2}
        y={0}
        width={w}
        height={19}
        rx={2.5}
        fill="none"
        stroke="hsl(40 60% 22%)"
        strokeOpacity="0.5"
      />
      <text
        x={0}
        y={13.5}
        textAnchor="middle"
        fontFamily="'Courier Prime', monospace"
        fontSize="11"
        letterSpacing="0.5"
        fill="hsl(30 45% 14%)"
        style={{ textTransform: "uppercase" }}
      >
        {label}
      </text>
    </g>
  );
}

/** Bars over the head of whoever is speaking; a slow pulse while the court thinks. */
function SpeakingCue({
  actor,
  mode,
  reduce,
}: {
  actor: CourtActor;
  mode: SceneMode;
  reduce: boolean | null;
}) {
  const { x, y } = ANCHOR[actor];
  const top = y - 52;

  if (mode === "thinking") {
    return (
      <g transform={`translate(${x} ${top})`}>
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={(i - 1) * 12}
            cy={0}
            r={3.4}
            fill="hsl(var(--gold))"
            animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.18,
              ease: "easeInOut",
            }}
          />
        ))}
      </g>
    );
  }

  if (mode !== "speaking") return null;
  const bars = [0, 1, 2, 3];
  return (
    <g transform={`translate(${x} ${top})`}>
      {bars.map((i) => (
        <motion.rect
          key={i}
          x={(i - 2) * 7 + 1}
          width={4}
          rx={2}
          fill="hsl(var(--gold))"
          initial={{ height: 6, y: -3 }}
          animate={
            reduce
              ? { height: 12, y: -6 }
              : { height: [6, 20, 9, 16, 6], y: [-3, -10, -4.5, -8, -3] }
          }
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </g>
  );
}

export function CourtroomScene({
  activity,
  phaseLabel,
  youLabel,
  opposingLabel,
  witnessOnStand,
  lastRuling,
}: CourtroomSceneProps) {
  const reduce = useReducedMotion();
  const active = activity.actor;

  // The moving spotlight rests on the bench when nobody holds the floor.
  const spot = useMemo(() => ANCHOR[active ?? "judge"], [active]);

  const glowFor = (actor: CourtActor) =>
    active === actor ? (activity.mode === "idle" ? 0.4 : 0.85) : 0;

  return (
    <div className="courtroom-stage aspect-[12/7] w-full">
      <svg
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label={
          active
            ? `Courtroom — ${
                active === "you"
                  ? "you have"
                  : active === "judge"
                    ? "the bench has"
                    : active === "opposing"
                      ? "opposing counsel has"
                      : "the witness has"
              } the floor`
            : "Courtroom, in session"
        }
      >
        <defs>
          <radialGradient id="spotGrad" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="hsl(var(--spot))" stopOpacity="0.5" />
            <stop offset="55%" stopColor="hsl(var(--spot))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--spot))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ambient" cx="50%" cy="18%" r="85%">
            <stop offset="0%" stopColor="hsl(var(--stage-air))" stopOpacity="0.0" />
            <stop offset="100%" stopColor="hsl(var(--wood-4))" stopOpacity="0.85" />
          </radialGradient>
          <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--stage-floor))" />
            <stop offset="100%" stopColor="hsl(var(--wood-4))" />
          </linearGradient>
          <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--wood-2))" />
            <stop offset="100%" stopColor="hsl(var(--wood-3))" />
          </linearGradient>
          <linearGradient id="tableGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--wood-1))" />
            <stop offset="100%" stopColor="hsl(var(--wood-3))" />
          </linearGradient>
        </defs>

        {/* ---- back wall & ambient ---- */}
        <rect x="0" y="0" width="1200" height="700" fill="hsl(var(--stage-air))" />
        {/* wall panelling */}
        <rect x="0" y="0" width="1200" height="430" fill="hsl(var(--wood-2))" />
        {Array.from({ length: 13 }, (_, i) => (
          <rect
            key={i}
            x={i * 96}
            y={0}
            width={4}
            height={430}
            fill="hsl(var(--wood-3))"
            opacity="0.7"
          />
        ))}
        {/* a lit band along the top of the panelling */}
        <rect x="0" y="0" width="1200" height="10" fill="hsl(var(--wood-1))" opacity="0.5" />

        {/* ---- emblem: the scales, in brass, above the bench ---- */}
        <g transform="translate(600 92)" stroke="hsl(var(--gold))" strokeWidth="2.4" fill="none" opacity="0.92">
          <circle cx="0" cy="0" r="52" strokeOpacity="0.5" />
          <line x1="0" y1="-34" x2="0" y2="26" />
          <path d="M -6 26 L 6 26 L 10 34 L -10 34 Z" fill="hsl(var(--gold))" stroke="none" />
          <line x1="-34" y1="-26" x2="34" y2="-26" />
          <circle cx="0" cy="-30" r="3.4" fill="hsl(var(--gold))" stroke="none" />
          {/* pans */}
          <line x1="-34" y1="-26" x2="-34" y2="-10" />
          <line x1="34" y1="-26" x2="34" y2="-10" />
          <path d="M -50 -10 A 16 10 0 0 0 -18 -10 Z" />
          <path d="M 18 -10 A 16 10 0 0 0 50 -10 Z" />
        </g>

        {/* ---- floor ---- */}
        <polygon points="0,430 1200,430 1200,700 0,700" fill="url(#floorGrad)" />
        {/* parquet perspective seams toward a point behind the bench */}
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

        {/* ---- moving spotlight (behind figures, warms whoever holds the floor) ---- */}
        <motion.ellipse
          rx="230"
          ry="250"
          fill="url(#spotGrad)"
          animate={{ cx: spot.x, cy: spot.y - 40 }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        />

        {/* ================= WITNESS STAND (viewer-left of bench) ================= */}
        <g>
          {/* per-figure warm glow when active */}
          <ellipse cx={ANCHOR.witness.x} cy={ANCHOR.witness.y - 6} rx="86" ry="96" fill="hsl(var(--spot))" opacity={glowFor("witness")} style={{ transition: "opacity 400ms" }} />
          {/* the witness only exists on stand once called */}
          <AnimatePresence>
            {witnessOnStand && (
              <motion.g
                key="witness-figure"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: -70, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -70 }}
                transition={{ type: "spring", stiffness: 90, damping: 16 }}
              >
                <g transform={`translate(${ANCHOR.witness.x} ${ANCHOR.witness.y}) scale(0.86)`}>
                  <Figure variant="witness" />
                </g>
              </motion.g>
            )}
          </AnimatePresence>
          {/* stand box + rail, drawn in front of the figure */}
          <polygon points="292,352 452,352 470,452 274,452" fill="url(#benchGrad)" />
          <polygon points="292,352 452,352 452,362 292,362" fill="hsl(var(--wood-1))" opacity="0.55" />
          <rect x="284" y="322" width="6" height="130" fill="hsl(var(--wood-3))" />
          <rect x="454" y="322" width="6" height="130" fill="hsl(var(--wood-3))" />
          <line x1="284" y1="330" x2="460" y2="330" stroke="hsl(var(--gold))" strokeWidth="3" opacity="0.8" />
          <Nameplate x={372} y={402} w={104} label="Witness" />
        </g>

        {/* ================= JUDGE'S BENCH (elevated, centre-back) ================= */}
        <g>
          {/* dais step */}
          <polygon points="430,430 770,430 770,452 430,452" fill="hsl(var(--wood-4))" />
          <ellipse cx={ANCHOR.judge.x} cy={ANCHOR.judge.y} rx="120" ry="120" fill="hsl(var(--spot))" opacity={glowFor("judge")} style={{ transition: "opacity 400ms" }} />
          {/* high-backed chair behind the judge */}
          <rect x="560" y="196" width="80" height="150" rx="14" fill="hsl(var(--wood-4))" />
          {/* judge figure */}
          <g transform={`translate(${ANCHOR.judge.x} ${ANCHOR.judge.y}) scale(1.05)`}>
            <Figure variant="judge" />
          </g>
          {/* the bench desk, in front */}
          <polygon points="446,352 754,352 780,432 420,432" fill="url(#benchGrad)" />
          <polygon points="446,352 754,352 754,366 446,366" fill="hsl(var(--wood-1))" opacity="0.6" />
          {/* panel mouldings */}
          <rect x="470" y="378" width="120" height="42" rx="3" fill="none" stroke="hsl(var(--wood-4))" strokeOpacity="0.6" strokeWidth="2" />
          <rect x="610" y="378" width="120" height="42" rx="3" fill="none" stroke="hsl(var(--wood-4))" strokeOpacity="0.6" strokeWidth="2" />
          {/* gavel + sound block on the bench top */}
          <g transform="translate(700 348)">
            <rect x="-16" y="0" width="32" height="7" rx="2" fill="hsl(var(--wood-4))" />
            <rect x="-14" y="-9" width="20" height="8" rx="3" fill="hsl(30 40% 30%)" transform="rotate(-18 -4 -5)" />
            <rect x="4" y="-16" width="5" height="18" rx="2" fill="hsl(30 40% 34%)" transform="rotate(-18 6 -7)" />
          </g>
          <Nameplate x={534} y={392} w={128} label="The Bench" />
          {/* brief ruling stamp on the bench front */}
          <AnimatePresence>
            {lastRuling && (
              <motion.g
                key={`ruling-${lastRuling}`}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <rect
                  x={620}
                  y={384}
                  width={104}
                  height={30}
                  rx={3}
                  fill="none"
                  stroke={lastRuling === "SUSTAINED" ? "hsl(var(--seal))" : "hsl(var(--stamp))"}
                  strokeWidth="2.5"
                />
                <text
                  x={672}
                  y={404}
                  textAnchor="middle"
                  fontFamily="'Courier Prime', monospace"
                  fontSize="12"
                  fontWeight="700"
                  letterSpacing="1"
                  fill={lastRuling === "SUSTAINED" ? "hsl(var(--seal))" : "hsl(var(--stamp))"}
                >
                  {lastRuling}
                </text>
              </motion.g>
            )}
          </AnimatePresence>
        </g>

        {/* the bar — a low rail across the well, separating gallery from counsel */}
        <line x1="60" y1="474" x2="1140" y2="474" stroke="hsl(var(--wood-4))" strokeOpacity="0.5" strokeWidth="3" />

        {/* ================= COUNSEL TABLES (foreground) ================= */}
        {/* You */}
        <g>
          <ellipse cx={ANCHOR.you.x} cy={ANCHOR.you.y} rx="120" ry="118" fill="hsl(var(--spot))" opacity={glowFor("you")} style={{ transition: "opacity 400ms" }} />
          <g transform={`translate(${ANCHOR.you.x} ${ANCHOR.you.y}) scale(1.16)`}>
            <Figure variant="you" />
          </g>
          <polygon points="96,592 404,592 428,672 72,672" fill="url(#tableGrad)" />
          <polygon points="96,592 404,592 404,606 96,606" fill="hsl(var(--wood-1))" opacity="0.7" />
          {/* a document + a small microphone on the table */}
          <rect x="150" y="600" width="52" height="30" rx="1.5" fill="hsl(40 24% 88%)" transform="rotate(-6 176 615)" />
          <g transform="translate(320 600)">
            <rect x="-1.5" y="0" width="3" height="18" fill="hsl(var(--wood-4))" />
            <ellipse cx="0" cy="-2" rx="4.5" ry="7" fill="hsl(220 10% 30%)" />
          </g>
          <Nameplate x={250} y={628} w={148} label={youLabel} />
        </g>
        {/* Opposing */}
        <g>
          <ellipse cx={ANCHOR.opposing.x} cy={ANCHOR.opposing.y} rx="120" ry="118" fill="hsl(var(--spot))" opacity={glowFor("opposing")} style={{ transition: "opacity 400ms" }} />
          <g transform={`translate(${ANCHOR.opposing.x} ${ANCHOR.opposing.y}) scale(1.16)`}>
            <Figure variant="opposing" />
          </g>
          <polygon points="796,592 1104,592 1128,672 772,672" fill="url(#tableGrad)" />
          <polygon points="796,592 1104,592 1104,606 796,606" fill="hsl(var(--wood-1))" opacity="0.7" />
          <rect x="998" y="600" width="52" height="30" rx="1.5" fill="hsl(40 24% 88%)" transform="rotate(6 1024 615)" />
          <g transform="translate(880 600)">
            <rect x="-1.5" y="0" width="3" height="18" fill="hsl(var(--wood-4))" />
            <ellipse cx="0" cy="-2" rx="4.5" ry="7" fill="hsl(220 10% 30%)" />
          </g>
          <Nameplate x={950} y={628} w={148} label={opposingLabel} />
        </g>

        {/* ---- speaking / thinking cue over the active figure ---- */}
        {active && <SpeakingCue actor={active} mode={activity.mode} reduce={reduce} />}

        {/* ---- ambient vignette to seat the scene ---- */}
        <rect x="0" y="0" width="1200" height="700" fill="url(#ambient)" pointerEvents="none" />

        {/* ---- phase, etched top-left ---- */}
        <text
          x="34"
          y="42"
          fontFamily="'Courier Prime', monospace"
          fontSize="13"
          letterSpacing="1.5"
          fill="hsl(var(--spot))"
          fillOpacity="0.72"
          style={{ textTransform: "uppercase" }}
        >
          {phaseLabel}
        </text>
      </svg>

      {/* A live label naming who holds the floor, over the stage. */}
      <FloorLabel activity={activity} witnessOnStand={witnessOnStand} />
    </div>
  );
}

function FloorLabel({
  activity,
  witnessOnStand,
}: {
  activity: SceneActivity;
  witnessOnStand: { name: string; role?: string } | null;
}) {
  const { actor, mode } = activity;
  let text: string | null = null;
  if (mode === "thinking") text = "The court is considering";
  else if (actor === "you") text = "You have the floor";
  else if (actor === "judge") text = "The bench is speaking";
  else if (actor === "opposing") text = "Opposing counsel is speaking";
  else if (actor === "witness")
    text = witnessOnStand
      ? `${witnessOnStand.name} is testifying`
      : "The witness is testifying";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
      <AnimatePresence mode="wait">
        {text && (
          <motion.p
            key={text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="apparatus rounded-sm bg-black/45 px-2.5 py-1 text-[hsl(var(--spot))] backdrop-blur-sm"
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {witnessOnStand && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="apparatus rounded-sm border border-gold/40 bg-black/45 px-2.5 py-1 text-gold backdrop-blur-sm"
          >
            Witness called — {witnessOnStand.name}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
