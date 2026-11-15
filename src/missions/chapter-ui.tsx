import type { ReactNode } from 'react'
import type { Copy, CostItem, Game, MissionRules } from '../game/types'
import type { Message, Translate } from '../i18n'
import { hasDefect, percent, testResult, topLevel, type DefectState, type Maturity, type Outcome, type Severity } from '../game/risk'
import { Disclosure, missionMoney } from '../ui/shared'
import type { MissionUi } from './index'
import { currentEvidence } from '../game/mission'
import { approvedWeek, completed, nextDefectCopy, severityMessage } from './chapter'
import { flyOrbital, orbitalCapacity, orbitalShortfall, orbitalCarried, orbitalDegradedCapacity, orbitalLaunch as orbital, orbitalLinkMaturity, orbitalNextStep, orbitalOdds, orbitalRiskIds, orbitalRisks, type OrbitalDesign } from './orbital-launch'
import { orbitalPlan, orbitalRecords, orbitalRules, orbitalState } from './orbital-rules'
import { lunarAllocation, lunarBudgetForecast, lunarDesign, lunarFlightRevised, lunarPlanCost, lunarRules, lunarState, lunarStates, massBudget } from './lunar-rules'
import { lunarItemId, lunarMaturity, lunarMission as lunar, lunarOdds, lunarPlanBatches, lunarRisks, lunarVerified, type LunarFlightResult } from './lunar-mission'

// Frames a low forecast: it reflects what has been checked, not a verdict on the lander.
const levels = ['riskLevelNone', 'riskLevelAnalysis', 'riskLevelUnit', 'riskLevelEndToEnd'] as const
const inert = () => null

type WorkRisk = { label: Message; risk: number; level: number; severity: Severity; notes: ReactNode }

function RiskList({ t, risks, odds, note }: {
  t: Translate; risks: WorkRisk[]; odds: { minimum: number; noFatal: number }; note?: Message
}) {
  return <Disclosure label={t('riskTitle')} value={t('riskOddsMinimum', { percent: percent(odds.minimum) })}>
    <p>{t('riskOddsNoFatal', { percent: percent(odds.noFatal) })}</p>
    {note && <p>{t(note)}</p>}
    {risks.map(({ label, severity, risk, level, notes }) => <div className="risk-item" key={label}>
      <div className="risk-head"><strong>{t(label)}</strong><span>{t('riskChance', { percent: percent(risk) })}</span></div>
      <small>{t('riskLevel', { level: t(levels[level]) })} · {t(severityMessage(severity))}</small>
      <div>{notes}</div>
    </div>)}
    <small>{t('riskBeliefNote')}</small>
  </Disclosure>
}

function DefectNotes({ state, maturity, work, t }: { state: DefectState; maturity: Maturity; work?: CostItem; t: Translate }) {
  if (state.fixed) return <p>{t('riskFixed')}</p>
  if (state.found) return <p className="warning">{t('riskTestFound')}</p>
  const next = nextDefectCopy(state, maturity, work)
  return next && <small>{t('riskNextStep', { work: t(next.work.label), ...next.work, percent: next.belief })}</small>
}

function orbitalEstimate(game: Game, t: Translate) {
  const d = game.design as OrbitalDesign
  const known = orbitalState(game)
  const { lift, link } = orbitalRisks(game.seed, d, known)
  const work = orbital.costs[orbital.risks.lift.steps[known.lift]]
  return <>
    <p>{t('orbitalCarried', { count: orbitalCarried(d) })} · {t('orbitalCapacityAnalysis', { count: orbitalCapacity(d) })}</p>
    <RiskList t={t} odds={orbitalOdds(game.seed, d, known)} risks={[
      { ...lift, label: orbital.risks.lift.label, notes: <>
        <p>{t('orbitalRiskLiftDetail', { ...lift.known, margin: lift.limit })}</p>
        {work && <small>{t(known.lift + 1 === topLevel ? 'riskNextReveal' : 'riskNextRange', { ...work, work: t(work.label) })}</small>}
      </> },
      { ...link, label: orbital.risks.link.label, notes: <DefectNotes state={known.link} maturity={orbitalLinkMaturity(d)} work={orbital.costs[orbital.risks.link.steps[known.link.level]]} t={t} /> },
    ]} />
  </>
}

