import { commissionRules } from './cubesat-commission'
import { commissionUi } from './cubesat-commission-ui'
import type { ReactNode } from 'react'
import type { Copy, Design, Evidence, FlightResult, Forecast, Game, MissionRules, TestResult } from '../game/types'
import type { Message, Translate } from '../i18n'
import { cubeSatRules } from './cubesat'
import { cubeSatUi } from './cubesat-ui'
import { orbitalRules } from './orbital-rules'
import { lunarRules } from './lunar-rules'
import { orbitalUi, lunarUi } from './chapter-ui'

export type FlightOption = { id: string; name: Message; detail: string }

export type MissionUi = {
  Requirements(props: { t: Translate }): ReactNode
  Estimate(props: { design: Design; game: Game; t: Translate }): ReactNode
  Forecast(props: { design: Design; forecast: Forecast; t: Translate }): ReactNode
  Report(props: { evidence: TestResult; t: Translate }): ReactNode
  RemedyPreview(props: { design: Design; remedy: string; t: Translate }): ReactNode
  Delivery(props: { flight: FlightResult; t: Translate }): ReactNode
  Debrief?(props: { game: Game; t: Translate }): ReactNode
  Status?(props: { game: Game; t: Translate }): ReactNode
  // A one-line forecast under the configuration, for the trade-off the chapter is about.
  Preview?(props: { game: Game; t: Translate }): ReactNode
  // NASA material the chapter's rules and numbers draw on, listed on the results page.
  sources?: readonly { source: string; url: string }[]
  // Work that counts as verification for the results rating.
  verificationWork?: ReadonlySet<string>
  knownDefectAtLaunch?(game: Game): boolean
  // How many flight risk items had any verification or a fix before launch.
  verifiedShare?(game: Game): { verified: number; total: number }
  TaskNote?(props: { game: Game; task: string; cost: { weeks: number; credits: number }; t: Translate }): ReactNode
  optionalTasks?: ReadonlySet<string>
  outcome?(game: Game, t: Translate): { title: Message; detail?: Copy }
  flightOptions?(evidence: Evidence, t: Translate): FlightOption[]
  flightSummary(flight: FlightResult, t: Translate): string
}

export type MissionModule = MissionRules & { ui: MissionUi }

export const commissionMission: MissionModule = { ...commissionRules, ui: commissionUi }

export const cubeSatMission: MissionModule = { ...cubeSatRules, ui: cubeSatUi }

export const missions: Record<string, MissionModule> = {
  [cubeSatMission.id]: cubeSatMission,
  [orbitalRules.id]: { ...orbitalRules, ui: orbitalUi },
  [lunarRules.id]: { ...lunarRules, ui: lunarUi },
}

export { missionCatalog } from './rules'
