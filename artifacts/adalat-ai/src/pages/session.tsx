import { useLocation } from "wouter";
import {
  useGetSession,
  useAdvanceSessionPhase,
  useCallWitness,
  useListObjectionGrounds,
  useRaiseObjection,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceControl } from "@/components/voice-control";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SessionPhase,
  SessionStatus,
  TurnSpeaker,
} from "@workspace/api-client-react";
import type { CourtReasoningStep } from "@workspace/api-client-react";
import { ChevronRight, Keyboard, Loader2, Mic, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiErrorState, getErrorMessage } from "@/components/api-state";
import { CaseBriefArgument } from "@/components/case-brief";
import { CaseName } from "@/components/case-name";
import {
  CourtroomScene,
  type CourtActor,
  type SceneActivity,
} from "@/components/courtroom-scene";
import { useToast } from "@/hooks/use-toast";
import { docket, phaseLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The raw turn's speaker as a stage actor, for the between-turns highlight. */
function turnActor(turn: {
  speaker: string;
  transcript: string;
}): CourtActor {
  if (/^\[OBJECTION:/.test(turn.transcript)) return "opposing";
  if (/^\[RULING:/.test(turn.transcript)) return "judge";
  if (turn.speaker === TurnSpeaker.student) return "you";
  if (turn.speaker === TurnSpeaker.judge) return "judge";
  if (turn.speaker === TurnSpeaker.opposing_counsel) return "opposing";
  return "witness";
}

type Mark = "objection" | "ruling" | "counsel" | "bench" | "witness";

interface ParsedTurn {
  mark: Mark;
  speaker: string;
  citation: string | null;
  ground: string | null;
  ruling: "SUSTAINED" | "OVERRULED" | null;
  text: string;
  reasoning: CourtReasoningStep[] | null;
}

function parseTurn(turn: {
  speaker: string;
  transcript: string;
  witnessName?: string | null;
  reasoning?: CourtReasoningStep[] | null;
}): ParsedTurn {
  const reasoning = turn.reasoning?.length ? turn.reasoning : null;
  const objection = turn.transcript.match(/^\[OBJECTION:\s*(.*?)\]\s*(.*)$/s);
  if (objection) {
    const [ground, citation] = objection[1].split("—").map((s) => s.trim());
    return {
      mark: "objection",
      speaker: "Opposing counsel",
      citation: citation || null,
      ground: ground || "Evidentiary objection",
      ruling: null,
      text: objection[2] ?? "",
      reasoning,
    };
  }

  const ruling = turn.transcript.match(
    /^\[RULING:\s*(SUSTAINED|OVERRULED)\]\s*(.*)$/s,
  );
  if (ruling) {
    return {
      mark: "ruling",
      speaker: "The bench",
      citation: null,
      ground: null,
      ruling: ruling[1] as "SUSTAINED" | "OVERRULED",
      text: ruling[2] ?? "",
      reasoning,
    };
  }

  if (turn.speaker === TurnSpeaker.student) {
    return {
      mark: "counsel",
      speaker: "You",
      citation: null,
      ground: null,
      ruling: null,
      text: turn.transcript,
      reasoning,
    };
  }
  if (turn.speaker === TurnSpeaker.judge) {
    return {
      mark: "bench",
      speaker: "The bench",
      citation: null,
      ground: null,
      ruling: null,
      text: turn.transcript,
      reasoning,
    };
  }
  if (turn.speaker === TurnSpeaker.opposing_counsel) {
    return {
      mark: "counsel",
      speaker: "Opposing counsel",
      citation: null,
      ground: null,
      ruling: null,
      text: turn.transcript,
      reasoning,
    };
  }
  return {
    mark: "witness",
    speaker: turn.witnessName ? `Witness — ${turn.witnessName}` : "Witness",
    citation: null,
    ground: null,
    ruling: null,
    text: turn.transcript,
    reasoning,
  };
}

/**
 * Where the hearing has reached.
 *
 * Five filled boxes in a grid read as a wizard, which invites a student to
 * click ahead through them; they are stages of a hearing that has to be
 * argued, not steps in a form. Set as a run of stage names with the current
 * one underlined — the same mark the nav and the tab heads use — and the ones
 * already risen from in muted text.
 */
function PhaseStrip({ phases, currentIndex }: { phases: string[]; currentIndex: number }) {
  return (
    <ol className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-rule/60 pt-3">
      {phases.map((phase, index) => {
        const isCurrent = index === currentIndex;
        const isPast = index < currentIndex;

        return (
          <li
            key={phase}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "apparatus flex items-baseline gap-1.5 border-b-2 pb-1",
              isCurrent
                ? "border-foreground text-foreground"
                : "border-transparent",
              isPast ? "text-muted-foreground" : "",
              !isCurrent && !isPast ? "text-muted-foreground/45" : "",
            )}
          >
            <span className="tabular-nums">{index + 1}</span>
            <span>{phaseLabel(phase)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function SessionPage({ id }: { id: string }) {
  const sessionId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    data: session,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSession(sessionId, {
    query: {
      queryKey: getGetSessionQueryKey(sessionId),
      enabled: Number.isInteger(sessionId) && sessionId > 0,
      refetchInterval: 3000,
    },
  });

  const { data: grounds = [] } = useListObjectionGrounds();
  const verifiedCitations = useMemo(
    () =>
      new Set(grounds.filter((g) => g.verified).map((g) => g.citation.trim())),
    [grounds],
  );

  const advancePhase = useAdvanceSessionPhase();
  const { toast } = useToast();

  // Who holds the floor, reported live by the rostrum's voice stream. Stable
  // callback so the effect inside VoiceControl doesn't re-fire every render.
  const [activity, setActivity] = useState<SceneActivity>({
    actor: null,
    mode: "idle",
  });
  const handleActivity = useCallback(
    (next: SceneActivity) => setActivity(next),
    [],
  );

  // The witness the student put on the stand. Held here so the figure appears
  // the moment the call succeeds, before the first testimony turn is polled.
  const [calledWitness, setCalledWitness] = useState<{
    name: string;
    role?: string;
  } | null>(null);

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [session?.turns.length]);

  useEffect(() => {
    if (session?.status === SessionStatus.completed) {
      setLocation(`/sessions/${sessionId}/verdict`);
    }
  }, [session?.status, sessionId, setLocation]);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return (
      <ApiErrorState error={new Error("This courtroom address is invalid.")} />
    );
  }

  if (isError) {
    return <ApiErrorState error={error} onRetry={() => void refetch()} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="apparatus text-muted-foreground">The court is rising</p>
        <p className="display-sm mt-3">Convening the chamber</p>
      </div>
    );
  }

  if (!session) return null;

  if (session.status === SessionStatus.completed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="apparatus text-muted-foreground">Hearing concluded</p>
        <p className="display-sm mt-3">The bench is writing its judgment</p>
      </div>
    );
  }

  const handleAdvancePhase = () => {
    const phases = Object.values(SessionPhase);
    const currentIndex = phases.indexOf(session.phase);
    const nextPhase = phases[currentIndex + 1];

    if (nextPhase) {
      advancePhase.mutate(
        { id: sessionId, data: { phase: nextPhase } },
        {
          onSuccess: (data) => {
            queryClient.setQueryData(getGetSessionQueryKey(sessionId), data);
            if (nextPhase === SessionPhase.verdict) {
              setLocation(`/sessions/${sessionId}/verdict`);
            }
          },
          onError: (error) => {
            toast({
              variant: "destructive",
              title: "The phase could not be advanced",
              description: getErrorMessage(error),
            });
          },
        },
      );
    }
  };

  const handleTurnComplete = () => {
    queryClient.invalidateQueries({
      queryKey: getGetSessionQueryKey(sessionId),
    });
  };

  const phases = Object.values(SessionPhase);
  const currentIndex = phases.indexOf(session.phase);

  const inExamination =
    session.phase === SessionPhase.witness_examination ||
    session.phase === SessionPhase.cross_examination;

  const turns = session.turns;
  const lastTurn = turns.length ? turns[turns.length - 1] : null;
  const lastParsed = lastTurn ? parseTurn(lastTurn) : null;
  const lastRuling = lastParsed?.ruling ?? null;

  // Live voice holds priority; between turns the stage rests a soft light on
  // whoever spoke last, so the chamber never reads as empty.
  const sceneActivity: SceneActivity =
    activity.actor !== null || activity.mode === "thinking"
      ? activity
      : lastTurn
        ? { actor: turnActor(lastTurn), mode: "idle" }
        : { actor: null, mode: "idle" };

  const lastWitnessName =
    [...turns].reverse().find((t) => t.witnessName)?.witnessName ?? null;
  const witnessName = calledWitness?.name ?? lastWitnessName ?? null;
  const witnessOnStand =
    inExamination && witnessName
      ? {
          name: witnessName,
          role: session.case.witnesses?.find((w) => w.name === witnessName)
            ?.role,
        }
      : null;

  const youLabel =
    session.studentSide === "petitioner"
      ? "Petitioner · You"
      : "Respondent · You";
  const opposingLabel =
    session.studentSide === "petitioner" ? "Respondent" : "Petitioner";
  const nextStageLabel =
    session.phase === SessionPhase.closing ? "Submit for judgment" : "Next stage";

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-6 pb-4">
      <header className="border-b border-rule pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="apparatus flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
              <span className="tabular-nums">{docket(session.id)}</span>
              <span aria-hidden="true">·</span>
              <span>{session.case.areaOfLaw}</span>
              <span aria-hidden="true">·</span>
              <span>for the {session.studentSide}</span>
            </p>

            <h1 className="display-sm mt-2">
              <CaseName title={session.case.title} />
            </h1>

            <p
              className="mt-2 truncate font-mono text-xs text-muted-foreground"
              title={session.case.applicableLaws}
            >
              {session.case.applicableLaws}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <PhaseStrip phases={phases} currentIndex={currentIndex} />
        </div>
      </header>

      {/* The chamber. The whole hearing is staged here; the record, the case
          papers and the controls sit over it rather than beside it. */}
      <CourtroomScene
        activity={sceneActivity}
        phaseLabel={phaseLabel(session.phase)}
        youLabel={youLabel}
        opposingLabel={opposingLabel}
        witnessOnStand={witnessOnStand}
        lastRuling={lastRuling}
      />

      {/* The last thing said, always on the sheet, opening the full record. */}
      <ChamberTicker
        parsed={lastParsed}
        count={turns.length}
        verifiedCitations={verifiedCitations}
        onOpen={() => setTranscriptOpen(true)}
      />

      {/* The courtroom controls — a floating bench of actions, not a toolbar. */}
      <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-1.5 rounded-full border border-rule bg-background/85 px-2.5 py-2 shadow-lg backdrop-blur-md sm:gap-2 sm:px-3">
        <Button variant="ghost" size="sm" onClick={() => setCaseOpen(true)}>
          Case
        </Button>

        <ObjectionDialog sessionId={sessionId} />

        {inExamination && (
          <CallWitnessDialog
            sessionId={sessionId}
            witnesses={session.case.witnesses}
            onCalled={setCalledWitness}
          />
        )}

        <RostrumPopover
          sessionId={sessionId}
          onTurnComplete={handleTurnComplete}
          onActivity={handleActivity}
        />

        <Button variant="ghost" size="sm" onClick={() => setTranscriptOpen(true)}>
          Transcript
        </Button>

        <Button
          size="sm"
          onClick={handleAdvancePhase}
          disabled={advancePhase.isPending}
        >
          {advancePhase.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          <span>{nextStageLabel}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* The record of proceedings — the honest core, kept verbatim, reachable
          as an overlay so the provenance rail is never more than a tap away. */}
      <Sheet open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-rule pb-3">
            <SheetTitle className="display-sm text-left">
              Record of proceedings
            </SheetTitle>
            <SheetDescription className="apparatus text-left">
              {turns.length} {turns.length === 1 ? "entry" : "entries"} · every
              citation checked against the corpus
            </SheetDescription>
          </SheetHeader>

          <ScrollArea ref={scrollRef} className="-mx-1 flex-1 px-1 py-2">
            {turns.length === 0 ? (
              <div className="flex min-h-[16rem] flex-col items-center justify-center px-6 text-center">
                <p className="display-sm">The court is in session.</p>
                <p className="mx-auto mt-3 max-w-md font-serif leading-relaxed text-muted-foreground">
                  The bench is seated and the record is open. Take the rostrum
                  and make your appearance.
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-rule/60">
                {turns.map((turn, index) => (
                  <RecordEntry
                    key={turn.id}
                    index={index + 1}
                    turn={parseTurn(turn)}
                    verifiedCitations={verifiedCitations}
                  />
                ))}
              </ol>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Case information — brief, witnesses and provisions in play. */}
      <Sheet open={caseOpen} onOpenChange={setCaseOpen}>
        <SheetContent
          side="left"
          className="flex w-full flex-col gap-0 sm:max-w-lg"
        >
          <SheetHeader className="border-b border-rule pb-3">
            <SheetTitle className="display-sm text-left">
              <CaseName title={session.case.title} />
            </SheetTitle>
            <SheetDescription className="apparatus text-left">
              {docket(session.id)} · {session.case.areaOfLaw} · for the{" "}
              {session.studentSide}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pt-4">
            <Tabs defaultValue="brief" className="flex flex-col">
              <TabsList>
                <TabsTrigger value="brief">Brief</TabsTrigger>
                <TabsTrigger value="witnesses">
                  Witnesses ({session.case.witnesses?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="statutes">Statutes</TabsTrigger>
              </TabsList>

              <TabsContent value="brief" className="pr-1">
                <p className="font-serif leading-relaxed text-foreground/85">
                  {session.case.summary}
                </p>
                {session.case.brief && (
                  <CaseBriefArgument brief={session.case.brief} />
                )}
              </TabsContent>

              <TabsContent value="witnesses" className="pr-1">
                <ul className="divide-y divide-rule/70">
                  {session.case.witnesses?.map((w, idx) => (
                    <li key={idx} className="py-3 first:pt-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-serif text-foreground">
                          {w.name}
                        </span>
                        <span className="apparatus shrink-0 text-muted-foreground">
                          {w.role}
                        </span>
                      </div>
                      <p className="mt-1 font-serif text-sm italic leading-relaxed text-foreground/75">
                        “{w.statement}”
                      </p>
                    </li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="statutes" className="pr-1">
                <p className="apparatus text-muted-foreground">
                  Provisions in play
                </p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-foreground/85">
                  {session.case.applicableLaws}
                </p>
                <p className="mt-4 border-t border-rule pt-3 font-serif text-sm leading-relaxed text-muted-foreground">
                  Every citation either side makes is checked against the corpus
                  before it reaches the record. One that is not in it is marked
                  as such.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * The last line spoken, held under the stage.
 *
 * The stage shows who is speaking; this shows what was said, and carries the
 * same verification badge the full record does — so a student watching the
 * chamber rather than the transcript still sees an unverified citation flagged
 * beside the words that leant on it. Tapping it opens the record in full.
 */
function ChamberTicker({
  parsed,
  count,
  verifiedCitations,
  onOpen,
}: {
  parsed: ParsedTurn | null;
  count: number;
  verifiedCitations: Set<string>;
  onOpen: () => void;
}) {
  const isVerified = parsed?.citation
    ? verifiedCitations.has(parsed.citation.trim())
    : false;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-sm text-left"
      aria-label="Open the record of proceedings"
    >
      <div data-mark={parsed?.mark} className="record-entry py-3 pr-3">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "apparatus",
              parsed?.mark === "objection" && "text-stamp",
              parsed?.mark === "ruling" && "text-primary",
              parsed?.mark === "witness" && "text-seal",
              parsed?.mark === "bench" && "text-primary",
              (!parsed || parsed.mark === "counsel") && "text-foreground",
            )}
          >
            {parsed ? parsed.speaker : "The record"}
          </span>
          <span className="apparatus shrink-0 text-muted-foreground">
            {count} {count === 1 ? "entry" : "entries"} · transcript ↗
          </span>
        </div>

        {parsed ? (
          <p className="mt-1.5 line-clamp-2 font-serif leading-snug text-foreground/85">
            {parsed.ground && (
              <span className="text-stamp">Objection — {parsed.ground}. </span>
            )}
            {parsed.ruling && (
              <span
                className={
                  parsed.ruling === "SUSTAINED" ? "text-seal" : "text-stamp"
                }
              >
                {parsed.ruling}.{" "}
              </span>
            )}
            {parsed.text}
          </p>
        ) : (
          <p className="mt-1.5 font-serif leading-snug text-muted-foreground">
            The bench is seated and the record is open. Take the rostrum and make
            your appearance.
          </p>
        )}

        {parsed?.citation && (
          <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-xs text-foreground/80">
              {parsed.citation}
            </span>
            <span
              className={cn("apparatus", isVerified ? "text-seal" : "text-stamp")}
              title={
                isVerified
                  ? "Diffed word-for-word against its official source."
                  : "This provision's text has not been checked against pakistancode.gov.pk. Do not quote it as authoritative."
              }
            >
              {isVerified ? "✓ Verified" : "⚠ Unverified"}
            </span>
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * One paragraph of the record.
 *
 * The provenance rail on the right is the point of the whole layout: every
 * provision an agent leant on is shown beside the words it produced, with its
 * verification state attached. The mark is per provision, not per instrument:
 * one diffed against pakistancode.gov.pk reads Verified in seal green while
 * one still under review reads Unverified in stamp red, even where both come
 * from the same Act — which is exactly what a student needs to see before
 * repeating any of it in a real courtroom.
 */
function RecordEntry({
  index,
  turn,
  verifiedCitations,
}: {
  index: number;
  turn: ParsedTurn;
  verifiedCitations: Set<string>;
}) {
  const isVerified = turn.citation
    ? verifiedCitations.has(turn.citation.trim())
    : false;

  return (
    <li
      data-mark={turn.mark}
      className={cn(
        "record-entry py-4",
        // Only the two marks a student must not miss keep a wash behind them.
        // Counsel and the bench are told apart by the rule and the name, the
        // way a transcript tells them apart.
        turn.mark === "objection" && "pl-4 pr-3",
        turn.mark === "ruling" && "pl-4 pr-3",
      )}
    >
      <div className="grid gap-x-5 gap-y-2 lg:grid-cols-[8.5rem_1fr_7.5rem]">
        <div className="flex items-baseline gap-2 lg:flex-col lg:gap-1">
          <span className="apparatus tabular-nums text-muted-foreground/70">
            ¶{String(index).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "apparatus",
              turn.mark === "objection" && "text-stamp",
              turn.mark === "ruling" && "text-primary",
              turn.mark === "witness" && "text-seal",
              turn.mark === "counsel" && "text-foreground",
              turn.mark === "bench" && "text-primary",
            )}
          >
            {turn.speaker}
          </span>
        </div>

        <div className="min-w-0 space-y-2">
          {turn.ground && (
            <p className="apparatus text-stamp">Objection — {turn.ground}</p>
          )}

          {turn.ruling && (
            <p>
              <span
                className={
                  turn.ruling === "SUSTAINED"
                    ? "judicial-stamp-sustained"
                    : "judicial-stamp-overruled"
                }
              >
                {turn.ruling}
              </span>
            </p>
          )}

          <p className="font-serif text-[1.0625rem] leading-relaxed text-foreground">
            {turn.text}
          </p>

          {turn.reasoning && <ReasoningTrace steps={turn.reasoning} />}
        </div>

        {/* The provenance rail. Never conditional on how tidy the output
            looks: an unverified provision says so beside the words that
            leant on it, every time. */}
        <div className="flex flex-row flex-wrap items-baseline gap-x-2 gap-y-1 lg:flex-col lg:items-end">
          {turn.citation && (
            <>
              <span className="font-mono text-xs text-foreground/80">
                {turn.citation}
              </span>
              <span
                className={cn(
                  "apparatus",
                  isVerified ? "text-seal" : "text-stamp",
                )}
                title={
                  isVerified
                    ? "Diffed word-for-word against its official source."
                    : "This provision's text has not been checked against pakistancode.gov.pk. Do not quote it as authoritative."
                }
              >
                {isVerified ? "✓ Verified" : "⚠ Unverified"}
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function ReasoningTrace({ steps }: { steps: CourtReasoningStep[] }) {
  return (
    <details className="group mt-2 border-l border-rule pl-3">
      <summary className="apparatus inline-flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        <span>
          How the bench got there ({steps.length}{" "}
          {steps.length === 1 ? "step" : "steps"})
        </span>
      </summary>

      <ol className="mt-2.5 space-y-2.5">
        {steps.map((step, index) => (
          <li key={index} className="space-y-0.5">
            <p className="apparatus text-muted-foreground/70 tabular-nums">
              {index + 1}
            </p>
            {step.thought && (
              <p className="font-serif text-sm italic leading-snug text-foreground/85">
                {step.thought}
              </p>
            )}
            {step.action && (
              <p className="break-all font-mono text-xs leading-snug text-primary">
                {step.action}
              </p>
            )}
            {step.observation && (
              <p className="font-serif text-sm leading-snug text-foreground/60">
                {step.observation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function CallWitnessDialog({
  sessionId,
  witnesses,
  onCalled,
}: {
  sessionId: number;
  witnesses: Array<{ name: string; role: string }>;
  onCalled?: (witness: { name: string; role?: string }) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [witness, setWitness] = useState<string>("");
  const callWitness = useCallWitness();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCall = () => {
    if (!witness) return;
    callWitness.mutate(
      { id: sessionId, data: { witnessName: witness } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetSessionQueryKey(sessionId), data);
          onCalled?.({
            name: witness,
            role: witnesses.find((w) => w.name === witness)?.role,
          });
          setIsOpen(false);
          setWitness("");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "The witness could not be called",
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Call a witness
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="display-sm text-left">
            Call a witness
          </DialogTitle>
          <DialogDescription className="text-left font-serif">
            Sworn witnesses on the case record. The one you call takes the stand
            and answers only from their statement.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select value={witness} onValueChange={setWitness}>
            <SelectTrigger>
              <SelectValue placeholder="Select a witness on record" />
            </SelectTrigger>
            <SelectContent>
              {witnesses.map((w) => (
                <SelectItem key={w.name} value={w.name}>
                  <span className="font-serif">{w.name}</span>
                  <span className="apparatus ml-2 text-muted-foreground">
                    {w.role}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={handleCall} disabled={!witness || callWitness.isPending}>
            {callWitness.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            <span>Call to the stand</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObjectionDialog({ sessionId }: { sessionId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [groundId, setGroundId] = useState<string>("");
  const [statement, setStatement] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: grounds = [], isLoading: groundsLoading } =
    useListObjectionGrounds();
  const selected = grounds.find((g) => g.id === groundId);

  const { mutateAsync: raiseObjection, isPending } = useRaiseObjection();

  const handleSubmit = async () => {
    if (!groundId) return;
    try {
      await raiseObjection({
        id: sessionId,
        data: { groundId, statement },
      });
      queryClient.invalidateQueries({
        queryKey: getGetSessionQueryKey(sessionId),
      });
      setIsOpen(false);
      setGroundId("");
      setStatement("");
      toast({
        title: "Objection put to the bench",
        description: "The judge is considering the ground you raised.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "The objection could not be put to the bench",
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {/* The one control on the page that keeps a reserved colour, because
            it is the one that raises an objection. */}
        <Button
          variant="outline"
          size="sm"
          className="border-stamp/50 text-stamp"
        >
          Object
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="display-sm text-left text-stamp">
            Raise an objection
          </DialogTitle>
          <DialogDescription className="text-left font-serif">
            Every ground below is anchored in the Qanun-e-Shahadat Order 1984 or
            the procedural codes. You cannot object on a ground that is not.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <label htmlFor="objection-ground" className="apparatus text-muted-foreground">
              Ground
            </label>
            <Select value={groundId} onValueChange={setGroundId}>
              <SelectTrigger id="objection-ground">
                <SelectValue
                  placeholder={
                    groundsLoading
                      ? "Loading grounds…"
                      : "Choose a ground of objection"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {grounds.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex flex-col py-0.5 text-left">
                      <span className="font-serif">
                        {g.label}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {g.citation}
                        </span>
                      </span>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {g.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* The provision itself, with its verification state stated. A
              student about to quote this in a real courtroom is entitled to
              know whether anyone has checked it. */}
          {selected && (
            <figure className="border-l-2 border-rule pl-4">
              <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule/70 pb-1.5">
                <span className="font-mono text-xs text-foreground">
                  {selected.citation}
                </span>
                <span
                  className={cn(
                    "apparatus",
                    selected.verified ? "text-seal" : "text-stamp",
                  )}
                  title={
                    selected.verified
                      ? "Diffed word-for-word against its official source."
                      : "This provision's text has not been checked against pakistancode.gov.pk. Do not quote it as authoritative."
                  }
                >
                  {selected.verified ? "✓ Verified" : "⚠ Unverified"}
                </span>
              </figcaption>
              <p className="mt-2 font-serif text-sm leading-relaxed text-foreground/85">
                {selected.content}
              </p>
            </figure>
          )}

          <div className="space-y-2">
            <label
              htmlFor="objection-statement"
              className="apparatus text-muted-foreground"
            >
              What you say to the bench (optional)
            </label>
            <Textarea
              id="objection-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="My Lord, learned counsel is leading the witness in examination-in-chief, contrary to Article 133 of the Qanun-e-Shahadat…"
              className="min-h-[84px] resize-none rounded-sm font-serif leading-relaxed"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!groundId || isPending}
            className="bg-stamp text-stamp-foreground border-stamp"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Put it to the bench</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RostrumPopover({
  sessionId,
  onTurnComplete,
  onActivity,
}: {
  sessionId: number;
  onTurnComplete: () => void;
  onActivity: (activity: SceneActivity) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [utterance, setUtterance] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmitText = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = utterance.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    onActivity({ actor: "you", mode: "speaking" });

    try {
      const res = await fetch(`/api/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utterance: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setUtterance("");
      onTurnComplete();
      queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });

      if (data.primarySpeaker === "judge") {
        onActivity({ actor: "judge", mode: "speaking" });
      } else if (data.primarySpeaker === "opposing_counsel") {
        onActivity({ actor: "opposing", mode: "speaking" });
      } else if (data.primarySpeaker === "witness") {
        onActivity({ actor: "witness", mode: "speaking" });
      }

      toast({
        title: "Submission entered on record",
        description: data.primarySpeaker
          ? `The ${data.primarySpeaker.replace("_", " ")} has responded.`
          : "The bench has noted your submission.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: err instanceof Error ? err.message : "Turn failed",
      });
      onActivity({ actor: null, mode: "idle" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Mic className="h-4 w-4" />
          <span>Rostrum</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-80 sm:w-96 p-4">
        <div className="flex items-center justify-between border-b border-rule pb-2 mb-3">
          <p className="apparatus text-foreground font-medium">The Rostrum</p>
          <div className="flex items-center gap-1 bg-secondary/50 p-0.5 rounded-sm">
            <button
              type="button"
              onClick={() => setMode("voice")}
              className={cn(
                "apparatus px-2 py-1 rounded-sm text-xs transition-colors flex items-center gap-1",
                mode === "voice"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Mic className="h-3 w-3" />
              <span>Voice</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={cn(
                "apparatus px-2 py-1 rounded-sm text-xs transition-colors flex items-center gap-1",
                mode === "text"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Keyboard className="h-3 w-3" />
              <span>Written</span>
            </button>
          </div>
        </div>

        {mode === "voice" ? (
          <VoiceControl
            sessionId={sessionId}
            onTurnComplete={onTurnComplete}
            onActivity={onActivity}
          />
        ) : (
          <form onSubmit={handleSubmitText} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="written-arg" className="apparatus text-xs text-muted-foreground">
                Written Submission to Court
              </label>
              <Textarea
                id="written-arg"
                value={utterance}
                onChange={(e) => setUtterance(e.target.value)}
                placeholder="My Lord, under section 302 of the PPC, the prosecution submits..."
                className="min-h-[100px] resize-none text-sm font-serif leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    void handleSubmitText(e);
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="apparatus text-[10px] text-muted-foreground">
                Ctrl+Enter to submit
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!utterance.trim() || submitting}
                className="gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>{submitting ? "Submitting…" : "Submit to Bench"}</span>
              </Button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
