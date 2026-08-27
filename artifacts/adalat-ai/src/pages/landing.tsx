import { motion } from "framer-motion";
import { Link } from "wouter";
import { ChamberCurtain } from "@/components/chamber-curtain";
import { ThemeToggle } from "@/components/layout";
import { Button } from "@/components/ui/button";

/**
 * The public face of the record.
 *
 * Set as a cause list, like every other page: apparatus eyebrow, one light
 * serif line, a double rule, then the matter itself. The one departure is that
 * the matter here is the chamber — a lit room cut into a printed sheet, which
 * is the single thing on this page that does not answer to the page's theme.
 *
 * Deliberately outside Layout and outside AuthGate. Layout's nav is a
 * signed-in affordance and a visitor has nowhere to go with it; AuthGate would
 * hide the whole page behind a sign-in form, which is the opposite of what a
 * landing page is for.
 *
 * The masthead does not animate. A cause list is printed before the court
 * sits — only the room is staged, and it stages itself in ChamberCurtain.
 */

/** What the corpus actually contains. Counts are the ingested provisions. */
const INSTRUMENTS = [
  { name: "Qanun-e-Shahadat Order", year: "1984", count: "20 articles" },
  { name: "Pakistan Penal Code", year: "1860", count: "15 sections" },
  { name: "Code of Criminal Procedure", year: "1898", count: "10 sections" },
  { name: "Constitution of Pakistan", year: "1973", count: "8 articles" },
];

const SITTING = [
  {
    n: "01",
    head: "Open the matter",
    body: "Take a cause from the list, or have one drafted for you. You pick a side and the bench takes the other.",
  },
  {
    n: "02",
    head: "Hold the floor",
    body: "Speak your submission aloud. Opposing counsel objects while you are still speaking, and the bench rules before you go on.",
  },
  {
    n: "03",
    head: "Take the verdict",
    body: "The bench scores the reasoning and shows every provision it checked, including the ones it refused to accept.",
  },
];

/** A section that settles into place on scroll. Opacity and 6px, no more. */
const settle = {
  initial: { opacity: 0, y: 6 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 flex-col">
            <span className="whitespace-nowrap font-serif text-[1.375rem] font-normal leading-none tracking-[-0.02em] text-foreground">
              CourtSimulator
            </span>
            <span className="apparatus mt-1 text-muted-foreground">
              Pakistan superior judiciary
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/cases"
              className="apparatus border-b-2 border-transparent pb-0.5 pt-1 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              Enter
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* ---- masthead: printed, not staged ---- */}
        <p className="apparatus text-muted-foreground">
          Moot chamber · Voice-first
        </p>
        <h1 className="display mt-3">The chamber, in session.</h1>
        <p className="standfirst mt-4">
          Argue a matter aloud before an AI bench. It objects, rules, and
          grounds every citation in Pakistani law.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button asChild size="lg">
            <Link href="/cases">Enter the chamber</Link>
          </Button>
          <p className="apparatus text-muted-foreground">
            53 provisions · Verified against official prints
          </p>
        </div>

        <div className="masthead-rule mt-7" />

        {/* ---- the matter itself: a lit room cut into the sheet ---- */}
        <div className="mt-7">
          <ChamberCurtain />
        </div>

        {/* ---- what the record is grounded in ---- */}
        <motion.section {...settle} className="mt-14">
          <h2 className="rule-heading">
            <span>Grounded in</span>
            <span>53 provisions</span>
          </h2>
          <ul>
            {INSTRUMENTS.map((item) => (
              <li
                key={item.name}
                className="flex items-baseline justify-between gap-4 border-b border-rule py-3.5"
              >
                <span className="font-serif text-[1.0625rem] leading-snug text-foreground">
                  {item.name}{" "}
                  <span className="text-muted-foreground">{item.year}</span>
                </span>
                <span className="apparatus shrink-0 text-muted-foreground">
                  {item.count}
                </span>
              </li>
            ))}
          </ul>
          <p className="apparatus mt-3 text-muted-foreground">
            Each diffed word for word against the official print before it was
            indexed.
          </p>
        </motion.section>

        {/* ---- how a sitting runs ---- */}
        <motion.section {...settle} className="mt-14">
          <h2 className="rule-heading">
            <span>How a sitting runs</span>
            <span>Three stages</span>
          </h2>
          <ol>
            {SITTING.map((step) => (
              <li
                key={step.n}
                className="flex gap-5 border-b border-rule py-5 sm:gap-8"
              >
                <span className="apparatus shrink-0 pt-1 text-muted-foreground">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-serif text-[1.0625rem] leading-snug text-foreground">
                    {step.head}
                  </h3>
                  {/* Body size, not an ad-hoc one. A 0.9375rem here added an
                      eighth type size to the page for no gain. */}
                  <p className="mt-1.5 max-w-xl leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </motion.section>
      </main>

      <footer className="mt-auto border-t border-rule">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:px-6 lg:px-8">
          <p className="apparatus text-muted-foreground">
            Grounded in PPC 1860 · CrPC 1898 · QSO 1984 · Constitution 1973
          </p>
          <p className="apparatus text-muted-foreground">CourtSimulator · 2026</p>
        </div>
      </footer>
    </div>
  );
}
