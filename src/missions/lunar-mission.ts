import type { Message } from '../i18n/en'
import {
  defectBelief, defectInFlight, drawFromPool, hasDefect, itemRandom, missionOdds, reviewRiskThreshold, untested,
  type DefectState, type Maturity, type Severity,
} from '../game/risk'

// Story design: docs/story/lunar-mission.md. Real mission references: docs/story/lunar-history.md (H01–H32).
// Every number in this file is a game setting.

type Source = { source: string; url: string }

// What a card choice or a failure response changes. Anything that needs more than a number is handled by `id` in the rules.
type Effect = { weeks?: number; credits?: number; deadline?: number; massKg?: number; propellantKg?: number; windows?: number; slots?: number }
type Choice<C extends string, P extends string> = { id: C; label: `${P}${C}`; detail: `${P}${C}Detail`; result: `${P}${C}Result`; effect: Effect }
type Card<I extends string, C extends string> = {
  id: I; title: `lunarCard${I}`; detail: `lunarCard${I}Story`; quote: `lunarCard${I}Quote`; file: `lunarCard${I}File`
  history: readonly string[]; choices: readonly Choice<C, `lunarCard${I}`>[]
}

// Card IDs and choice IDs are spelled the way they appear in the text keys, so the keys can be derived and type-checked.
function card<I extends string, const C extends Record<string, Effect>>(id: I, history: readonly string[], choices: C): Card<I, keyof C & string> {
  return {
    id, title: `lunarCard${id}`, detail: `lunarCard${id}Story`, quote: `lunarCard${id}Quote`, file: `lunarCard${id}File`, history,
    choices: Object.entries(choices).map(([choice, effect]) => ({ id: choice, label: `lunarCard${id}${choice}`, detail: `lunarCard${id}${choice}Detail`, result: `lunarCard${id}${choice}Result`, effect })) as never,
  }
}
function responses<I extends string, const C extends Record<string, Effect>>(id: I, choices: C): readonly Choice<keyof C & string, `lunarRisk${I}`>[] {
  return Object.entries(choices).map(([choice, effect]) => ({ id: choice, label: `lunarRisk${id}${choice}`, detail: `lunarRisk${id}${choice}Detail`, result: `lunarRisk${id}${choice}Result`, effect })) as never
}