function lunarEstimate(game: Game, t: Translate) {
  const d = lunarDesign(game)
  const states = lunarStates(game)
  const mass = massBudget(game)
  return <>
    <p>{t('lunarPropellantLoaded', { ...mass, allocation: lunarAllocation(game) })} · {t('lunarPropellantNeed', { count: lunar.routes[d.route].propellantKg })}</p>
    <p>{t(mass.margin < 0 ? 'lunarMarginShort' : 'lunarMarginOk', { count: Math.abs(mass.margin) })}</p>
    {!completed(game, 'trade') && !game.evidence && <small>{t('lunarEstimateNote')}</small>}
    <RiskList t={t} odds={lunarOdds(d, states)} note="lunarForecastNote" risks={lunarRisks(d, states).map(item => ({
      ...item, label: lunar.risks[item.id].label,
      notes: <DefectNotes state={states[item.id]} maturity={item.maturity} work={lunar.costs[lunar.risks[item.id].steps[item.level]]} t={t} />,
    }))} />
  </>
}

function RiskResults({ game, rules, t, children }: { game: Game; rules: MissionRules; t: Translate; children?: ReactNode }) {
  const signed = game.log.find(entry => entry.review?.gate === 'FRR' && entry.review.passed)?.review?.waivers ?? []
  return <section className="risk-panel">
    <h2>{t('riskFlightTitle')}</h2>
    {children}
    {signed.length > 0 && <p>{t('riskAccepted', { items: signed.map(item => t(item.label)).join(t('listSeparator')) })}</p>}
    <small>{t('riskSeed', { seed: game.seed })} · {t('budgetLabel')} {missionMoney(rules, game.flight?.credits ?? game.credits, t)}</small>
  </section>
}

function OrbitalDebrief({ game, t }: { game: Game; t: Translate }) {
  const d = game.design as OrbitalDesign
  const knowledge = orbitalState(game)
  const outcomes = (game.flight?.outcomes ?? []) as Outcome[]
  const flight = game.flight as (typeof game.flight & ReturnType<typeof flyOrbital>) | null
  const records = orbitalRules.records?.(game) ?? []
  return <RiskResults game={game} t={t} rules={orbitalRules}>
    {flight?.delivered && <>
      <p>{t(d.orbit === 'sso' ? 'orbitalClientSso' : 'orbitalClientLow', { premium: flight.premium ?? 0 })}</p>
      {flight.late && <p>{t('orbitalLateFee', { fee: flight.fee })}</p>}
      <p>{t(records.includes(orbitalRecords.onTime) ? 'orbitalEarnedOnTime' : 'orbitalNoOnTime', {
        week: approvedWeek(game) ?? game.week, limit: orbital.onTimeWeek,
      })}</p>
      <p>{t(records.includes(orbitalRecords.verified) ? 'orbitalEarnedVerified' : 'orbitalNoVerified', {
        lift: knowledge.lift, link: knowledge.link.level, need: orbital.verifiedLevels,
      })}</p>
      {flight.marginProven && <p>{t('orbitalEarnedMargin', { kg: orbital.lunarMarginKg })}</p>}
    </>}
    {flight && <p>{t('orbitalDebriefOrbit', {
      orbit: t(orbital.orbits[d.orbit].label), capacity: orbitalCapacity(d), carried: orbitalCarried(d),
      shortfall: orbitalShortfall(game.seed, d.stage), margin: flight.marginKg,
    })}</p>}
    {orbitalRiskIds.map(id => {
      const outcome = outcomes.find(item => item.id === id)
      const next = outcome?.failed && orbitalNextStep(game.seed, d, knowledge, id)
      return <div key={id} className="risk-item">
        <strong>{t(orbital.risks[id].label)}</strong>
        <p>{outcome ? t(outcome.failed ? 'riskFlightFailed' : 'riskFlightHeld', { item: t(orbital.risks[id].label), percent: percent(outcome.believed) }) : t('chapterDebriefUntested')}</p>
        {outcome?.failed && <p>{t(orbital.risks[id].failure)}</p>}
        {id === 'link' && outcome?.failed && knowledge.link.found && <p>{t('orbitalKnownLinkFlown', { weeks: orbital.fixes.link.weeks, credits: orbital.fixes.link.credits })}</p>}
        {outcome?.failed && !next && (id === 'lift' ? knowledge.lift : knowledge.link.level) >= topLevel && <p>{t('riskDebriefTop')}</p>}
        {next && <p>{t(next.known ? 'riskDebriefRange' : next.found ? 'riskDebriefNext' : 'riskDebriefMissed', {
          weeks: next.weeks, ...next.known, work: t(orbital.costs[next.work].label), cost: t('credits', { count: next.credits }), unit: 'kg',
        })}</p>}
        {id === 'link' && knowledge.link.fixed && <p>{t('chapterDebriefFixed')}</p>}
      </div>
    })}
  </RiskResults>
}

