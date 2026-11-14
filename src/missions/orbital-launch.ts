import type { Message } from '../i18n/en'

type Text = { label: Message; description: Message }
type Work = { weeks: number; credits: number; label: Message }
type Source = { source: string; url: string }

type OrbitalShape = {
  title: Message
  brief: Message
  stages: Record<string, Text & { capacityKg: number; shortfallKg: number; cost: number }>
  telemetry: Record<string, Text & { massKg: number; diagnosticUnits: number; cost: number }>
  adapters: Record<string, Text & { massKg: number; cost: number }>
  grounds: Record<string, Text & { capacity: number; rehearsedCapacity: number; cost: number }>
  labSlot: { label: Message; description: Message; from: string; expiresWeek: number; uses: Record<string, { label: Message; creditsSaved: number }> }
  records: Record<string, { label: Message; description: Message }>
  events: Record<string, { label: Message; description: Message; afterWeek: number; budgetChange: number }>
  costs: Record<string, Work>
  remedies: Record<string, Work & { description: Message; requires: Message }>
  gates: Record<string, { work: readonly string[]; pass: Message }>
  segments: readonly { id: string; label: Message; carried: Message }[]
  passPlans: Record<string, Text & { diagnosticsFirst: boolean }>
  outcomes: Record<string, Text>
  sources: Record<string, Source>
}

