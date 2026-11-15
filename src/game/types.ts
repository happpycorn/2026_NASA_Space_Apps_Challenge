import type { CommissionId } from '../missions/cubesat-commission'
import type { Message } from '../i18n/en'
import type { DefectState, Maturity, Outcome, Severity } from './risk'

export type Design = Record<string, string>
export type Cost = { weeks: number; credits: number }
export type CostItem = Cost & { label: Message }
// labels are message keys translated before they fill the matching {name} in message.
export type Copy = { message: Message; values?: Record<string, string | number>; labels?: Record<string, Message> }
type Json = null | boolean | number | string | Json[] | JsonObject
export type JsonObject = { [key: string]: Json }
export type Work = 'assess' | 'freeze' | 'build' | 'integrate'
export type Stage = 'feasibility' | 'design' | 'build' | 'integration' | 'review' | 'flight' | 'results'
export type Gate = 'MDR' | 'PDR' | 'CDR' | 'FRR'
export type Stop = 'deadline' | 'funds' | 'cancelled' | 'margin'
export type LabPlayback = { kind: 'assembly' | 'integration'; step: number }
export type BenchLead = 'science' | 'power'
export type ScienceGoal = 'minimum' | 'stretch'
export type TestFocus = 'imaging' | 'downlink'
export type ConfigStep = 'launch' | 'payload' | 'supply' | 'schedule' | 'radio'
type Contact = { choice: string; next: number; accepted: number; diagnosticsPending: boolean }

export type DesignOption = { label: Message; description: Message; cost?: number; params?: Record<string, number | string> }
export type OptionGroup = { legend: Message; options: Record<string, DesignOption> }

// Mission-specific fields are produced and read only by that mission's rules and UI.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Forecast = Record<string, any>
export type TestResult = { design: Design; checks: boolean[] } & Record<string, any>
export type Evidence = TestResult & { week: number; revision: number }
export type FlightResult = {
  choice: string; delivered: boolean; stretch: boolean
  interruptedAt?: string
  segments?: SegmentEntry[]
} & Record<string, any>
/* eslint-enable @typescript-eslint/no-explicit-any */

export type ReviewGate = Extract<Gate, 'PDR' | 'FRR'>
export type Waiver = { id: string; label: Message; detail: Copy }
export type Review = {
  issues: readonly { detail: Copy; waiver?: Waiver; item?: Message }[]
  approve?: Copy
  return?: Copy
}
export type ReviewDecision = {
  gate: ReviewGate
  passed: boolean
  waivers: { id: string; label: Message }[]
  detail?: Copy
}

export type SegmentChoice = { id: string; label: Message; detail: Copy; consequence?: Copy; warning?: boolean; prompt?: string; resources?: { spareKg: number; credits: number; windows: number } }
export type MissionFile = { title: Copy; detail: Copy; sources: readonly { title: string; url: string }[] }
export type SegmentEntry = { id: string; choice: string | null; report?: Copy; updates?: Copy[] }
export type FlightProgress = { steps: SegmentEntry[]; state: JsonObject; turn?: number; updates?: Copy[] }
export type FlightContext = { game: Game; evidence: Evidence | null; progress: FlightProgress }
export type FlightSegment = {
  id: string
  title: Message
  action?: Message
  brief?(context: FlightContext): Copy
  file?(context: FlightContext): MissionFile | undefined
  quote?(context: FlightContext): Message | undefined
  status?(context: FlightContext): Copy | undefined
  choices?(context: FlightContext): readonly SegmentChoice[]
  resolve(context: FlightContext, choice: string | null): { failed?: boolean; end?: boolean; continued?: boolean; state?: JsonObject; report?: Copy }
}

export type TimedJob =
  | { type: 'work'; work: Work; lab?: { benchLead?: BenchLead; testFocus?: TestFocus } }
  | { type: 'analyze' | 'wait' }
  | { type: 'repair'; remedy: string }
  | { type: 'verify' | 'fix'; risk: string; work: string }
  | { type: 'task'; task: string }

export type PendingWork = { job: TimedJob; cost: Cost; remaining: number }

export type Entry = {
  id: string; week: number; cost: number; design: Design; report?: Evidence; label?: Message
  incomplete?: boolean
  detail?: Copy
  event?: string
  review?: ReviewDecision
}

export type Game = {
  missionId: string
  stage: Stage
  week: number
  deadline: number
  credits: number
  design: Design
  revision: number
  gate: Gate
  analysis: { design: Design; forecast: Forecast } | null
  evidence: Evidence | null
  flight: FlightResult | null
  stop: Stop | null
  returned: boolean
  event: string | null
  events: string[]
  records: string[]
  log: Entry[]
  // seed fixes every hidden truth of the run. risks holds what the player has learned about each risk item,
  // accepted the risks signed for at flight review, and outcomes what each item turned out to be in flight.
  seed: number
  risks: Record<string, DefectState>
  accepted: string[]
  outcomes: Outcome[]
  playback?: LabPlayback
  benchLead?: BenchLead
  testFocus?: TestFocus
  contact?: Contact
  configStep?: ConfigStep
  scienceGoal?: ScienceGoal
  commission?: CommissionId
  pendingWork?: PendingWork
  missionState?: JsonObject
  flightProgress?: FlightProgress
  studioWork?: { task: string; turn: number; startedAt: number; endsAt: number; review?: boolean }
  studioAwaitLaunch?: true
  studioLaunch?: { startedAt: number; choice?: string }
  studioTutorial?: Stage[]
}