function LunarDebrief({ game, t }: { game: Game; t: Translate }) {
  const state = lunarState(game)
  const d = lunarDesign(game)
  const states = lunarStates(game)
  const flight = game.flight as LunarFlightResult & { siteConfirmed: boolean } | null
  const risks = lunarRisks(d, states)
  const tag = state.contract?.ended ? lunar.tags.ended : state.contract?.left === 0 ?
    state.contract.kind === 'funding' ? lunar.tags.renewed : lunar.tags.coauthor : lunar.tags.independent
  return <RiskResults game={game} rules={lunarRules} t={t}>
    <p>{t(tag)}</p>
    {state.secondPayload && !flight?.secondPayloadUsable && <p>{t('lunarHostedPending')}</p>}
    {state.governmentCold && <p>{t(lunar.tags.distant)}</p>}
    {flight?.engineering && <p>{t(lunar.tags.engineering)}</p>}
    {flight?.cruiseData && <p>{t(lunar.tags.cruiseData)}</p>}
    {flight?.siteConfirmed && <p>{t(lunar.tags.siteConfirmed)}</p>}
    {flight?.protectionOff && <p>{t('lunarDebriefProtectionOff')}</p>}
    {state.icd === 'open' && <p>{t('lunarDebriefIcdOpen')}</p>}
    {game.events.includes('PartsAlert:Fly') && <p>{t('lunarPartsAccepted')}</p>}
    {flight && <p>{t('lunarFlightRemaining', { kg: flight.spareKg, credits: flight.credits })}</p>}
    {flight?.surface && <section>
      <p>{t('lunarSurfaceLedger', { landed: flight.surface.landed, usable: flight.surface.usable, each: flight.surface.each, batches: flight.batches })}</p>
      {flight.surface.spends?.map(({ source, count }) => <p key={source}>{t(`lunarWindows_${source}`, { count })}</p>)}
    </section>}
    {flight?.outcome === 'success' || flight?.outcome === 'extra' ? <p>{t('lunarClientDelivery')}</p> : null}
    {flight?.secondPayloadUsable && <p>{t('lunarClientHosted')}</p>}
    {flight && flight.exposed.length > 0 && <p>{t('lunarExposedCount', { count: flight.exposed.length })}</p>}
    {flight && risks.map(({ id, level, risk }) => {
      const item = lunar.risks[id]
      const state = states[id]
      const maturity = lunarMaturity(d, id)
      const identity = lunarItemId(d, id)
      const hit = flight.steps.some(step => step.failed === id)
      const flew = flight.flown.includes(id)
      const next = level < topLevel && !state.found && item.steps[level]
      const cost = next ? lunar.costs[next] : null
      return <div key={id} className="risk-item">
        <strong>{t(item.label)}</strong>
        <p>{t('riskLevel', { level: t(levels[level]) })} · {t(lunarFlightRevised(game) && !flight.engineering && !state.found
          ? 'lunarTruthUnknown' : hasDefect(game.seed, identity, maturity) ? 'lunarTruthDefect' : 'lunarTruthClean')}</p>
        <p>{flew ? t(hit ? 'riskFlightFailed' : 'riskFlightHeld', { item: t(item.label), percent: percent(risk) }) : t('chapterDebriefUntested')}</p>
        {state.fixed && <p>{t('chapterDebriefFixed')}</p>}
        {hit && cost && (!lunarFlightRevised(game) || flight.engineering) && <p>{t(flight.exposed.includes(id) && !hasDefect(game.seed, identity, maturity) ? 'lunarExposedDefect'
          : testResult(game.seed, identity, maturity, level + 1) === 'found' ? 'riskDebriefNext' : 'riskDebriefMissed', {
          work: t(cost.label), weeks: cost.weeks, cost: t('credits', { count: cost.credits }),
        })}</p>}
      </div>
    })}
  </RiskResults>
}

