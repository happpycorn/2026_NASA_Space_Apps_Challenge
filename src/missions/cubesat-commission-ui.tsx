import { availableWeeks } from '../game/mission'
import type { Design, FlightResult, Game, TestResult } from '../game/types'
import type { Translate } from '../i18n'
import { missionMoney } from '../ui/shared'
import type { MissionUi } from './index'
import { capabilityFor, commissionFor, commissionForecast, commissionLimits, commissionPlan, commissionRepairs, commissionRules } from './cubesat-commission'
import { cubeSat } from './cubesat'

export function CommissionNote({ t }: { t: Translate }) {
  const source = cubeSat.sources[2]
  return <p className="action-note">{t('commissionUsageNote')} <a href={source.url + '#page=14'} target="_blank" rel="noreferrer">{source.source}</a></p>
}

const credits = (count: number, t: Translate) => missionMoney(commissionRules, count, t)

export function deliveryEstimate(plan: ReturnType<typeof commissionPlan>, t: Translate) {
  const { deliveryLow: low, deliveryHigh: high } = plan
  return low === high ? t('dataBatches', { count: high }) : t('studioDeliveryRange', { low, high })
}

export function CommissionPlan({ game, t }: { game: Game; t: Translate }) {
  const plan = commissionPlan(game)
  const kit = capabilityFor(game.design)
  const source = cubeSat.sources[3]
  return <section className="plan-preview" aria-label={t('planPreview')}>
    <dl className="forecast-metrics">
      <div><dt>{t('commissionPrimaryInstrument')}</dt><dd>{t(commissionFor(game).instrument)}</dd></div>
      <div className={plan.mass > plan.massLimit ? 'bad' : undefined}><dt>{t('planMassLabel')}</dt><dd>{t('massUse', { mass: plan.mass, limit: plan.massLimit })}</dd></div>
      <div className={plan.peak > plan.available ? 'bad' : undefined}><dt>{t('planPowerLabel')}</dt><dd>{t('powerUse', plan)}</dd></div>
      <div><dt>{t('commissionPassBudget')}</dt><dd>{t('commissionCapacity', plan)}</dd></div>
      <div className="forecast-delivery"><dt>{t('studioDeliveryEstimate')}</dt><dd>{deliveryEstimate(plan, t)}</dd></div>
    </dl>
    <div className="forecast-notes">
      <p className={plan.spareWeeks < 0 || plan.spareCredits < 0 ? 'warning' : 'action-note'}>{t('commissionPlanBudget', {
        ...plan, cost: credits(plan.credits, t), reserve: credits(plan.spareCredits, t),
      })}</p>
      {commissionLimits(plan).map(issue => <p key={issue.message} className="warning">{t(issue.message, issue.values)}</p>)}
      {kit.backup && <p>{t(game.commission === 'bay' ? 'commissionBayAuxEffect' : 'commissionAuxEffect', { instrument: t(commissionFor(game).auxiliary) })}</p>}
      {kit.backup && <p>{t('commissionRecoveryBudget', { weeks: commissionRules.costs.correctLate.weeks + commissionRules.costs.retest.weeks,
        cost: credits(commissionRules.costs.correctLate.credits + commissionRules.costs.retest.credits, t),
        stripWeeks: commissionRules.costs.retest.weeks, stripCost: credits(commissionRules.costs.strip.credits + commissionRules.costs.retest.credits, t) })}</p>}
      {game.stage === 'design' && kit.backup && <p className="action-note">{t('commissionScreenNote')} <a href={source.url} target="_blank" rel="noreferrer">{source.source}</a></p>}
    </div>
  </section>
}

export function CommissionOption({ game, design, t }: { game: Game; design: Design; t: Translate }) {
  const plan = commissionPlan(game, design)
  return <small>{t('commissionOptionNumbers', { ...plan, cost: credits(plan.credits, t) })} · {deliveryEstimate(plan, t)}</small>
}

