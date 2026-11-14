import type { Message } from '../i18n/en'

export type Design = Record<string, string>
export type Cost = { weeks: number; credits: number }
export type CostItem = Cost & { label: Message }
export type Work = 'assess' | 'freeze' | 'build' | 'integrate'
export type Stage = 'feasibility' | 'design' | 'build' | 'integration' | 'review' | 'flight' | 'results'
export type Gate = 'MDR' | 'PDR' | 'CDR' | 'FRR'
export type Stop = 'deadline' | 'funds' | 'cancelled'
export type LabPlayback = { kind: 'assembly' | 'integration'; step: number }
export type BenchLead = 'science' | 'power'
export type TestFocus = 'imaging' | 'downlink'
export type ConfigStep = 'payload' | 'supply' | 'schedule' | 'radio'
type Contact = { choice: string; next: number; accepted: number; diagnosticsPending: boolean }

export type DesignOption = { label: Message; description: Message; cost?: number; params?: Record<string, number | string> }
export type OptionGroup = { legend: Message; options: Record<string, DesignOption> }

// Mission-specific fields are produced and read only by that mission's rules and UI.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Forecast = Record<string, any>
export type TestResult = { design: Design; checks: boolean[] } & Record<string, any>
export type Evidence = TestResult & { week: number; revision: number }
export type FlightResult = { choice: string; delivered: boolean; stretch: boolean } & Record<string, any>
/* eslint-enable @typescript-eslint/no-explicit-any */

export type Entry = { id: string; week: number; cost: number; design: Design; report?: Evidence; label?: Message }

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
  playback?: LabPlayback
  benchLead?: BenchLead
  testFocus?: TestFocus
  contact?: Contact
  configStep?: ConfigStep
}

export type Action =
  | { type: 'configure'; design: Design }
  | { type: 'work' | 'analyze' | 'review' | 'wait' | 'cancel' }
  | { type: 'repair'; remedy: string }
  | { type: 'fly'; choice: string }
  | { type: 'choose'; choice: string }
  | { type: 'configStep'; step: ConfigStep }
  | { type: 'runLab'; benchLead?: BenchLead; testFocus?: TestFocus }
  | { type: 'advanceLab'; playback: LabPlayback; skip?: boolean }
  | { type: 'startContact'; choice: string }
  | { type: 'checkDiagnostics' }
  | { type: 'checkBatch'; batch: number; deliver: boolean }

export type EventChoice = { id: string; label: Message; detail: Message; apply(game: Game): Game }

export type MissionEvent = {
  id: string
  title: Message
  detail: Message
  trigger(game: Game): boolean
  choices: readonly EventChoice[]
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
  costs: Record<Work | 'analyze' | 'wait', CostItem> & Record<string, CostItem>
  remedies: readonly string[]
  stageDetails: Record<Exclude<Stage, 'results'>, Message>
  outcomes: Record<'stopped' | 'extra' | 'success' | 'partial', Message>
  reputation: { minimum: number; stretch: number }
  flightChoices: readonly string[]
  events?: readonly MissionEvent[]
  configurationSteps?: Partial<Record<Stage, readonly ConfigStep[]>>
  labSteps?(game: Game, kind: LabPlayback['kind']): number
  contact?: {
    plan(evidence: Evidence, choice: string): { batches: number; diagnostics: number }
    finish(evidence: Evidence, choice: string, accepted: number): FlightResult
  }
  forecast(design: Design): Forecast
  forecastClear(forecast: Forecast): boolean
  test(design: Design): TestResult
  applyRemedy(design: Design, remedy: string): Design
  repairOptions(design: Design): string[]
  fly(evidence: Evidence, choice: string): FlightResult
  records?(game: Game): string[]
}