const labUses = ['integrate', 'rehearse'] as const
const labUseName = { integrate: 'orbitalLabIntegration', rehearse: 'orbitalLabRehearsal' } as const
const labDeadline = orbital.labSlot.expiresWeek
const canBookLab = (week: number | null) => week !== null && week < labDeadline

function OrbitalPreview({ game, t }: { game: Game; t: Translate }) {
  const d = game.design as OrbitalDesign
  const { lift } = orbitalRisks(game.seed, d, orbitalState(game))
  const { credits: cost, lab } = orbitalPlan(game)
  const ground = orbital.grounds[d.ground]
  const source = orbital.sources.tradeSpace
  return <>
    <p className={lift.limit - lift.known.min < 0 ? 'warning' : 'action-note'}>{t(lift.known.min === lift.known.max ? 'orbitalTestedPreview'
      : lift.limit < 0 ? 'orbitalPreviewOver' : 'orbitalPreview', {
      carried: orbitalCarried(d), capacity: orbitalCapacity(d), margin: Math.abs(lift.limit), measured: lift.limit - lift.known.min, min: lift.known.min, max: lift.known.max,
      orbit: t(orbital.orbits[d.orbit].label),
    })}</p>
    <p>{t('orbitalDataPlan', { required: orbital.confirmationUnits, capacity: ground.capacity,
      degraded: orbitalDegradedCapacity(d, orbitalState(game)) })}</p>
    {cost > 0 && <p className={cost > game.credits ? 'warning' : 'action-note'}>
      {t(cost > game.credits ? 'orbitalFreezeBlocked' : 'orbitalEventCutEstimate', { cost, budget: game.credits })}
    </p>}
    {orbitalState(game).lab && (game.week >= labDeadline
      ? <p className="warning">{t('orbitalLabSlotExpired')}</p>
      : <p className="action-note">{t('orbitalLabDeadline', { week: labDeadline })}{' '}
        {labUses.map(use => {
          const week = lab[use]
          if (week === null) return null
          return <span key={use}>{t(week < labDeadline ? 'orbitalLabEarliest' : 'orbitalLabTooLate', {
            work: t(labUseName[use]), week,
          })}{' '}</span>
        })}
      </p>)}
    {game.stage === 'design' && <p className="action-note">{t('orbitalTradeSource')} <a href={source.url} target="_blank" rel="noreferrer">{source.source}</a></p>}
    {(game.stage === 'build' || game.stage === 'integration') && d.stage === 'highMargin' &&
      <p className="action-note">{t('orbitalHotfireSource')} <a href={orbital.sources.hotfire.url} target="_blank" rel="noreferrer">{orbital.sources.hotfire.source}</a></p>}
  </>
}