function Report({ evidence, t }: { evidence: TestResult; t: Translate }) {
  const source = cubeSat.ditl
  const checks = ['planMassLabel', 'planPowerLabel', 'commissionAuxCheck', 'commissionPassBudget', 'commissionQuietCheck'] as const
  return <div aria-label={t('report')}>
    <dl className="fact-list">
      {checks.map((label, index) => <div key={label}><dt>{t(label)}</dt>
        <dd className={evidence.checks[index] ? 'good' : 'bad'}>{t(evidence.checks[index] ? 'pass' : 'fail')}</dd>
      </div>)}
    </dl>
    <p>{t('commissionReadings', { ...evidence, ...evidence.ditl })}</p>
    <p>{t('commissionCapacity', evidence)}</p>
    {evidence.capability !== 'baseline' && capabilityFor(evidence.design).backup && <p className={evidence.auxPass ? 'good' : 'bad'}>
      {t(evidence.auxPass ? 'commissionInterfacePassed' : 'commissionInterfaceFailed')}
    </p>}
    <p className="action-note">{t('commissionDitlNote')} <a href={source.url} target="_blank" rel="noreferrer">{source.source}</a></p>
  </div>
}

export function CommissionDeliveryFeedback({ game, flight, t }: { game: Game; flight: FlightResult; t: Translate }) {
  const client = commissionFor(game)
  const attemptedExtra = flight.segments?.some(step => step.id === 'commission-extra' && step.choice)
  const values = { count: flight.primary, required: client.required, capacity: flight.capacity, instrument: t(client.auxiliary) }
  return <>
    <p>{t(!flight.delivered ? 'commissionShortfall' : client.delivered, values)}</p>
    {flight.assisted ? <p>{t('commissionSubstituted', { batches: flight.primary, capacity: flight.capacity })}</p>
      : flight.obstructed && <p>{t('commissionObstructionCause', values)}</p>}
    {!flight.delivered && flight.capacity < client.required && <p>{t('commissionCapacityCause', values)}</p>}
    {flight.extra ? <p>{t(flight.extra === 'north' ? client.northImpact : client.southImpact)}</p>
      : attemptedExtra && <p>{t('commissionExtraObstructed')}</p>}
    {flight.extra === 'south' && <p><strong>{t(client.southReward)}</strong></p>}
  </>
}

export const commissionUi: MissionUi = {
  sources: cubeSat.sources,
  verificationWork: new Set(['screen']),
  Requirements: () => null,
  Estimate: ({ game, t }) => <p>{t('commissionCapacity', commissionForecast(game))}</p>,
  Forecast: () => null,
  Report,
  RemedyPreview: () => null,
  Delivery: ({ flight, t }) => <p>{t('commissionArchive', { count: flight.archived })}</p>,
  flightSummary: (flight, t) => t('commissionFinalReceipt', { count: flight.batches }),
  outcome: (game) => {
    if (!game.flight) return { title: 'outcomeStopped' }
    return { title: game.flight.stretch ? 'commissionOutcomeExtra' : game.flight.delivered ? 'commissionOutcomeSuccess' : 'commissionOutcomePartial' }
  },
  Debrief: ({ game, t }) => {
    const client = commissionFor(game)
    const { flight } = game
    const decision = [...game.log].reverse().find(entry => ['correctEarly', 'correctLate', 'strip', 'screen'].includes(entry.id))
    const repair = commissionRepairs(game)
    const cost = decision && commissionRules.costs[decision.id]
    const retest = decision?.id === 'strip' || decision?.id === 'correctLate'
      ? game.log.slice(game.log.indexOf(decision) + 1).find(entry => entry.id === 'retest') : undefined
    return <section className="evidence-status">
      <h2>{t(client.name)}</h2>
      {flight ? <>
        <p>{t(flight.delivered ? client.delivered : 'commissionShortfall', { count: flight.primary, required: client.required })}</p>
        {flight.assisted && <p>{t('commissionSubstituted', { batches: flight.primary, capacity: flight.capacity })}</p>}
        {flight.extra && <p>{t(flight.extra === 'north' ? client.northImpact : client.southImpact)}</p>}
        <p>{t('commissionArchive', { count: flight.archived })}</p>
        {commissionRules.records?.(game)?.includes('cubesat:partnerVerified') && <p>{t('commissionLabReward')}</p>}
      </> : game.stop === 'deadline' || game.stop === 'funds' ? <>
        <p>{t('commissionStopped', { week: game.week + availableWeeks(game), weeks: availableWeeks(game), credits: credits(game.credits, t) })}</p>
        {repair.map(item => <p key={item.id}>{t(item.cost.label)} · {t('repairAndRetest', { weeks: item.weeks, cost: credits(item.credits, t) })}</p>)}
      </> : null}
      {decision?.detail && cost && <p>{t(decision.detail.message)} {t('commissionDecisionSpent', {
        cost: credits(decision.cost + (retest?.cost ?? 0), t), weeks: cost.weeks + (retest ? commissionRules.costs.retest.weeks : 0),
      })}</p>}
    </section>
  },
}