export const orbitalLaunch = {
  id: 'orbital-launch',
  title: 'orbital',
  brief: 'orbitalBriefStory',
  deadline: 12,
  budget: 196,
  playMinutes: '8–12',
  initialDesign: { stage: 'standard', telemetry: 'basic', adapter: 'standard', ground: 'single' },

  // Performance. Margin = stage capacity to the target orbit − carried mass.
  // A hot-fire test replaces the analysis figure with capacityKg − shortfallKg, which is what the stage delivers in flight.
  testPayloadKg: 70,
  marginStretchKg: 20,

  // Data, counted in units that fit in the first ground pass.
  confirmationUnits: 2,

  stages: {
    standard: { label: 'orbitalStageStandard', description: 'orbitalStageStandardDetail', capacityKg: 100, shortfallKg: 3, cost: 30 },
    highMargin: { label: 'orbitalStageHighMargin', description: 'orbitalStageHighMarginDetail', capacityKg: 130, shortfallKg: 16, cost: 56 },
  },
  telemetry: {
    basic: { label: 'orbitalTelemetryBasic', description: 'orbitalTelemetryBasicDetail', massKg: 8, diagnosticUnits: 0, cost: 10 },
    diagnostics: { label: 'orbitalTelemetryDiagnostics', description: 'orbitalTelemetryDiagnosticsDetail', massKg: 20, diagnosticUnits: 3, cost: 26 },
  },
  adapters: {
    standard: { label: 'orbitalAdapterStandard', description: 'orbitalAdapterStandardDetail', massKg: 10, cost: 0 },
    lightweight: { label: 'orbitalAdapterLightweight', description: 'orbitalAdapterLightweightDetail', massKg: 4, cost: 8 },
  },
  // capacity applies to an unrehearsed pass. The end-to-end rehearsal raises a two-station pass to rehearsedCapacity.
  grounds: {
    single: { label: 'orbitalGroundSingle', description: 'orbitalGroundSingleDetail', capacity: 3, rehearsedCapacity: 3, cost: 6 },
    dual: { label: 'orbitalGroundDual', description: 'orbitalGroundDualDetail', capacity: 4, rehearsedCapacity: 6, cost: 16 },
  },

  // Offered at the start when the CubeSat chapter ended with a partner-verified end-to-end record.
  labSlot: {
    label: 'orbitalLabSlot',
    description: 'orbitalLabSlotDetail',
    from: 'cubesat',
    expiresWeek: 8,
    uses: {
      integrate: { label: 'orbitalLabSlotIntegrate', creditsSaved: 12 },
      rehearse: { label: 'orbitalLabSlotRehearse', creditsSaved: 8 },
    },
  },
  // Track records this chapter can pass on. The lunar chapter reads them as `onTime` and `verified`.
  // onTime: minimum met and FRR approved by onTimeWeek. verified: minimum met with hot-fire and rehearsal evidence at FRR.
  onTimeWeek: 10,
  records: {
    onTime: { label: 'orbitalRecordOnTime', description: 'orbitalRecordOnTimeDetail' },
    verified: { label: 'orbitalRecordVerified', description: 'orbitalRecordVerifiedDetail' },
  },

  events: {
    budgetCut: { label: 'orbitalEventCutTitle', description: 'orbitalEventCutStory', afterWeek: 2, budgetChange: -20 },
  },

  costs: {
    assess: { weeks: 1, credits: 8, label: 'orbitalAssess' },
    trade: { weeks: 1, credits: 5, label: 'orbitalTrade' },
    prelim: { weeks: 1, credits: 6, label: 'orbitalPrelim' },
    freeze: { weeks: 1, credits: 8, label: 'orbitalFreeze' },
    buildStage: { weeks: 2, credits: 24, label: 'orbitalBuildStage' },
    buildAvionics: { weeks: 1, credits: 10, label: 'orbitalBuildAvionics' },
    integrate: { weeks: 1, credits: 12, label: 'orbitalIntegrate' },
    hotfire: { weeks: 1, credits: 14, label: 'orbitalHotfire' },
    rehearse: { weeks: 1, credits: 8, label: 'orbitalRehearse' },
    retest: { weeks: 1, credits: 8, label: 'orbitalRetest' },
    wait: { weeks: 1, credits: 0, label: 'orbitalWait' },
  },
  // Changes after CDR. A remedy applied after integration makes that evidence stale and needs a retest.
  remedies: {
    adapter: { weeks: 1, credits: 8, label: 'orbitalRemedyAdapter', description: 'orbitalRemedyAdapterDetail', requires: 'orbitalRequiresStandardAdapter' },
    dropDiagnostics: { weeks: 1, credits: 4, label: 'orbitalRemedyDropDiagnostics', description: 'orbitalRemedyDropDiagnosticsDetail', requires: 'orbitalRequiresDiagnostics' },
    dualStation: { weeks: 1, credits: 10, label: 'orbitalRemedyDualStation', description: 'orbitalRemedyDualStationDetail', requires: 'orbitalRequiresSingle' },
  },

  // PDR needs estimated margin ≥ 0. FRR needs current integration evidence, margin ≥ 0 on the best evidence available
  // (hot-fire data when it exists, analysis otherwise) and pass capacity ≥ confirmationUnits.
  gates: {
    MDR: { work: ['assess'], pass: 'orbitalMdrPass' },
    PDR: { work: ['prelim'], pass: 'orbitalPdrPass' },
    CDR: { work: ['freeze'], pass: 'orbitalCdrPass' },
    FRR: { work: ['buildStage', 'buildAvionics', 'integrate'], pass: 'orbitalFrrPass' },
  },

  segments: [
    { id: 'ascent', label: 'orbitalAscentTitle', carried: 'orbitalAscentCarried' },
    { id: 'pass', label: 'orbitalPassTitle', carried: 'orbitalPassCarried' },
  ],
  passPlans: {
    confirmFirst: { label: 'orbitalPassConfirmFirst', description: 'orbitalPassConfirmFirstDetail', diagnosticsFirst: false },
    diagnosticsFirst: { label: 'orbitalPassDiagnosticsFirst', description: 'orbitalPassDiagnosticsFirstDetail', diagnosticsFirst: true },
  },

  outcomes: {
    extra: { label: 'orbitalOutcomeExtra', description: 'orbitalOutcomeExtraDetail' },
    success: { label: 'orbitalOutcomeSuccess', description: 'orbitalOutcomeSuccessDetail' },
    incomplete: { label: 'orbitalOutcomeIncomplete', description: 'orbitalOutcomeIncompleteDetail' },
    stopped: { label: 'orbitalOutcomeStopped', description: 'orbitalOutcomeStoppedDetail' },
  },

  sources: {
    segments: { source: 'NASA, Design and Develop Science Missions, slide 8', url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf#page=8' },
    massRatio: { source: 'NASA Glenn, Beginner’s Guide to Aeronautics: Mass Ratios', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mass-ratios/' },
    performanceMargin: { source: 'NASA CubeSat 101 §1.3', url: 'https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=17' },
    massProperties: { source: 'NASA CubeSat 101 §6.4', url: 'https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=65' },
    verificationMethods: { source: 'NASA Systems Engineering Handbook §5.3 Product Verification', url: 'https://www.nasa.gov/reference/5-3-product-verification/' },
    hotfire: { source: 'NASA, Green Run Update: Full Duration Hot Fire Successfully Completed', url: 'https://www.nasa.gov/blogs/missions/2021/03/18/green-run-update-full-duration-hot-fire-successfully-completed-on-mar-18/' },
    flightData: { source: 'NASA NTRS, End-to-End Assessment of Artemis-1 Development Flight Instrumentation', url: 'https://ntrs.nasa.gov/citations/20200003089' },
    tradeSpace: { source: 'JPL, Space Mission Concept Development Using Concept Maturity Levels', url: 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299' },
    studyProducts: { source: 'NASA GSFC Mission Design Lab', url: 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/' },
    trajectory: { source: 'NASA General Mission Analysis Tool (GMAT)', url: 'https://software.nasa.gov/software/GSC-19468-1' },
    retest: { source: 'NASA CubeSat 101 §6.9.1–6.9.2', url: 'https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=69' },
    reviews: { source: 'NASA NPR 7123.1D Appendix G', url: 'https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixG' },
  },
} as const satisfies OrbitalShape & Record<string, unknown>

export const orbitalDepartments = ['propulsion', 'avionics', 'ground'] as const
export type OrbitalDepartment = typeof orbitalDepartments[number]
export const orbitalProposals = {
  propulsion: { label: 'orbitalPropulsion', options: ['adapter', 'dropDiagnostics'], fallback: 'adapter', brief: 'orbitalPropulsionBrief' },
  avionics: { label: 'orbitalAvionics', options: ['dropDiagnostics', 'dualStation'], fallback: 'dropDiagnostics', brief: 'orbitalAvionicsBrief' },
  ground: { label: 'orbitalGround', options: ['dualStation'], fallback: 'dualStation', brief: 'orbitalGroundBrief' },
} as const satisfies Record<OrbitalDepartment, { label: Message; options: readonly (keyof typeof orbitalLaunch.remedies)[]; fallback: keyof typeof orbitalLaunch.remedies; brief: Message }>