function LunarPreview({ game, t }: { game: Game; t: Translate }) {
  const mass = massBudget(game)
  const budget = lunarBudgetForecast(game)
  const d = lunarDesign(game)
  const route = lunar.routes[d.route]
  return <>
    <p className={mass.margin < lunar.reserveKg ? 'warning' : 'action-note'}>{t('lunarPreview', {
      margin: mass.margin, reserve: lunar.reserveKg, dry: mass.dry,
    })}</p>
    <p className={budget.shortfall ? 'warning' : 'action-note'}>
      {t('lunarBudgetForecast', budget)}{' '}
      {budget.savings > 0 && <>{t('lunarBudgetSupport', budget)}{' '}</>}
      {budget.shortfall > 0 && t('lunarBudgetShortfall', budget)}
    </p>
    <p>{t('lunarRouteBudget', { correction: route.correctionKg, propellant: route.propellantKg,
      week: game.deadline - route.leadWeeks, allocation: lunarAllocation(game) })}</p>
    <p>{t('studioLunarDeliveryPlan', { count: lunarPlanBatches(d, 'extra', lunar.daylightWindows + lunar.powers[d.power].nightWindows).batches })}</p>
    {(completed(game, 'trade') || completed(game, 'prelim')) && game.stage === 'design' && <>
      <p>{t('lunarTradeMount', { min: lunar.mounts.lightweight.growthKg, max: lunar.mounts.standard.growthKg })}</p>
      <p>{t('lunarTradeRoute', { propellant: lunar.routes.direct.propellantKg - lunar.routes.lowEnergy.propellantKg, weeks: lunar.routes.lowEnergy.leadWeeks })}</p>
    </>}
  </>
}

const sourceList = (sources: Record<string, { source: string; url: string }>) =>
  Object.entries(sources).filter(([id]) => !/^H\d+$/.test(id)).map(([, item]) => item)

const orbitalVerification = new Set<string>(orbitalRiskIds.flatMap(id => orbital.risks[id].steps))
const lunarVerification = new Set<string>(Object.values(lunar.risks).flatMap(risk => risk.steps.flatMap(step => [step, `support:${step}`])))