export const lunarMission = {
  id: 'lunar-mission',
  title: 'lunar',
  brief: 'lunarBriefStory',
  deadline: 26,
  budget: 150,
  playMinutes: '30',
  minimumBatches: 1,
  stretchBatches: 2,
  initialDesign: { payload: 'basic', sensor: 'single', power: 'dayOnly', route: 'direct', mount: 'standard' },

  // Mass budget. Propellant loaded = launchAllocationKg − dry mass, so every kilogram of dry mass costs a kilogram of propellant.
  // The margin left after the route's need is the propellant the flight spends on corrections and responses.
  launchAllocationKg: 500,
  busDryKg: 190,
  reserveKg: 10,

  // Surface timeline, counted in operations windows across one lunar day.
  daylightWindows: 3,
  tiltedWindows: 2,
  downlinkWindows: 1,
  wakeWindows: 2,
  wakeCredits: 10,
  lateOutageChance: 0.2,
  returnedReserveForEfficiency: 20,
  operatingAdvance: 12,
  operatingReserve: { heritage: 3, new: 5 },

  payloads: {
    basic: { label: 'lunarPayloadBasic', description: 'lunarPayloadBasicDetail', massKg: 20, collectWindows: 2, maxBatches: 2, maturity: 'heritage', cost: 20 },
    advanced: { label: 'lunarPayloadAdvanced', description: 'lunarPayloadAdvancedDetail', massKg: 30, collectWindows: 1, maxBatches: 3, maturity: 'new', cost: 34 },
  },
  sensors: {
    single: { label: 'lunarSensorSingle', description: 'lunarSensorSingleDetail', massKg: 6, backup: false, cost: 12 },
    redundant: { label: 'lunarSensorRedundant', description: 'lunarSensorRedundantDetail', massKg: 12, backup: true, cost: 24 },
  },
  powers: {
    dayOnly: { label: 'lunarPowerDayOnly', description: 'lunarPowerDayOnlyDetail', massKg: 0, nightWindows: 0, maturity: 'new', cost: 0 },
    extended: { label: 'lunarPowerExtended', description: 'lunarPowerExtendedDetail', massKg: 12, nightWindows: 2, maturity: 'heritage', cost: 16 },
  },
  routes: {
    direct: { label: 'lunarRouteDirect', description: 'lunarRouteDirectDetail', propellantKg: 270, correctionKg: 6, leadWeeks: 0, cost: 0 },
    lowEnergy: { label: 'lunarRouteLowEnergy', description: 'lunarRouteLowEnergyDetail', propellantKg: 258, correctionKg: 4, leadWeeks: 2, cost: 6 },
  },
  // growthKg is the as-built mass the payload interface adds when it is weighed at integration.
  // The lightweight mount is paid for with credits or with one partner support slot.
  mounts: {
    standard: { label: 'lunarMountStandard', description: 'lunarMountStandardDetail', growthKg: 10, cost: 0, supportSlots: 0 },
    lightweight: { label: 'lunarMountLightweight', description: 'lunarMountLightweightDetail', growthKg: 2, cost: 16, supportSlots: 1 },
  },

  // Offers stay open until PDR. Contract weeks use main-work turns and must be delivered or ended before FRR.
  // The advance is paid on signing. The milestone payment and support slots arrive on delivery.
  partnerships: {
    funding: { label: 'lunarOfferFunding', description: 'lunarOfferFundingDetail', weeks: 2, advance: 40, milestone: 20, supportSlots: 0, record: 'onTime' },
    tech: { label: 'lunarOfferTech', description: 'lunarOfferTechDetail', weeks: 3, advance: 0, milestone: 0, supportSlots: 3, record: 'verified' },
    decline: { label: 'lunarOfferDecline', description: 'lunarOfferDeclineDetail', weeks: 0, advance: 0, milestone: 0, supportSlots: 0, record: null },
  },
  // Stand-in contracts offered at the second invitation and when a partner withdraws. Their labels are the choices of those cards.
  latePartnerships: {
    funding: { weeks: 2, advance: 30, milestone: 0, supportSlots: 0 },
    tech: { weeks: 2, advance: 0, milestone: 0, supportSlots: 1 },
  },
  // Track records from the orbital launch chapter. Each improves one offer and is never required to pass.
  records: {
    onTime: { label: 'lunarRecordOnTime', from: 'orbital-launch', partnership: 'funding', advanceShift: 10, supportSlots: 0 },
    verified: { label: 'lunarRecordVerified', from: 'orbital-launch', partnership: 'tech', advanceShift: 0, supportSlots: 1 },
  },
  supportUses: {
    buildFlight: { label: 'lunarSupportBuildFlight', weeksSaved: 1, creditsSaved: 10 },
    integrate: { label: 'lunarSupportIntegrate', weeksSaved: 1, creditsSaved: 10 },
    mount: { label: 'lunarSupportMount', weeksSaved: 0, creditsSaved: 16 },
    // One verification step at the partner's facility: it still takes its week and costs no credits.
    verify: { label: 'lunarSupportVerify', weeksSaved: 0, creditsSaved: 0 },
  },

  // Risk items. Each has a truth drawn from the seed at the start: defect or no defect. Verification looks at it.
  // steps are the works that take the item to analysis, unit test and end-to-end test. Nothing is rolled in flight:
  // a defect that was never fixed shows up at the item's segment. severity is the default; lunarSeverity applies the
  // two exceptions (a single altimeter makes descent fatal, switching off fault protection makes thrusters fatal).
  // The payload and night items take their maturity from the chosen hardware, see lunarMaturity.
  risks: {
    software: { label: 'lunarRiskSoftware', description: 'lunarRiskSoftwareDetail', failure: 'lunarRiskSoftwareFailure', quote: 'lunarRiskSoftwareQuote', file: 'lunarRiskSoftwareFile', found: 'lunarFoundSoftware', kind: 'chance', severity: 'degraded', maturity: 'new', segment: 'checkout', steps: ['softwareAnalysis', 'softwareBench', 'missionSim'], unitNeeds: 'buildGround', history: ['H09', 'H10', 'H11'] },
    pressure: { label: 'lunarRiskPressure', description: 'lunarRiskPressureDetail', failure: 'lunarRiskPressureFailure', quote: 'lunarRiskPressureQuote', file: 'lunarRiskPressureFile', found: 'lunarFoundPressure', kind: 'chance', severity: 'degraded', maturity: 'heritage', segment: 'transfer', steps: ['leakAnalysis', 'leakCheck', 'hotfire'], unitNeeds: 'buildFlight', history: ['H12', 'H14', 'H18'] },
    thrusters: { label: 'lunarRiskThrusters', description: 'lunarRiskThrustersDetail', failure: 'lunarRiskThrustersFailure', quote: 'lunarRiskThrustersQuote', file: 'lunarRiskThrustersFile', found: 'lunarFoundThrusters', kind: 'chance', severity: 'degraded', maturity: 'heritage', segment: 'orbit', steps: ['thrusterAnalysis', 'thrusterTest', 'attitudeTest'], unitNeeds: 'buildFlight', history: ['H13', 'H15', 'H16', 'H17'] },
    descent: { label: 'lunarRiskDescent', description: 'lunarRiskDescentDetail', failure: 'lunarRiskDescentFailure', quote: 'lunarRiskDescentQuote', file: 'lunarRiskDescentFile', found: 'lunarFoundDescent', kind: 'chance', severity: 'degraded', maturity: 'new', segment: 'descent', steps: ['descentSim', 'sensorTest', 'rehearse'], unitNeeds: 'buildFlight', history: ['H20', 'H21', 'H22', 'H23'] },
    payload: { label: 'lunarRiskPayload', description: 'lunarRiskPayloadDetail', failure: 'lunarRiskPayloadFailure', quote: 'lunarRiskPayloadQuote', file: 'lunarRiskPayloadFile', found: 'lunarFoundPayload', kind: 'chance', severity: 'degraded', maturity: 'heritage', segment: 'surface', steps: ['dataAnalysis', 'payloadCheck', 'payloadTest'], unitNeeds: 'buildPayload', history: ['H04', 'H25', 'H26'] },
    night: { label: 'lunarRiskNight', description: 'lunarRiskNightDetail', failure: 'lunarRiskNightFailure', quote: 'lunarRiskNightQuote', file: 'lunarRiskNightFile', found: 'lunarFoundNight', kind: 'chance', severity: 'degraded', maturity: 'new', segment: 'night', steps: ['thermalAnalysis', 'batteryTest', 'thermalVac'], unitNeeds: 'buildFlight', history: ['H28', 'H29', 'H30'] },
  },
  // An option that skips or voids a check adds a second, unseen source of defects to the item, drawn at this maturity's chance.
  exposedChance: 'heritage',
  // Closing texts treat an item as looked at when it was verified to this level or fixed.
  checkedLevel: 2,
  // After a test reports a defect: fixing it takes this much. Redesigns are the remedies addLidar, basicPayload and dropKit.
  fix: { weeks: 1, credits: 8, label: 'lunarFoundFix' },

  costs: {
    contract: { weeks: 1, credits: 0, label: 'lunarContractWork' },
    assess: { weeks: 1, credits: 8, label: 'lunarAssess' },
    trade: { weeks: 1, credits: 6, label: 'lunarTrade' },
    prelim: { weeks: 1, credits: 8, label: 'lunarPrelim' },
    detail: { weeks: 1, credits: 8, label: 'lunarDetail' },
    freeze: { weeks: 1, credits: 10, label: 'lunarFreeze' },
    buildFlight: { weeks: 3, credits: 30, label: 'lunarBuildFlight' },
    buildPayload: { weeks: 2, credits: 16, label: 'lunarBuildPayload' },
    buildGround: { weeks: 1, credits: 8, label: 'lunarBuildGround' },
    integrate: { weeks: 2, credits: 20, label: 'lunarIntegrate' },
    retest: { weeks: 1, credits: 10, label: 'lunarRetest' },
    secondInterface: { weeks: 1, credits: 0, label: 'lunarSecondInterface' },
    wait: { weeks: 1, credits: 0, label: 'lunarWait' },
    // Verification ladder: analysis after MDR, unit test after the item's hardware is built, end-to-end after integration.
    softwareAnalysis: { weeks: 1, credits: 3, label: 'lunarVerifySoftware1' },
    softwareBench: { weeks: 1, credits: 6, label: 'lunarVerifySoftware2' },
    missionSim: { weeks: 1, credits: 10, label: 'lunarVerifySoftware3' },
    leakAnalysis: { weeks: 1, credits: 3, label: 'lunarVerifyPressure1' },
    leakCheck: { weeks: 1, credits: 6, label: 'lunarVerifyPressure2' },
    hotfire: { weeks: 1, credits: 10, label: 'lunarVerifyPressure3' },
    thrusterAnalysis: { weeks: 1, credits: 3, label: 'lunarVerifyThrusters1' },
    thrusterTest: { weeks: 1, credits: 6, label: 'lunarVerifyThrusters2' },
    attitudeTest: { weeks: 1, credits: 10, label: 'lunarVerifyThrusters3' },
    descentSim: { weeks: 1, credits: 3, label: 'lunarVerifyDescent1' },
    sensorTest: { weeks: 1, credits: 6, label: 'lunarVerifyDescent2' },
    rehearse: { weeks: 1, credits: 10, label: 'lunarVerifyDescent3' },
    dataAnalysis: { weeks: 1, credits: 3, label: 'lunarVerifyPayload1' },
    payloadCheck: { weeks: 1, credits: 6, label: 'lunarVerifyPayload2' },
    payloadTest: { weeks: 1, credits: 10, label: 'lunarVerifyPayload3' },
    thermalAnalysis: { weeks: 1, credits: 3, label: 'lunarVerifyNight1' },
    batteryTest: { weeks: 1, credits: 6, label: 'lunarVerifyNight2' },
    thermalVac: { weeks: 1, credits: 10, label: 'lunarVerifyNight3' },
  },
  // Changes after CDR. Any remedy applied after integration makes the evidence stale and needs a retest.
  remedies: {
    mount: { weeks: 1, credits: 16, label: 'lunarRemedyMount', description: 'lunarRemedyMountDetail', requires: 'lunarRequiresCredits' },
    partnerMount: { weeks: 1, credits: 0, label: 'lunarRemedyPartnerMount', description: 'lunarRemedyPartnerMountDetail', requires: 'lunarRequiresSlot' },
    dropKit: { weeks: 1, credits: 0, label: 'lunarRemedyDropKit', description: 'lunarRemedyDropKitDetail', requires: 'lunarRequiresKit' },
    reroute: { weeks: 1, credits: 6, label: 'lunarRemedyReroute', description: 'lunarRemedyRerouteDetail', requires: 'lunarRequiresLead' },
    basicPayload: { weeks: 1, credits: 8, label: 'lunarRemedyBasicPayload', description: 'lunarRemedyBasicPayloadDetail', requires: 'lunarRequiresAdvanced' },
    addLidar: { weeks: 1, credits: 12, label: 'lunarRemedyAddLidar', description: 'lunarRemedyAddLidarDetail', requires: 'lunarRequiresSingle' },
  },

  // PDR also needs estimated margin ≥ reserveKg. FRR needs current integration evidence, loaded propellant ≥ route need,
  // a delivered or ended contract, margin ≥ reserveKg (waivable while ≥ 0) and a signature for every flight risk
  // believed above reviewRiskThreshold or known to have an unfixed defect.
  gates: {
    MDR: { work: ['assess'], pass: 'lunarMdrPass' },
    PDR: { work: ['prelim'], pass: 'lunarPdrPass' },
    CDR: { work: ['detail', 'freeze'], pass: 'lunarCdrPass' },
    FRR: { work: ['buildFlight', 'buildPayload', 'buildGround', 'integrate'], pass: 'lunarFrrPass' },
  },
  waivers: {
    reserve: { label: 'lunarWaiverReserve', description: 'lunarWaiverReserveDetail' },
  },

  // Storyline events. They fire on a fixed condition and are not drawn.
  storyEvents: [
    card('Camera', ['H27'], { Mount: { credits: 8, massKg: 2 }, Room: { credits: 3 }, Decline: {} }),
    card('Review', ['H32'], { UseSlot: { slots: -1 }, Note: {} }),
    card('SecondOffer', ['H01', 'H14'], { Funding: {}, Tech: {}, Government: { credits: 30, massKg: 8 }, Alone: {} }),
  ],
  secondOfferWeek: 8,

  // External event pool. One development card turns up after each of drawWeeks, PullIn always in the first two.
  // One launch card and one cruise card are drawn in flight. Imaging is offered only after a loss with no engineering data.
  drawWeeks: [4, 10, 16],
  devCards: [
    card('PullIn', ['H03'], { Accept: { deadline: -2, credits: 12 }, Compromise: { deadline: -1 }, Refuse: { credits: -10 } }),
    card('PartnerExit', ['H01'], { Accept: {}, Switch: {}, Negotiate: { weeks: 1 } }),
    card('CostReview', ['H02'], { Grant: { credits: 16 }, Cut: {}, Stop: {} }),
    card('SecondPayload', ['H14'], { Accept: { credits: 30, massKg: 8 }, Light: { credits: 18, massKg: 4 }, Decline: {} }),
    card('SupplierDelay', ['H02'], { Wait: { weeks: 1 }, Rush: { credits: -8 }, Stock: { massKg: 4 } }),
    card('LauncherSlip', ['H02'], { Follow: { deadline: 2, credits: -6 }, Keep: {} }),
    card('PartsAlert', ['H16'], { Inspect: { weeks: 1, credits: -4 }, Partner: { slots: -1 }, Fly: {} }),
    card('IcdMismatch', ['H09', 'H11'], { Review: { weeks: 1 }, Skip: {} }),
  ],
  launchCards: [
    card('Scrub', ['H05', 'H07'], { Wait: { credits: -8 }, Rush: {} }),
    card('Weather', ['H06'], { Rollback: { credits: -6 }, Slip: { propellantKg: -2 } }),
    card('Lightning', ['H08'], { Check: { propellantKg: -2 }, Press: {}, Switch: {} }),
  ],
  cruiseCards: [
    card('Eclipse', ['H09', 'H27'], { Shelter: { windows: -1 }, Battery: { windows: -1 }, Exposed: {} }),
    card('CruiseScience', ['H14', 'H04'], { On: { credits: -4 }, Off: {} }),
  ],
  lossCards: [
    card('Imaging', ['H24'], { Share: {}, Decline: {} }),
  ],

  // What the player can do when an item's defect shows up in flight. The night item has no response: the lander does not wake.
  responses: {
    software: responses('Software', { Uplink: { credits: -6 }, Wait: { propellantKg: -4 }, Disable: {} }),
    pressure: responses('Pressure', { Emergency: { propellantKg: 4 }, Continue: {}, Flyby: {}, Diagnose: {} }),
    thrusters: responses('Thrusters', { Simulate: { credits: -6, propellantKg: -2 }, Reverse: { propellantKg: -6 }, Flyby: {} }),
    descent: responses('Descent', { Patch: { propellantKg: -3 }, Switch: {}, Abort: {} }),
    payload: responses('Payload', { Restart: { windows: -1 }, LowRate: {}, Engineering: {} }),
  },
  pressureLossKg: 8,
  // Uplink costs nothing after the interface review and this much more when the mismatch was left open.
  uplinkOpenExtra: 4,

  segments: [
    { id: 'launch', label: 'lunarLaunchTitle', carried: 'lunarLaunchCarried' },
    { id: 'checkout', label: 'lunarCheckoutTitle', carried: 'lunarCheckoutCarried' },
    { id: 'transfer', label: 'lunarTransferTitle', carried: 'lunarTransferCarried' },
    { id: 'orbit', label: 'lunarOrbitTitle', carried: 'lunarOrbitCarried' },
    { id: 'descent', label: 'lunarLandingTitle', carried: 'lunarLandingCarried' },
    { id: 'surface', label: 'lunarSurfaceTitle', carried: 'lunarSurfaceCarried' },
    { id: 'night', label: 'lunarNightTitle', carried: 'lunarNightCarried' },
  ],
  surfacePlans: {
    priority: { label: 'lunarSurfacePriority', description: 'lunarSurfacePriorityDetail', reservedWindows: 0, deliverAll: false },
    extra: { label: 'lunarSurfaceExtra', description: 'lunarSurfaceExtraDetail', reservedWindows: 0, deliverAll: true },
    diagnostics: { label: 'lunarSurfaceDiagnostics', description: 'lunarSurfaceDiagnosticsDetail', reservedWindows: 2, deliverAll: true },
  },
  hostedPlan: { label: 'lunarSurfaceHosted', description: 'lunarSurfaceHostedDetail', reservedWindows: 1, deliverAll: true },
  nightPlans: {
    rest: { label: 'lunarNightRest', description: 'lunarNightRestDetail' },
    wake: { label: 'lunarNightWake', description: 'lunarNightWakeDetail' },
  },

  // Ending matrix: mission result × what the team is left with.
  outcomes: {
    stopped: { label: 'lunarOutcomeStopped', description: 'lunarOutcomeStoppedDetail' },
    lost: { label: 'lunarOutcomeLost', description: 'lunarOutcomeLostDetail' },
    salvage: { label: 'lunarOutcomeSalvage', description: 'lunarOutcomeSalvageDetail' },
    noData: { label: 'lunarOutcomeNoData', description: 'lunarOutcomeNoDataDetail' },
    success: { label: 'lunarOutcomeSuccess', description: 'lunarOutcomeSuccessDetail' },
    extra: { label: 'lunarOutcomeExtra', description: 'lunarOutcomeExtraDetail' },
  },
  closings: {
    deadline: { label: 'lunarClosingDeadline', description: 'lunarClosingDeadlineText' },
    funds: { label: 'lunarClosingFunds', description: 'lunarClosingFundsText' },
    cancelled: { label: 'lunarClosingCancelled', description: 'lunarClosingCancelledText' },
    missed: { label: 'lunarClosingMissed', description: 'lunarClosingMissedText' },
    listed: { label: 'lunarClosingListed', description: 'lunarClosingListedText' },
    tradeoff: { label: 'lunarClosingTradeoff', description: 'lunarClosingTradeoffText' },
    checked: { label: 'lunarClosingChecked', description: 'lunarClosingCheckedText' },
    unchecked: { label: 'lunarClosingUnchecked', description: 'lunarClosingUncheckedText' },
    recovered: { label: 'lunarClosingRecovered', description: 'lunarClosingRecoveredText' },
  },
  endings: [
    { outcome: 'stopped', closing: 'deadline', text: 'lunarEndingStoppedDeadline' },
    { outcome: 'stopped', closing: 'funds', text: 'lunarEndingStoppedFunds' },
    { outcome: 'stopped', closing: 'cancelled', text: 'lunarEndingStoppedCancelled' },
    { outcome: 'lost', closing: 'missed', text: 'lunarEndingLostMissed' },
    { outcome: 'lost', closing: 'listed', text: 'lunarEndingLostListed' },
    { outcome: 'salvage', closing: 'missed', text: 'lunarEndingSalvageMissed' },
    { outcome: 'salvage', closing: 'listed', text: 'lunarEndingSalvageListed' },
    { outcome: 'noData', closing: 'missed', text: 'lunarEndingNoDataMissed' },
    { outcome: 'noData', closing: 'listed', text: 'lunarEndingNoDataListed' },
    { outcome: 'noData', closing: 'tradeoff', text: 'lunarEndingNoDataTradeoff' },
    { outcome: 'success', closing: 'checked', text: 'lunarEndingSuccessChecked' },
    { outcome: 'success', closing: 'unchecked', text: 'lunarEndingSuccessUnchecked' },
    { outcome: 'success', closing: 'recovered', text: 'lunarEndingSuccessRecovered' },
    { outcome: 'extra', closing: 'checked', text: 'lunarEndingExtraChecked' },
    { outcome: 'extra', closing: 'unchecked', text: 'lunarEndingExtraUnchecked' },
    { outcome: 'extra', closing: 'recovered', text: 'lunarEndingExtraRecovered' },
  ],
  // Lines added after the closing text. They never change which ending it is.
  tags: {
    renewed: 'lunarTagRenewed', coauthor: 'lunarTagCoauthor', independent: 'lunarTagIndependent', ended: 'lunarTagEnded',
    hosted: 'lunarTagHosted', distant: 'lunarTagDistant', engineering: 'lunarTagEngineering', cruiseData: 'lunarTagCruiseData',
    siteConfirmed: 'lunarTagSiteConfirmed', accepted: 'lunarTagAccepted',
  },
  // Texts for the test stories of act two.
  testStories: { noResources: 'lunarTestNoResources', better: 'lunarTestBetter', clean: 'lunarTestClean', missed: 'lunarTestMissed', flyKnown: 'lunarFoundFly', redesign: 'lunarFoundRedesign' },

  sources: {
    segments: { source: 'NASA, Design and Develop Science Missions, slide 8', url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf#page=8' },
    weighing: { source: 'NASA, Design and Develop Science Missions, slide 19', url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf#page=19' },
    tradeSpace: { source: 'JPL, Space Mission Concept Development Using Concept Maturity Levels', url: 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299' },
    studyProducts: { source: 'NASA GSFC Mission Design Lab', url: 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/' },
    trajectory: { source: 'NASA General Mission Analysis Tool (GMAT)', url: 'https://software.nasa.gov/software/GSC-19468-1' },
    lowEnergy: { source: 'NASA, CAPSTONE Uses Gravity on Unusual, Efficient Route to the Moon', url: 'https://www.nasa.gov/missions/small-satellite-missions/capstone-uses-gravity-on-unusual-efficient-route-to-the-moon/' },
    massMargin: { source: 'NASA CubeSat 101 §6.4', url: 'https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=65' },
    integration: { source: 'NASA CubeSat 101 §2.11', url: 'https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=33' },
    retest: { source: 'NASA CubeSat 101 §6.9.1–6.9.2', url: 'https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=69' },
    reviews: { source: 'NASA NPR 7123.1D Appendix G', url: 'https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixG' },
    verification: { source: 'NASA Systems Engineering Handbook §5.3', url: 'https://www.nasa.gov/reference/5-3-product-verification/' },
    riskAcceptance: { source: 'NASA Systems Engineering Handbook §6.4', url: 'https://www.nasa.gov/reference/6-4-technical-risk-management/' },
    // Mission files. Keys match docs/story/lunar-history.md.
    H01: { source: 'NASA, Commercial Lunar Payload Services Update (Orbit Beyond, 2019)', url: 'https://www.nasa.gov/commercial-lunar-payload-services/commercial-lunar-payload-services-update/' },
    H02: { source: 'NASA Ends VIPER Project, Continues Moon Exploration (2024)', url: 'https://www.nasa.gov/news-release/nasa-ends-viper-project-continues-moon-exploration/' },
    H03: { source: 'NASA Administrator Statement on Return to Moon in Next Five Years (2019)', url: 'https://www.nasa.gov/news-release/nasa-administrator-statement-on-return-to-moon-in-next-five-years/' },
    H04: { source: 'NSSDCA, Ranger 6 (1964)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1964-007A' },
    H05: { source: 'NASA, Artemis I Launch Attempt Scrubbed (2022)', url: 'https://www.nasa.gov/blogs/missions/2022/09/03/artemis-i-launch-attempt-scrubbed/' },
    H06: { source: 'NASA, Artemis I Moon Rocket Departs Launch Pad 39B Ahead of Hurricane Ian (2022)', url: 'https://www.nasa.gov/blogs/missions/2022/09/26/artemis-i-moon-rocket-departs-launch-pad-39b-ahead-of-hurricane-ian/' },
    H07: { source: 'NASA, Intuitive Machines, SpaceX Move Moon Mission (2024)', url: 'https://www.nasa.gov/blogs/artemis/2024/02/13/carrying-nasa-science-intuitive-machines-spacex-move-moon-mission' },
    H08: { source: 'NASA, 50 Years Ago: Return to the Moon (Apollo 12, 1969)', url: 'https://www.nasa.gov/history/50-years-ago-return-to-the-moon/' },
    H09: { source: 'NASA NTRS 20150022370, The Use of Standards on the LADEE Mission', url: 'https://ntrs.nasa.gov/api/citations/20150022370/downloads/20150022370.pdf' },
    H10: { source: 'NASA Science, Lunar Trailblazer Moon Mission Ends (2025)', url: 'https://science.nasa.gov/blogs/lunar-trailblazer/2025/08/05/nasas-lunar-trailblazer-moon-mission-ends/' },
    H11: { source: 'NASA, Mission Team Determines Cause of Communications Issues for CAPSTONE (2022)', url: 'https://www.nasa.gov/blogs/missions/2022/07/07/mission-team-determines-cause-of-communications-issues-for-nasas-capstone/' },
    H12: { source: 'NASA Science, LCROSS (2009)', url: 'https://science.nasa.gov/mission/lcross/' },
    H13: { source: 'NSSDCA, Surveyor 2 (1966)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1966-084A' },
    H14: { source: 'NASA Science, Astrobotic Peregrine Mission One Concludes (2024)', url: 'https://www.nasa.gov/news-release/nasa-science-astrobotic-peregrine-mission-one-concludes/' },
    H15: { source: 'NASA, CAPSTONE Team Stops Spacecraft Spin (2022)', url: 'https://www.nasa.gov/blogs/missions/2022/10/07/capstone-team-stops-spacecraft-spin-clearing-hurdle-to-recovery/' },
    H16: { source: 'JPL, NASA Calls End to Lunar Flashlight After Some Tech Successes (2023)', url: 'https://www.jpl.nasa.gov/news/nasa-calls-end-to-lunar-flashlight-after-some-tech-successes/' },
    H17: { source: 'NASA Science, LunaH-Map Mission Ends (2023)', url: 'https://science.nasa.gov/blogs/lunah-map/2023/08/03/nasas-lunah-map-mission-ends-validates-science-instrument-performance/' },
    H18: { source: 'NSSDCA, Surveyor 5 (1967)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1967-084A' },
    H20: { source: 'NASA, Apollo 14 Demonstrated Spaceflight Challenges Are Solvable (1971)', url: 'https://www.nasa.gov/missions/apollo/apollo-14/apollo-14-demonstrated-spaceflight-challenges-are-solvable/' },
    H21: { source: 'NASA NTRS 20240004236, Navigation Doppler Lidar on IM-1 (2024)', url: 'https://ntrs.nasa.gov/api/citations/20240004236/downloads/MSS%202024_NDL%20Lunar%20Mission.pdf' },
    H22: { source: 'NSSDCA, Surveyor 3 (1967)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1967-035A' },
    H23: { source: 'NSSDCA, Surveyor 4 (1967)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1967-068A' },
    H24: { source: 'NASA, LRO Views Impact Site of HAKUTO-R Mission 1 Moon Lander (2023)', url: 'https://www.nasa.gov/centers-and-facilities/goddard/nasas-lro-views-impact-site-of-hakuto-r-mission-1-moon-lander/' },
    H25: { source: 'NASA Collects First Surface Science in Decades via Commercial Moon Mission (IM-1, 2024)', url: 'https://www.nasa.gov/missions/artemis/clps/nasa-collects-first-surface-science-in-decades-via-commercial-moon-mission/' },
    H26: { source: 'NASA Receives Some Data Before Intuitive Machines Ends Lunar Mission (IM-2, 2025)', url: 'https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/' },
    H27: { source: 'NASA Science Continues After Firefly’s First Moon Mission Concludes (Blue Ghost 1, 2025)', url: 'https://www.nasa.gov/news-release/nasa-science-continues-after-fireflys-first-moon-mission-concludes/' },
    H28: { source: 'NSSDCA, Surveyor 1 (1966)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1966-045A' },
    H29: { source: 'NSSDCA, Surveyor 3 (1967)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1967-035A' },
    H30: { source: 'NSSDCA, Surveyor 5 (1967)', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1967-084A' },
    H32: { source: 'NASA Identifies Cause of Artemis I Orion Heat Shield Char Loss (2024)', url: 'https://www.nasa.gov/missions/artemis/nasa-identifies-cause-of-artemis-i-orion-heat-shield-char-loss/' },
  } satisfies Record<string, Source>,
} as const

export type LunarDesign = {
  payload: keyof typeof lunarMission.payloads
  sensor: keyof typeof lunarMission.sensors
  power: keyof typeof lunarMission.powers
  route: keyof typeof lunarMission.routes
  mount: keyof typeof lunarMission.mounts
}
export type LunarRisk = keyof typeof lunarMission.risks
export type LunarStates = Record<LunarRisk, DefectState>
export type LunarPlan = keyof typeof lunarMission.surfacePlans | 'hosted'
export type LunarOutcome = keyof typeof lunarMission.outcomes
export type LunarClosing = keyof typeof lunarMission.closings

// Type checks: every text key exists in the dictionaries, and cards line up with the engine's event shape.
type Values<T> = T[keyof T]
type AnyCard = typeof lunarMission.storyEvents[number] | typeof lunarMission.devCards[number] | typeof lunarMission.launchCards[number]
  | typeof lunarMission.cruiseCards[number] | typeof lunarMission.lossCards[number]
type AnyChoice = AnyCard['choices'][number] | Values<typeof lunarMission.responses>[number]
type Keys = AnyCard['title' | 'detail' | 'quote' | 'file'] | AnyChoice['label' | 'detail' | 'result']
  | Values<typeof lunarMission.costs>['label'] | typeof lunarMission.fix.label
  | Values<typeof lunarMission.risks>['label' | 'description' | 'failure' | 'quote' | 'file' | 'found']
  | typeof lunarMission.endings[number]['text'] | Values<typeof lunarMission.tags> | Values<typeof lunarMission.testStories>
  | Values<typeof lunarMission.closings>['label' | 'description'] | Values<typeof lunarMission.outcomes>['label' | 'description']
  | typeof lunarMission.segments[number]['label' | 'carried'] | Values<typeof lunarMission.nightPlans>['label' | 'description']
  | Values<typeof lunarMission.surfacePlans>['label' | 'description'] | Values<typeof lunarMission.waivers>['label' | 'description']
  | Values<typeof lunarMission.remedies>['label' | 'description' | 'requires'] | Values<typeof lunarMission.supportUses>['label']
  | Values<typeof lunarMission.payloads | typeof lunarMission.sensors | typeof lunarMission.powers | typeof lunarMission.routes | typeof lunarMission.mounts | typeof lunarMission.partnerships>['label' | 'description']
  | Values<typeof lunarMission.records>['label'] | Values<typeof lunarMission.gates>['pass'] | typeof lunarMission.title | typeof lunarMission.brief
type Missing = Exclude<Keys, Message>
const everyKeyExists: Record<Missing, never> = {}
void everyKeyExists
// Cards carry the fields of MissionEvent that need no engine state: id, title, detail and choices with id, label, detail.
type EventShape = { id: string; title: Message; detail: Message; choices: readonly { id: string; label: Message; detail: Message }[] }
void (lunarMission.devCards satisfies readonly EventShape[])

export const lunarDepartments = ['science', 'flight', 'dynamics', 'ground'] as const
export type LunarDepartment = typeof lunarDepartments[number]
export const lunarProposals = {
  science: { label: 'lunarScience', options: ['dropKit', 'basicPayload'], fallback: 'dropKit', brief: 'lunarScienceBrief' },
  flight: { label: 'lunarFlight', options: ['mount', 'partnerMount'], fallback: 'mount', brief: 'lunarFlightBrief' },
  dynamics: { label: 'lunarDynamics', options: ['reroute'], fallback: 'reroute', brief: 'lunarDynamicsBrief' },
  ground: { label: 'lunarGround', options: ['dropKit', 'reroute'], fallback: 'reroute', brief: 'lunarGroundBrief' },
} as const satisfies Record<LunarDepartment, { label: Message; options: readonly (keyof typeof lunarMission.remedies)[]; fallback: keyof typeof lunarMission.remedies; brief: Message }>

// --- Rules ---

export const lunarRiskIds = Object.keys(lunarMission.risks) as LunarRisk[]
// Items every flight depends on. The night item only matters when the player tries to wake the lander.
export const lunarFlightRisks = ['software', 'pressure', 'thrusters', 'descent', 'payload'] as const satisfies readonly LunarRisk[]
export const lunarUntested = (): LunarStates => ({ software: untested, pressure: untested, thrusters: untested, descent: untested, payload: untested, night: untested })

// The payload and the night item belong to the chosen hardware, so a redesign brings a new truth.
export function lunarItemId(design: LunarDesign, id: LunarRisk) {
  return id === 'payload' ? `lunar:payload:${design.payload}` : id === 'night' ? `lunar:night:${design.power}` : `lunar:${id}`
}
export function lunarMaturity(design: LunarDesign, id: LunarRisk): Maturity {
  return id === 'payload' ? lunarMission.payloads[design.payload].maturity : id === 'night' ? lunarMission.powers[design.power].maturity : lunarMission.risks[id].maturity
}
// Redundancy does not change the truth. A backup lidar turns a descent defect from fatal into a tilted landing.
export function lunarSeverity(design: LunarDesign, id: LunarRisk, protectionOff = false): Severity {
  if (id === 'descent') return lunarMission.sensors[design.sensor].backup ? 'degraded' : 'fatal'
  if (id === 'thrusters' && protectionOff) return 'fatal'
  return lunarMission.risks[id].severity
}

export function lunarMass(design: LunarDesign, extraKg = 0, measured = true, allocation: number = lunarMission.launchAllocationKg) {
  const dry = lunarMission.busDryKg + lunarMission.payloads[design.payload].massKg + lunarMission.sensors[design.sensor].massKg
    + lunarMission.powers[design.power].massKg + (measured ? lunarMission.mounts[design.mount].growthKg : 0) + extraKg
  const loaded = allocation - dry
  return { dry, loaded, margin: loaded - lunarMission.routes[design.route].propellantKg }
}

// What the workbench shows: the player's belief for each item, never the truth.
export function lunarRisks(design: LunarDesign, states: LunarStates, protectionOff = false) {
  return lunarRiskIds.map(id => ({ id, level: states[id].level, maturity: lunarMaturity(design, id), severity: lunarSeverity(design, id, protectionOff), risk: defectBelief(lunarMaturity(design, id), states[id]) }))
}
// Forecast from beliefs. `minimum` here is the chance that nothing fatal happens and no flight item fails at all.
export function lunarOdds(design: LunarDesign, states: LunarStates) {
  return missionOdds(lunarRisks(design, states).filter(item => item.id !== 'night'))
}
// Items the player has to sign for at flight review: believed above the threshold, which includes a known unfixed defect.
export function lunarVerified(state: DefectState) {
  return state.fixed || (!state.found && state.level >= lunarMission.checkedLevel)
}

export function lunarAcceptance(design: LunarDesign, states: LunarStates) {
  return lunarFlightRisks.filter(id => defectBelief(lunarMaturity(design, id), states[id]) > reviewRiskThreshold)
}

// External events. Verification never changes these draws.
// The pull-in takes the first or second draw. The other draws take cards from `order`, skipping any whose condition
// does not hold at that moment, so every draw week brings an event.
export function lunarDevDeck(seed: number) {
  const pullInSlot = drawFromPool(seed, 'lunar:pullIn', [0, 1])!
  const pool: string[] = lunarMission.devCards.map(item => item.id).filter(id => id !== 'PullIn')
  const order: string[] = []
  while (pool.length) order.push(...pool.splice(pool.indexOf(drawFromPool(seed, `lunar:dev:${order.length}`, pool)!), 1))
  return { pullInSlot, order: order as Exclude<typeof lunarMission.devCards[number]['id'], 'PullIn'>[] }
}
export function lunarFlightCards(seed: number) {
  return {
    launch: drawFromPool(seed, 'lunar:launch', lunarMission.launchCards.map(item => item.id))!,
    cruise: drawFromPool(seed, 'lunar:cruise', lunarMission.cruiseCards.map(item => item.id))!,
  }
}

export type LunarSetup = {
  design: LunarDesign
  states: LunarStates
  marginKg: number
  credits: number
  revised?: boolean
  legacyLaunchOrder?: boolean
  responseReserves?: Partial<Record<LunarRisk, number>>
  secondPayload?: boolean
  icd?: 'reviewed' | 'open'
}
// The player's choice at a card, a failure response, the surface plan or the night. `options` lists what is available now.
export type LunarPick = (prompt: string, options: readonly string[], view: { spareKg: number; credits: number; windows: number }) => string
export type LunarStep = { segment: string; prompt?: string; choice?: string; failed?: LunarRisk; spareKg: number; credits: number }

// Seven-step flight. Nothing is rolled: card draws and every item's truth come from the seed, the rest is fixed rules.
export type LunarFlightView = { spareKg: number; credits: number; windows: number; downlink: number; restartCost: number; more: number }
export type LunarFlightUpdate =
  | { type: 'decision'; segment: string; prompt: string; options: readonly string[]; view: LunarFlightView }
  | { type: 'segment'; segment: string; view: LunarFlightView }

export function* lunarFlight(seed: number, setup: LunarSetup): Generator<LunarFlightUpdate, LunarFlightResult, string | null> {
  const { design, states, revised } = setup
  const cards = lunarFlightCards(seed)
  const payload = lunarMission.payloads[design.payload]
  const backup = lunarMission.sensors[design.sensor].backup
  const exposed = new Set<LunarRisk>()
  const failures: LunarRisk[] = []
  const flown: LunarRisk[] = []
  const steps: LunarStep[] = []
  let spareKg = setup.marginKg
  const responseReserves = { ...setup.responseReserves }
  let credits = setup.credits - Object.values(responseReserves).reduce((total, reserved) => total + reserved, 0)
  const responseFunds = (id: LunarRisk) => credits + (responseReserves[id] ?? 0)
  function payResponse(id: LunarRisk, cost: number) {
    const reserved = Math.min(cost, responseReserves[id] ?? 0)
    if (reserved) responseReserves[id] = responseReserves[id]! - reserved
    credits -= cost - reserved
  }
  let windows = 0
  let segment = 'launch'
  let protectionOff = false
  let cruiseData = false
  let payloadChecked = false
  let engineering = false
  let secondPayloadUsable = false
  let downlink: number = lunarMission.downlinkWindows
  let more = 0
  let reserveFailure: { need: number; margin: number } | undefined
  const spends: LunarSurfaceSpend[] = []
  function spend(source: LunarSurfaceSpend['source'], count: number) {
    windows -= count
    if (count) spends.push({ source, count })
  }
  let correctionExtra = 0
  let nightWindows: number = lunarMission.powers[design.power].nightWindows

  const effect = (list: readonly { id: string; effect: Effect }[], id: string) => list.find(item => item.id === id)!.effect
  const apply = (change: Effect) => { credits += change.credits ?? 0; spareKg += change.propellantKg ?? 0; windows += change.windows ?? 0 }
  const view = () => ({ spareKg, credits, windows, downlink, restartCost: payloadChecked ? 0 : 1, more })
  function* ask(prompt: string, options: readonly string[]): Generator<LunarFlightUpdate, string, string | null> {
    const choice = yield { type: 'decision', segment, prompt, options, view: view() }
    if (choice === null) throw new Error(`${prompt}: choice required`)
    if (!options.includes(choice)) throw new Error(`${prompt}: ${choice} is not available`)
    steps.push({ segment, prompt, choice, spareKg, credits })
    return choice
  }
  // A defect shows up when the truth has one that was never fixed, or when a skipped check let a second one through.
  const defect = (id: LunarRisk) => {
    const item = lunarItemId(design, id)
    flown.push(id)
    const there = defectInFlight(seed, item, lunarMaturity(design, id), states[id]) || (exposed.has(id) && hasDefect(seed, `${item}:exposed`, lunarMission.exposedChance))
    if (there) steps.push({ segment, failed: id, spareKg, credits })
    if (there && id !== 'night') failures.push(id)
    return there
  }
  const checked = (id: LunarRisk) => lunarVerified(states[id]) && (revised || !exposed.has(id))
  // Surface window accounting for the debrief: windows after landing, windows left for science, windows per batch.
  let surface: LunarSurfaceLedger | null = null
  const end = (outcome: LunarOutcome, critical: LunarFlightResult['critical'], batches = 0, upright = false): LunarFlightResult => {
    let closing: LunarClosing
    if (outcome === 'success' || outcome === 'extra') closing = failures.length ? 'recovered' : flown.filter(id => (!revised || id !== 'night') && !checked(id)).length <= 1 ? 'checked' : 'unchecked'
    else if (critical === 'choice' || critical === 'windows') closing = 'tradeoff'
    else if (critical === 'reserve') closing = 'listed'
    else closing = checked(critical) ? 'missed' : 'listed'
    return { outcome, closing, critical, upright, batches, segment, failures, flown, steps, spareKg,
      credits: credits + Object.values(responseReserves).reduce((total, reserved) => total + reserved, 0), cruiseData, engineering, protectionOff, secondPayloadUsable: revised ? secondPayloadUsable : Boolean(setup.secondPayload) && upright, cards, exposed: [...exposed], surface,
      ...(reserveFailure && { reserveFailure }) }
  }
  const lost = (critical: LunarRisk | 'reserve') => end(cruiseData ? 'salvage' : 'lost', critical)

  // 1 Launch
  yield { type: 'segment', segment, view: view() }
  const launch = lunarMission.launchCards.find(item => item.id === cards.launch)!
  if (launch.id === 'Scrub') {
    const choice = yield* ask('card:Scrub', credits >= 8 ? ['Wait', 'Rush'] : ['Rush'])
    if (choice === 'Rush') exposed.add('software'); else apply(effect(launch.choices, choice))
  } else if (launch.id === 'Weather') {
    const choice = yield* ask('card:Weather', credits >= 6 ? ['Rollback', 'Slip'] : ['Slip'])
    if (choice === 'Slip') correctionExtra = 2; else apply(effect(launch.choices, choice))
  }

  function* lightning() {
    const choice = yield* ask('card:Lightning', states.software.level >= 3 && (!states.software.found || states.software.fixed) ? ['Check', 'Press', 'Switch'] : ['Check', 'Press'])
    if (choice === 'Press') exposed.add('software'); else apply(effect(launch.choices, choice))
  }
  if (launch.id === 'Lightning' && setup.legacyLaunchOrder) yield* lightning()

  // 2 Earth-orbit checkout
  segment = 'checkout'
  yield { type: 'segment', segment, view: view() }
  if (launch.id === 'Lightning' && !setup.legacyLaunchOrder) yield* lightning()
  if (defect('software')) {
    const cost = setup.icd === 'reviewed' ? 0 : 6 + (setup.icd === 'open' ? lunarMission.uplinkOpenExtra : 0)
    const choice = yield* ask('risk:software', responseFunds('software') >= cost ? ['Uplink', 'Wait', 'Disable'] : ['Wait', 'Disable'])
    if (choice === 'Uplink') payResponse('software', cost)
    else if (choice === 'Wait') apply(effect(lunarMission.responses.software, choice))
    else protectionOff = true
  }

  // 3 Lunar transfer
  segment = 'transfer'
  yield { type: 'segment', segment, view: view() }
  if (cards.cruise === 'CruiseScience') {
    const choice = yield* ask('card:CruiseScience', credits >= 4 ? ['On', 'Off'] : ['Off'])
    if (choice === 'On') {
      credits -= 4; cruiseData = true; payloadChecked = true
      if (revised) exposed.add('payload')
    }
  }
  const correction = lunarMission.routes[design.route].correctionKg + correctionExtra
  if (spareKg < correction) reserveFailure = { need: correction, margin: spareKg }
  spareKg -= correction
  if (defect('pressure')) {
    spareKg -= lunarMission.pressureLossKg
    const choice = yield* ask('risk:pressure', spareKg >= 0 ? ['Emergency', 'Continue', 'Flyby', 'Diagnose'] : ['Emergency', 'Flyby', 'Diagnose'])
    if (choice === 'Emergency') { apply(effect(lunarMission.responses.pressure, choice)); exposed.add('descent') }
    else if (choice === 'Flyby') return end('salvage', 'pressure')
    else if (choice === 'Diagnose') { engineering = true; return lost('pressure') }
  }

  // 4 Lunar orbit insertion
  segment = 'orbit'
  yield { type: 'segment', segment, view: view() }
  if (spareKg < 0) return lost(failures.at(-1) ?? 'reserve')
  if (defect('thrusters')) {
    if (lunarSeverity(design, 'thrusters', protectionOff) === 'fatal') return lost('thrusters')
    const choice = yield* ask('risk:thrusters', [...(responseFunds('thrusters') >= 6 && spareKg >= 2 ? ['Simulate'] : []), ...(spareKg >= 6 ? ['Reverse'] : []), 'Flyby'])
    if (choice === 'Flyby') return end('salvage', 'thrusters')
    const response = effect(lunarMission.responses.thrusters, choice)
    if (response.credits) payResponse('thrusters', -response.credits)
    apply({ ...response, credits: 0 })
  }

  // 5 Descent
  segment = 'descent'
  yield { type: 'segment', segment, view: view() }
  let upright = true
  if (defect('descent')) {
    if (!backup) return lost('descent')
    const canPatch = spareKg >= 3 && (!revised || (lunarVerified(states.descent) && !exposed.has('descent')))
    const choice = yield* ask('risk:descent', canPatch ? ['Patch', 'Switch', 'Abort'] : ['Switch', 'Abort'])
    if (choice === 'Abort') return end('salvage', 'descent')
    if (choice === 'Patch') { apply(effect(lunarMission.responses.descent, choice)); upright = states.descent.level >= lunarMission.checkedLevel && !exposed.has('descent') }
    else upright = false
  }
  const daylight = upright ? lunarMission.daylightWindows : lunarMission.tiltedWindows
  windows = daylight + (revised ? nightWindows : 0)
  const landedWindows = windows
  if (revised && !upright) spends.push({ source: 'tilt', count: lunarMission.daylightWindows - lunarMission.tiltedWindows })

  // 6 First lunar day
  segment = 'surface'
  yield { type: 'segment', segment, view: view() }
  if (cards.cruise === 'Eclipse') {
    const choice = yield* ask('card:Eclipse', nightWindows > 0 ? ['Shelter', 'Battery', 'Exposed'] : ['Shelter', 'Exposed'])
    if (choice === 'Shelter') spend('eclipse', 1)
    else if (choice === 'Battery') {
      if (revised) spend('eclipse', 1)
      else nightWindows -= 1
    } else exposed.add('payload')
  }
  if (!revised) windows += nightWindows
  if (defect('payload')) {
    const choice = yield* ask('risk:payload', ['Restart', 'LowRate', 'Engineering'])
    if (choice === 'Restart') spend('restart', payloadChecked ? 0 : 1)
    else if (choice === 'LowRate') {
      downlink += 1
      spends.push({ source: 'lowRate', count: 1 })
    }
    else {
      engineering = true
      surface = { landed: landedWindows, usable: 0, each: payload.collectWindows + downlink,
        ...(revised && { spends: [...spends, { source: 'diagnostics', count: windows }] }) }
      return end('noData', 'payload', 0, upright)
    }
  }
  const hosted = revised && Boolean(setup.secondPayload) && upright && lunarPlanBatches(design, 'hosted', windows, downlink).batches > 0
  const canChoosePriority = lunarPlanBatches(design, 'extra', windows, downlink).batches > 1
    || (lunarPlanBatches(design, 'extra', windows, downlink).batches > 0 && windows % (payload.collectWindows + downlink) === 0)
  const plans = revised ? [...(canChoosePriority ? ['priority'] : []), 'extra',
    ...(windows >= lunarMission.surfacePlans.diagnostics.reservedWindows ? ['diagnostics'] : []), ...(hosted ? ['hosted'] : [])]
    : Object.keys(lunarMission.surfacePlans)
  const plan = (yield* ask('plan', plans)) as LunarPlan
  const reserved = surfacePlan(plan).reservedWindows
  if (plan === 'diagnostics') engineering = true
  if (plan === 'hosted') secondPayloadUsable = true
  const each = payload.collectWindows + downlink
  const beforePlan = windows
  if (reserved) spend(plan === 'hosted' ? 'hosted' : 'diagnostics', reserved)
  if (revised && plan === 'extra' && canChoosePriority && itemRandom(seed, 'lunar:surface:late-drop') < lunarMission.lateOutageChance) spend('late', 1)
  const usable = Math.max(0, windows)
  surface = { landed: landedWindows, usable, each, ...(revised && { spends }) }
  let batches = lunarPlanBatches(design, plan === 'hosted' || plan === 'diagnostics' ? 'extra' : plan, usable, downlink).batches
  let left = usable - batches * each

  // 7 Lunar night
  segment = 'night'
  yield { type: 'segment', segment, view: view() }
  more = Math.min(payload.maxBatches - batches, Math.floor((left + lunarMission.wakeWindows) / each))
  if (upright && (!revised || (design.power === 'extended' && more > 0))
    && credits >= lunarMission.wakeCredits && (yield* ask('night', ['rest', 'wake'])) === 'wake') {
    credits -= lunarMission.wakeCredits
    if (!defect('night')) {
      left += lunarMission.wakeWindows
      batches += more
      left -= more * each
    }
  }
  if (batches === 0) {
    const byChoice = plan === 'diagnostics' && Math.floor(beforePlan / each) >= 1
    const cause = revised ? byChoice ? 'choice' : 'windows' : byChoice ? 'choice' : !upright ? 'descent' : failures.at(-1) ?? 'choice'
    return end('noData', cause, 0, upright)
  }
  const extra = batches >= lunarMission.stretchBatches || (revised ? secondPayloadUsable : Boolean(setup.secondPayload) && upright)
  return end(extra ? 'extra' : 'success', 'choice', batches, upright)
}

export type LunarSurfaceSpend = { source: 'tilt' | 'eclipse' | 'restart' | 'lowRate' | 'diagnostics' | 'hosted' | 'late'; count: number }
export type LunarSurfaceLedger = { landed: number; usable: number; each: number; spends?: LunarSurfaceSpend[] }
export const surfacePlan = (plan: LunarPlan) => plan === 'hosted' ? lunarMission.hostedPlan : lunarMission.surfacePlans[plan]

// How many batches a surface plan brings home with the windows left. The flight runs the same arithmetic.
export function lunarPlanBatches(design: LunarDesign, plan: LunarPlan, windows: number, downlink: number = lunarMission.downlinkWindows) {
  const payload = lunarMission.payloads[design.payload]
  const each = payload.collectWindows + downlink
  const possible = Math.min(payload.maxBatches, Math.floor(Math.max(0, windows - surfacePlan(plan).reservedWindows) / each))
  return { each, batches: surfacePlan(plan).deliverAll ? possible : Math.min(possible, lunarMission.minimumBatches) }
}

export type LunarFlightResult = {
  outcome: LunarOutcome; closing: LunarClosing; critical: LunarRisk | 'reserve' | 'choice' | 'windows'; upright: boolean
  batches: number; segment: string; failures: LunarRisk[]; flown: LunarRisk[]; steps: LunarStep[]; spareKg: number
  credits: number; cruiseData: boolean; engineering: boolean; protectionOff: boolean; secondPayloadUsable: boolean
  cards: ReturnType<typeof lunarFlightCards>; exposed: LunarRisk[]; surface: LunarSurfaceLedger | null
  reserveFailure?: { need: number; margin: number }
}

export function flyLunar(seed: number, setup: LunarSetup, pick: LunarPick) {
  const flight = lunarFlight(seed, setup)
  let next = flight.next()
  while (!next.done) {
    const update = next.value
    next = flight.next(update.type === 'decision' ? pick(update.prompt, update.options, update.view) : null)
  }
  return next.value
}