export type Action =
  | { type: 'configure'; design: Design }
  | { type: 'work' | 'analyze' | 'wait' | 'cancel' }
  | { type: 'task'; task: string; turn: number }
  | { type: 'review'; waivers?: readonly string[]; turn?: number }
  | { type: 'segment'; segment: string; choice: string | null; turn?: number }
  | { type: 'repair'; remedy: string }
  | { type: 'verify' | 'fix'; risk: string }
  | { type: 'fly'; choice: string }
  | { type: 'choose'; event?: string; choice: string }
  | { type: 'configStep'; step: ConfigStep }
  | { type: 'runLab'; benchLead?: BenchLead; testFocus?: TestFocus }
  | { type: 'advanceLab'; playback: LabPlayback; skip?: boolean }
  | { type: 'startContact'; choice: string }
  | { type: 'checkDiagnostics' }
  | { type: 'checkBatch'; batch: number; deliver: boolean }

export type EventChoice = {
  id: string; label: Message; detail: Message
  values?(game: Game): Record<string, string | number>
  available?(game: Game): boolean
  result?(game: Game, before: Game): Copy
  apply(game: Game): Game
}

export type MissionEvent = {
  id: string
  title: Message
  detail: Message
  // The event takes money away instead of spending it, so results and the log do not count it as spending.
  reducesFunding?: boolean
  values?(game: Game): Record<string, string | number>
  file?: MissionFile
  quote?: Message
  subject?(game: Game): Message | undefined
  trigger(game: Game): boolean
  choices: readonly EventChoice[]
}

// One risk item as the workbench shows it. risk is the player's belief, never the truth.
export type RiskView = {
  id: string
  label: Message
  detail: Message
  failure: Message
  severity: Severity
  maturity: Maturity
  state: DefectState
  risk: number
  // The next verification level: its cost, what the player would believe after a pass and the share of defects it misses.
  next: (Cost & { work: string; passRisk: number; missRate: number }) | null
  fix: Cost & { work: string }
}

export type MissionRisks = {
  // The seeded item behind a risk for this design. A different design option is a different item.
  identity(design: Design, risk: string): { item: string; maturity: Maturity }
  view(game: Game): RiskView[]
  // Risk items whose analysis level is covered by the mission's optional design analysis.
  analysisCovers?: readonly string[]
  odds(game: Game): { minimum: number; noFatal: number }
  // The evidence as it plays out in flight once defects that were never fixed take effect.
  inFlight(game: Game, evidence: Evidence): Evidence
  outcomes(game: Game): Outcome[]
}

export type MissionRules = {
  id: string
  title: Message
  brief: Message
  dialogue: Message
  deadline: number
  budget: number
  playMinutes: string
  groups: Record<string, OptionGroup>
  initialDesign: Design
  costs: Record<string, CostItem>
  remedies?: readonly string[]
  stageDetails: Record<Exclude<Stage, 'results'>, Message>
  outcomes: Record<'stopped' | 'extra' | 'success' | 'partial', Message>
  reputation: { minimum: number; stretch: number }
  flightChoices?: readonly string[]
  events?: readonly MissionEvent[]
  risks?: MissionRisks
  initialize?(game: Game): Game
  validSave?(game: Game): boolean
  reopenPdr?(game: Game, design: Design): boolean
  configurable?(game: Game, group: string): boolean
  configure?(game: Game, design: Design): Game
  effectiveDeadline?(game: Game): number
  stopReason?(game: Game): Exclude<Stop, 'cancelled'> | null
  // When present, this is the chapter's work menu. IDs refer to entries in costs.
  tasks?: Record<string, {
    plan(game: Game): Cost | null
    start?(game: Game): Game
    complete(game: Game): Game
    detail?(before: Game, after: Game): Copy | undefined
  }>
  onReviewApproved?(game: Game, review: ReviewDecision): Game
  reviews?: Partial<Record<ReviewGate, (game: Game, evidence: Evidence | null) => Review | null>>
  segmentedFlight?: {
    segments: readonly FlightSegment[]
    finish(context: FlightContext, interruptedAt: string | null): FlightResult
  }
  configurationSteps?: Partial<Record<Stage, readonly ConfigStep[]>>
  labSteps?(game: Game, kind: LabPlayback['kind']): number
  contact?: {
    plan(evidence: Evidence, choice: string): { batches: number; diagnostics: number }
    finish(evidence: Evidence, choice: string, accepted: number): FlightResult
  }
  forecast?(design: Design): Forecast
  forecastClear?(forecast: Forecast): boolean
  test?(design: Design): TestResult
  applyRemedy?(design: Design, remedy: string): Design
  repairOptions?(design: Design): string[]
  fly?(evidence: Evidence, choice: string): FlightResult
  records?(game: Game): string[]
}