export const orbitalUi: MissionUi = {
  Preview: OrbitalPreview,
  TaskNote: ({ game, task, cost, t }) => {
    const remedy = orbital.remedies[task as keyof typeof orbital.remedies]
    const use = labUses.find(use => task === `lab:${use}`)
    const before = orbitalPlan(game)
    const after = orbitalPlan(game, game.design, { id: task, weeks: cost.weeks })
    const left = game.credits - cost.credits
    return <>
      {remedy && <p className="action-note">{t(remedy.description, {
        count: orbital.adapters.standard.massKg - orbital.adapters.lightweight.massKg,
        mass: orbital.telemetry.diagnostics.massKg - orbital.telemetry.basic.massKg,
        units: orbital.telemetry.diagnostics.diagnosticUnits,
        from: orbital.grounds.single.capacity, to: orbital.grounds.dual.capacity,
        lift: orbital.orbits.sso.capacityLossKg,
      })}</p>}
      {use && <p className="action-note">{t(orbital.labSlot.uses[use].label, { credits: orbital.labSlot.uses[use].creditsSaved })}</p>}
      {labUses.map(use => {
        const week = after.lab[use]
        if (!canBookLab(before.lab[use]) || week === null || week < labDeadline) return null
        return <p className="warning" key={use}>{t('orbitalLabMissedByWork', {
          work: t(labUseName[use]), week, credits: orbital.labSlot.uses[use].creditsSaved,
        })}</p>
      })}
      {(orbitalVerification.has(task) || task === 'lab:rehearse') && left < after.credits &&
        <p className="warning">{t('orbitalVerifyStarves', { left, cost: after.credits })}</p>}
    </>
  },
  knownDefectAtLaunch: game => orbitalState(game).link.found && !orbitalState(game).link.fixed,
  sources: sourceList(orbital.sources),
  verificationWork: orbitalVerification,
  optionalTasks: new Set([
    ...orbitalVerification, 'lab:rehearse', 'handover', ...Object.keys(orbital.remedies),
  ]),
  Requirements: ({ t }) => <>
    <p>{t('orbitalBriefMinimum', { payload: orbital.testPayloadKg, units: orbital.confirmationUnits })}</p>
    <p>{t('orbitalBriefExtra', { margin: orbital.marginStretchKg, units: orbital.telemetry.diagnostics.diagnosticUnits })}</p>
    <p>{t('orbitalBriefRecords', { week: orbital.onTimeWeek, levels: orbital.verifiedLevels, kg: orbital.lunarMarginKg })}</p>
  </>,
  Status: ({ game, t }) => <>{orbitalState(game).lab && <p>{t(game.week < orbital.labSlot.expiresWeek ? 'orbitalLabSlotDetail' : 'orbitalLabSlotExpired', { week: orbital.labSlot.expiresWeek, integrate: orbital.labSlot.uses.integrate.creditsSaved, rehearse: orbital.labSlot.uses.rehearse.creditsSaved })}</p>}
    {orbitalEstimate(game, t)}</>,
  Estimate: ({ game, t }) => orbitalEstimate(game, t),
  Forecast: inert, RemedyPreview: inert,
  Report: ({ evidence, t }) => <p>{t('orbitalInterfaceResult', { count: evidence.carried })}</p>,
  Delivery: ({ flight, t }) => <p>{t('orbitalPassReceipt', { confirmation: flight.confirmation, diagnostics: flight.diagnostics })}</p>,
  Debrief: OrbitalDebrief,
  flightSummary: (flight, t) => flight.stop === 'ascent' ? t('orbitalIncompleteOrbit')
    : t('orbitalPassReceipt', { confirmation: flight.confirmation, diagnostics: flight.diagnostics }),
  outcome: game => {
    if (!game.flight) return { title: orbital.outcomes.stopped.label, detail: { message: game.stop === 'margin' ? 'orbitalStopMargin' : game.stop === 'funds' ? 'orbitalStopFunds' : game.stop === 'cancelled' ? 'orbitalStopCancelled' : 'orbitalStopDeadline' } }
    const result = game.flight as typeof game.flight & ReturnType<typeof flyOrbital>
    return { title: orbital.outcomes[result.outcome].label, detail: { message: orbital.outcomes[result.outcome].description } }
  },
}

export const lunarUi: MissionUi = {
  Preview: LunarPreview,
  knownDefectAtLaunch: game => Object.values(lunarStates(game)).some(state => state.found && !state.fixed),
  TaskNote: ({ game, task, cost, t }) => {
    if (lunarVerification.has(task)) {
      const budget = lunarBudgetForecast(game, { credits: cost.credits, usesSupport: task.startsWith('support:') })
      return <p className={budget.shortfall ? 'warning' : 'action-note'}>
        {t('lunarVerificationBudget', budget)}{' '}
        {budget.savings > 0 && <>{t('lunarBudgetSupport', budget)}{' '}</>}
        {budget.shortfall > 0 && t('lunarBudgetShortfall', budget)}
      </p>
    }
    const remedy = lunar.remedies[task as keyof typeof lunar.remedies]
    if (!remedy && !task.startsWith('fix:')) return null
    return <>
      {remedy && <p className="action-note">{t(remedy.description, {
        count: lunar.routes.direct.propellantKg - lunar.routes.lowEnergy.propellantKg, weeks: lunar.routes.lowEnergy.leadWeeks,
        from: lunar.mounts.standard.growthKg, to: lunar.mounts.lightweight.growthKg, slots: 1,
        mass: task === 'dropKit' ? lunar.powers.extended.massKg : lunar.payloads.advanced.massKg - lunar.payloads.basic.massKg,
        windows: task === 'dropKit' ? lunar.powers.extended.nightWindows : lunar.payloads.basic.collectWindows,
        kg: lunar.sensors.redundant.massKg - lunar.sensors.single.massKg, credits: remedy.credits,
      })}</p>}
      {currentEvidence(game) && <p className="action-note">{t('lunarRetestNote', lunar.costs.retest)}</p>}
    </>
  },
  sources: sourceList(lunar.sources),
  verificationWork: lunarVerification,
  optionalTasks: new Set([
    ...lunarVerification,
    'trade', ...Object.keys(lunar.remedies),
  ]),
  Requirements: ({ t }) => <>
    <p>{t('lunarBriefMinimum', { count: lunar.minimumBatches })}</p>
    <p>{t('lunarBriefExtra', { count: lunar.stretchBatches })}</p>
    <p>{t('lunarBriefMass', { allocation: lunar.launchAllocationKg })}</p>
  </>,
  Status: ({ game, t }) => {
    const state = lunarState(game)
    const contract = state.contract
    const budget = lunarBudgetForecast(game)
    return <>
      {budget.credits > 0 && <p>{t('lunarBudgetForecast', budget)}</p>}
      {contract && !contract.ended && <p>{contract.left ? t('lunarContractProgress', { weeks: contract.weeks, done: contract.weeks - contract.left }) : t('lunarContractDelivered')}
        {' · '}{t('lunarSupportSlots', { count: state.slots })}</p>}
      {lunarEstimate(game, t)}
    </>
  },
  Estimate: ({ game, t }) => lunarEstimate(game, t),
  Forecast: inert, RemedyPreview: inert,
  Report: ({ evidence, t }) => <>
    <p>{t('lunarWeighingResult', { measured: evidence.mount, dry: evidence.dry })}</p>
    <p>{t('lunarPropellantLoaded', { allocation: evidence.dry + evidence.loaded, loaded: evidence.loaded, dry: evidence.dry })}</p>
  </>,
  Delivery: ({ flight, t }) => <p>{t('lunarGroundReceipt', { count: flight.batches })}</p>,
  Debrief: LunarDebrief,
  flightSummary: (flight, t) => t('lunarGroundReceipt', { count: flight.batches }),
  outcome: (game, t): { title: Message; detail?: Copy } => {
    const flight = game.flight as LunarFlightResult | null
    if (!flight) return { title: lunar.outcomes.stopped.label, detail: {
      message: game.stop === 'deadline' ? 'lunarEndingStoppedDeadline' : game.stop === 'funds' ? 'lunarEndingStoppedFunds'
        : game.events.includes('CostReview:Stop') ? 'lunarEndingStoppedCancelled' : 'lunarStoppedWithdrawn',
      values: { credits: Math.max(0, lunarPlanCost(game).credits - game.credits) },
    } }
    const title = lunar.outcomes[flight.outcome].label
    if (flight.critical === 'reserve') return { title, detail: { message: 'lunarTransferFail',
      values: flight.reserveFailure ?? { need: -flight.spareKg, margin: 0 } } }
    if (flight.critical === 'windows') return { title, detail: { message: 'lunarNoScienceWindows',
      values: { usable: flight.surface?.usable ?? 0, each: flight.surface?.each ?? 0 } } }
    const states = lunarStates(game)
    if (flight.outcome === 'success' || flight.outcome === 'extra') return { title, detail: { message: 'lunarGroundReceipt', values: { count: flight.batches } } }
    if (flight.critical === 'choice') return { title, detail: { message: 'lunarEndingNoDataTradeoff' } }
    const id = flight.critical
    const d = lunarDesign(game)
    const item = t(lunar.risks[id].label)
    const segment = t(lunar.segments.find(segment => segment.id === flight.segment)?.label ?? 'lunarLaunchTitle')
    const exposed = flight.exposed.includes(id) && (states[id].fixed || !hasDefect(game.seed, lunarItemId(d, id), lunarMaturity(d, id)))
    const signed = game.log.some(entry => entry.review?.passed && entry.review.waivers.some(waiver => waiver.id === `risk:${id}`))
    const message = exposed ? 'lunarEndingExposure' : states[id].found ? 'lunarEndingKnown'
      : signed ? 'lunarEndingAccepted' : lunarVerified(states[id]) ? 'lunarEndingEscaped' : 'lunarEndingObserved'
    return { title, detail: { message, values: { item, segment } } }
  },
}
