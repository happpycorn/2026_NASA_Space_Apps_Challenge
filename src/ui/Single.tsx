import { orbitalCapacity, orbitalCarried, orbitalDegradedCapacity, orbitalLaunch, orbitalRisks, type OrbitalDesign } from '../missions/orbital-launch'
import { lunarMission, lunarPlanBatches } from '../missions/lunar-mission'
import { lunarAllocation, lunarBudgetForecast, lunarCorrection, lunarDesign, lunarPlanCost, massBudget } from '../missions/lunar-rules'
import { orbitalCorrection, orbitalPlanCost, orbitalState } from '../missions/orbital-rules'
import { commissionCanConfigure, commissionFor, commissionLimits, commissionPlan, commissionRepairs, commissions, type CommissionId } from '../missions/cubesat-commission'
import { CommissionDeliveryFeedback, CommissionNote, CommissionOption, CommissionPlan, deliveryEstimate } from '../missions/cubesat-commission-ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { studioReadyToLaunch, usesStudio, type StudioAction } from '../game/studio-session'
import { readLocal, writeLocal } from '../game/storage'
import { fundingReduced, missionSpending, nextMission, type Progress } from '../game/progress'
import {
  affordable, availableWeeks, baselineRemainingCost, canConfigure, contactEvidence, currentEvidence, currentFlightSegment, currentWork,
  flightContext, optionCost, runMission, passes, pendingEvent, pendingReview, pendingWorkId, repairAndRetestCost, repairOptions, riskAcceptance, taskOptions,
  sameDesign, workCost, type BenchLead, type ConfigStep, type ScienceGoal, type Copy, type DesignOption, type SegmentEntry,
  type MissionFile as File, type Entry, type Game, type TestFocus,
} from '../game/mission'
import { detection, percent, reviewRiskThreshold, verificationLevels } from '../game/risk'
import type { Message, Translate } from '../i18n'
import { missions, type MissionModule } from '../missions'
import { cubeSat, forecast, planContact, riskDebrief, testDesign, type CubeSatDesign, type CubeSatEvidence, type CubeSatGame, type CubeSatRisk } from '../missions/cubesat'
import { CubeSatDebrief, Findings, testedBatches, verificationEntry } from '../missions/cubesat-ui'
import { ActionButton, Back, CostLabel, DesignSummary, Disclosure, EvidenceReport, Heading, missionMoney, money, optionValues } from './shared'
import { ReportCard } from './ReportCard'
import { phaseGate, phaseOf, phases, phaseSource, type Phase } from '../game/phase'
import { Lab } from './Lab'
import { OptionArt, StudioAnimationButton, StudioBubble, StudioScene,
  sceneModel, stoppedStage, type Illustration, type Speaker } from './StudioScene'
import { StudioDecision, choiceIllustration, designIllustration, taskIllustration } from './StudioDecision'
import { StudioLaunch, studioTutorialMessage, TutorialNote, TutorialTarget } from './StudioFlow'
import type { Prop } from './pixelKit'
import type { MeetingPreview } from './studioArt'
import type { Cost, Design } from '../game/types'
import { Portfolio, StoryBrief, StoryDebrief } from './Story'

type Props = { game: Game; mission: MissionModule; progress: Progress; t: Translate; send: (action: StudioAction) => void; back: () => void; replay: () => void; open: (missionId: string) => void; languageControls?: ReactNode }
type Controls = Pick<Props, 'game' | 'mission' | 't' | 'send'>

const goalBatches = (goal?: ScienceGoal) => goal === 'stretch' ? cubeSat.stretchBatches : cubeSat.minimumBatches

export function Brief({ mission, t, begin, back, saved }: {
  mission: MissionModule; t: Translate; begin: (commission?: CommissionId) => void; back: () => void; saved: boolean
}) {
  const isCubeSat = mission.id === cubeSat.id
  const [commission, setCommission] = useState<CommissionId>('river')
  const speaker = mission.id === orbitalLaunch.id ? 'power' : 'science'
  const prop = isCubeSat ? commission : mission.id === orbitalLaunch.id ? 'scale' : 'contract'
  const objective = isCubeSat ? t(commission === 'bay' ? 'studioBayBrief' : 'studioRiverBrief', { count: commissions[commission].required })
    : mission.id === orbitalLaunch.id ? t('studioOrbitalBrief', { payload: orbitalLaunch.testPayloadKg, units: orbitalLaunch.confirmationUnits })
    : t('studioLunarBrief', { count: lunarMission.minimumBatches })
  return <article className="studio-brief">
    <header className="studio-top"><Back t={t} onClick={back} /><h1>{t(mission.title)}</h1></header>
    <div className="studio-workspace">
      <StudioScene missionId={mission.id} speaker={speaker} prop={prop} t={t} brief bay={commission === 'bay'} sequence={commission} />
      <section className="studio-handoff" aria-label={t('briefTitle')}>
        <h2>{t('studioSceneBrief')}</h2>
        <StudioBubble t={t} speaker={speaker} prop={prop}><p>{objective}</p></StudioBubble>
        <dl className="resource-line">
          <div><dt>{t(isCubeSat ? 'briefDeadlineLabel' : 'flightWindow')}</dt><dd>{t('weeks', { count: mission.deadline })}</dd></div>
          <div><dt>{t('budgetInitial')}</dt><dd>{missionMoney(mission, mission.budget, t)}</dd></div>
        </dl>
        {isCubeSat && <Options legend="commissionChoose" layout="pair" illustrated value={commission} choose={setCommission} t={t}
          options={(Object.keys(commissions) as CommissionId[]).map(id => ({
            id, name: commissions[id].name, art: id, detail: t('dataBatches', { count: commissions[id].required }),
          }))} />}
        {saved && <p className="action-note">{t('replaceSave')}</p>}
        <ActionButton onClick={() => begin(isCubeSat ? commission : undefined)}>{t(isCubeSat ? 'acceptCommission' : 'begin')}</ActionButton>
      </section>
    </div>
    <div className="studio-files">
      <Disclosure label={t('missionInfo')}>
        <p>{t(mission.brief)}</p>
        {isCubeSat ? <CommissionNote t={t} /> : <><mission.ui.Requirements t={t} /><p>{t('creditsNote')}</p></>}
        <StoryBrief missionId={mission.id} t={t} />
        {!isCubeSat && <blockquote>{t(mission.dialogue)}</blockquote>}
        {isCubeSat && <Disclosure label={t('storyHowToPlay')}>
          <ol><li>{t('storyHowPlan')}</li><li>{t('storyHowVerify')}</li><li>{t('storyHowDeliver')}</li></ol>
          <PhaseTable t={t} />
        </Disclosure>}
        <Disclosure label={t('glossaryTitle')}><Glossary t={t} /></Disclosure>
        <MissionSources mission={mission} t={t} />
      </Disclosure>
    </div>
  </article>
}

export function phaseLabel(phase: Phase, t: Translate) {
  const gate = phaseGate[phase]
  return gate ? t('phaseWithGate', { phase: t(`phase${phase}`), gate }) : t(`phase${phase}`)
}

// NASA's project life cycle next to what the player does in each phase. current marks where the run is.
export function PhaseTable({ t, current }: { t: Translate; current?: Phase }) {
  return <div className="phase-table">
    <p>{t('phaseTableIntro')}</p>
    <table>
      <thead><tr><th scope="col">{t('phaseColumn')}</th><th scope="col">{t('phaseReviewColumn')}</th><th scope="col">{t('phaseGameColumn')}</th></tr></thead>
      <tbody>{phases.map(phase => {
        const gate = phaseGate[phase]
        return <tr key={phase} aria-current={phase === current ? 'step' : undefined}>
          <th scope="row">{t(`phase${phase}`)}</th>
          <td>{gate ? t(`gate${gate}`) : '—'}</td>
          <td>{t(`phaseGame${phase}`)}</td>
        </tr>
      })}</tbody>
    </table>
    <small>{t('phasePreA')}</small>
    <small>{t('phaseSourceNote')} <a href={phaseSource.url} target="_blank" rel="noreferrer">{phaseSource.source}</a></small>
  </div>
}

const glossary = ['glossaryBatch', 'glossaryWatt', 'glossaryMargin', 'glossaryHeritage', 'glossaryReviews', 'glossaryVerification',
  'glossaryDitl', 'glossaryWindow', 'glossaryCredits'] as const

// Short definitions for the terms the workbench uses without explaining.
function Glossary({ t }: { t: Translate }) {
  return <dl className="glossary">
    {glossary.map(key => <div key={key}><dt>{t(`${key}Term`)}</dt><dd>{t(key)}</dd></div>)}
  </dl>
}

type Option<T extends string> = {
  id: T; name: Message; nameValues?: Record<string, string | number>; detail: string; extra?: ReactNode; disabled?: boolean; art?: Illustration
}

function Options<T extends string>({ legend, options, value, choose, t, layout = 'rows', illustrated = false }: {
  legend: Message; options: Option<T>[]; value: T | null; choose: (value: T) => void; t: Translate
  layout?: 'rows' | 'pair'; illustrated?: boolean
}) {
  return <fieldset className={`options ${layout}${illustrated ? ' illustrated-options' : ''}`}>
    <legend className={!illustrated && layout === 'pair' && legend !== 'scienceGoal' && legend !== 'commissionChoose' ? 'visually-hidden' : undefined}>{t(legend)}</legend>
    {options.map(option => <label className="option" key={option.id}>
      <input type="radio" name={legend} checked={value === option.id} disabled={option.disabled} onChange={() => choose(option.id)} />
      {option.art && <OptionArt art={option.art} />}
      <span><strong>{t(option.name, option.nameValues)}</strong><small>{option.detail}</small>{option.extra}</span>
    </label>)}
  </fieldset>
}

function optionList(data: Record<string, DesignOption>, t: Translate, mission: MissionModule): Option<string>[] {
  return Object.entries(data).map(([id, option]) => ({ id, name: option.label, detail: t(option.description, optionValues(option, mission, t)) }))
}

function CubeSatBlockers({ result, t }: { result: CubeSatEvidence; t: Translate }) {
  if (passes(result)) return null
  return <div className="warning">
    <ul className="findings">
      {!result.powerPass && <li>{t('planPowerFix')}</li>}
      {!result.massPass && <li>{t('planMassFix', { mass: result.mass, limit: result.massLimit })}</li>}
      {!result.ditlPass && <li>{t('earlyTransmissionEstimate', result.ditl)} {t('planRadioFix')}</li>}
      {result.powerPass && !result.dataPass && <li>
        {t('dataShortfallEstimate', { count: result.batches, minimum: cubeSat.minimumBatches })} {t('planBelowMinimum')}
      </li>}
    </ul>
  </div>
}

function CubeSatForecast({ game, mission, t }: Pick<Controls, 'game' | 'mission' | 't'>) {
  const result = testDesign(game.design as CubeSatDesign)
  const goal = goalBatches(game.scienceGoal)
  const reserve = game.credits - baselineRemainingCost(game)
  const clear = passes(result)
  return <section className="plan-preview" aria-label={t('planPreview')} aria-live="polite">
    <dl className="forecast-metrics">
      <div className={result.massPass ? undefined : 'bad'}>
        <dt>{t('planMassLabel')}</dt>
        <dd>{t('massUse', { mass: result.mass, limit: result.massLimit })}</dd>
      </div>
      <div className={result.powerPass ? undefined : 'bad'}>
        <dt>{t('planPowerLabel')}</dt>
        <dd>{t('powerUse', { peak: result.peak, available: result.available })}</dd>
      </div>
      <div className={clear && result.batches >= goal ? undefined : 'bad'}>
        <dt>{t('planDataLabel')}</dt>
        <dd>{clear ? t('planDataMetric', { count: result.batches, goal }) : t('planBlocked')}</dd>
      </div>
      <div className={reserve < 0 ? 'bad' : undefined}>
        <dt>{t(reserve < 0 ? 'planOverBudgetLabel' : 'planReserveLabel')}</dt>
        <dd>{missionMoney(mission, Math.abs(reserve), t)}</dd>
      </div>
    </dl>
    <CubeSatBlockers result={result} t={t} />
  </section>
}

function ConfigSwitch<T extends string>({ items, active, label, choose }: {
  items: { id: T; name: string; guidance?: string }[]; active: T; label: string; choose: (id: T) => void
}) {
  return <div className="config-switch" role="group" aria-label={label}>
    {items.map(item => <button type="button" key={item.id}
      aria-pressed={active === item.id} onClick={() => choose(item.id)}>
      {item.name}
      {item.guidance && <small className="studio-config-guidance">{item.guidance}</small>}
    </button>)}
  </div>
}

const configPrompts = {
  launch: ['chooseLaunch', 'review', 'reportLaunch'],
  payload: ['chooseCamera', 'science', 'reportPayload'],
  supply: ['choosePower', 'power', 'reportSupply'],
  schedule: ['chooseSchedule', 'comms', 'reportSchedule'],
  radio: ['chooseRadio', 'comms', 'reportRadio'],
} as const

const nextStepLabels = { launch: 'nextLaunch', payload: 'nextPayload', supply: 'nextSupply', schedule: 'nextSchedule', radio: 'nextRadio' } as const

function CubeSatConfig({ game, mission, t, send }: Controls) {
  const [inspect, setInspect] = useState<ConfigStep | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const moveFocus = useRef(false)
  const design = game.design as CubeSatDesign
  const feasibility = game.stage === 'feasibility'
  const steps = mission.configurationSteps?.[game.stage] ?? []
  const current: ConfigStep = game.configStep && steps.includes(game.configStep) ? game.configStep : steps[0]
  const following = steps[steps.indexOf(current) + 1]
  const step = inspect ?? current
  const work = feasibility ? 'assess' : 'freeze'
  const cost = workCost(game, work)
  const [prompt, speaker, advice] = configPrompts[step]
  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'nearest' })
  }, [step])
  const options = optionList(mission.groups[step].options, t, mission).map(option => {
    const alternative = { ...design, [step]: option.id }
    const result = testDesign(alternative)
    const delta = optionCost(mission, alternative) - optionCost(mission, design)
    const clear = passes(result)
    const capacity = step === 'schedule' ? t('planScheduleEffect', {
      collected: result.collectedBatches, count: result.batches,
    }) : clear ? t('planOptionDelivery', { count: result.batches }) : t('planBlocked')
    return { ...option, extra: <small className={clear ? 'option-forecast' : 'option-forecast bad'}>
      {step === 'launch' || step === 'payload' || step === 'supply'
        ? <>{t('massUse', { mass: result.mass, limit: result.massLimit })} · </> : null}
      {step !== 'launch' && <>{t('powerUse', { peak: result.peak, available: result.available })} · </>}{capacity}
      {step === 'schedule' && !clear && <> · {t('planBlocked')}</>}
      {step === 'supply' && delta !== 0 && <> · {t(delta > 0 ? 'planHardwareMore' : 'planHardwareLess', { cost: money(Math.abs(delta)) })}</>}
      {step === 'launch' && delta !== 0 && <> · {t(delta > 0 ? 'planLaunchMore' : 'planLaunchLess', { cost: money(Math.abs(delta)) })}</>}
      {step === 'launch' && cubeSat.launches[option.id as CubeSatDesign['launch']].leadWeeks > 0 && <> · {t('launchEarlierDelivery', { count: cubeSat.launches[option.id as CubeSatDesign['launch']].leadWeeks })}</>}
    </small> }
  })
  function show(item: ConfigStep | null) {
    moveFocus.current = true
    setInspect(item)
  }
  return <div className="decisions config-workspace">
    <h2 className="config-prompt" ref={heading} tabIndex={-1}>{t(prompt)}</h2>
    <ReportCard speaker={speaker} t={t}><p>{t(advice, { minutes: cubeSat.ditl.minQuietMinutes })}</p></ReportCard>
    <Options key={step} legend={step} layout="pair" options={options} value={design[step]}
      choose={value => send({ type: 'configure', design: { ...design, [step]: value } })} t={t} />
    <CubeSatForecast game={game} mission={mission} t={t} />
    {inspect ? <ActionButton onClick={() => show(null)}>{t('returnToCurrentStep')}</ActionButton>
      : following ? <ActionButton onClick={() => {
        moveFocus.current = true
        send({ type: 'configStep', step: following })
      }}><span className="next-action-prefix" aria-hidden="true">{t('nextStep')}</span>
        {t(nextStepLabels[following])}</ActionButton>
        : <ActionButton disabled={!affordable(game, cost)} onClick={() => send({ type: 'work' })}>
          {t(mission.costs[work].label)} <CostLabel t={t} mission={mission} {...cost} />
        </ActionButton>}
    {!inspect && <Disclosure key={`other-settings:${current}`} label={t('editOtherSettings')}>
      <ul className="config-summary">
        {(Object.keys(configPrompts) as ConfigStep[]).filter(item => item !== current).map(item => {
          const group = mission.groups[item]
          return <li key={item}>
            <button className="text-button" type="button" onClick={() => show(item)}>
              <span>{t(group.legend)}</span><small>{t(group.options[design[item]].label)}</small>
            </button>
          </li>
        })}
      </ul>
    </Disclosure>}
  </div>
}

function copy(t: Translate, text: Copy) {
  const labels = Object.fromEntries(Object.entries(text.labels ?? {}).map(([name, key]) => [name, t(key)]))
  return t(text.message, { ...text.values, ...labels })
}

function logLabel(mission: MissionModule, { id, label }: Entry): Message {
  if (label) return label
  switch (id) {
    case 'approve': return 'logApprove'
    case 'return': return 'logReturn'
    case 'operate': return 'logOperate'
    case 'analysisConflict':
    case 'analysisClear': return id
    default: return mission.costs[id]?.label ?? 'logWork'
  }
}

function DecisionLog({ game, mission, t }: Pick<Props, 'game' | 'mission' | 't'>) {
  return <ol className="decision-log">
    {game.log.map((entry, index) => <li key={index}>
      <Disclosure label={entry.review ? t(entry.review.passed ? 'gateApproved' : 'gateReturned', { gate: entry.review.gate })
        : t(logLabel(mission, entry))} value={t('logWeek', { week: entry.week })}>
        <p>{t(fundingReduced(mission, entry) ? 'logFundingReduction' : 'logCost', { count: missionMoney(mission, entry.cost, t) })}</p>
        {entry.detail && <p>{copy(t, entry.detail)}</p>}
        {entry.incomplete && <p>{t('workInterrupted')}</p>}
        {entry.review && <>
          {entry.review.detail && <p>{copy(t, entry.review.detail)}</p>}
          {entry.review.waivers.length > 0 && <p>{t('waiversUsed', { items: entry.review.waivers.map(item => t(item.label)).join(t('listSeparator')) })}</p>}
        </>}
        <DesignSummary mission={mission} design={entry.design} t={t} />
        {entry.report && <EvidenceReport mission={mission} evidence={entry.report} t={t} />}
      </Disclosure>
    </li>)}
  </ol>
}

function BenchWork({ game, mission, t, send }: Controls) {
  const [benchLead, setBenchLead] = useState<BenchLead>('science')
  const [testFocus, setTestFocus] = useState<TestFocus>(game.testFocus ?? 'downlink')
  const build = game.stage === 'build'
  const work = build ? 'build' : 'integrate'
  const cost = workCost(game, work)
  return <>
    <ActionButton disabled={!affordable(game, cost)} onClick={() => send({ type: 'runLab', benchLead, testFocus })}>
      {t(!build && game.evidence ? 'retest' : mission.costs[work].label)} <CostLabel t={t} mission={mission} {...cost} />
    </ActionButton>
    {build ? <>
      <Disclosure label={t('benchChoice')}>
        <ReportCard speaker="assembly" t={t}><p>{t('reportBenchChoice')}</p></ReportCard>
        <Options legend="benchChoice" value={benchLead} choose={setBenchLead} t={t} options={[
          { id: 'science', name: 'benchScience', detail: t('benchScienceDetail') },
          { id: 'power', name: 'benchPower', detail: t('benchPowerDetail') },
        ]} />
      </Disclosure>
    </> : <>
      <Disclosure label={t('focusChoice')}>
        <p>{t('reportIntegrationFocus')}</p>
        <Options legend="focusChoice" value={testFocus} choose={setTestFocus} t={t} options={[
          { id: 'imaging', name: 'focusImaging', detail: t('focusImagingDetail') },
          { id: 'downlink', name: 'focusRadio', detail: t('focusRadioDetail') },
        ]} />
      </Disclosure>
    </>}
  </>
}

const levelNames = { none: 'riskLevelNone', analysis: 'riskLevelAnalysis', unit: 'riskLevelUnit', endToEnd: 'riskLevelEndToEnd' } as const

// What the player currently believes about each risk item, and what the next verification level costs.
function RiskPanel({ game, mission, t, send }: Controls) {
  if (!mission.risks) return null
  const items = mission.risks.view(game)
  const isCubeSat = game.missionId === cubeSat.id
  const odds = !isCubeSat || passes(testDesign(game.design as CubeSatDesign)) ? mission.risks.odds(game) : null
  const reserve = baselineRemainingCost(game)
  return <section className="risk-panel" aria-label={t('riskTitle')}>
    {odds && (isCubeSat ? <div className="risk-odds">
      <p>{t('riskOrbitAssumption')}</p>
      <p>{t('riskOrbitDelivery', { percent: percent(odds.minimum), count: cubeSat.minimumBatches })}</p>
    </div> : <p className="risk-odds">{t('riskOddsMinimum', { percent: percent(odds.minimum) })} · {t('riskOddsNoFatal', { percent: percent(odds.noFatal) })}</p>)}
    {items.map(item => {
      const { next, fix, state } = item
      const tooCostly = Boolean(next) && game.credits - next!.credits < reserve
      const verification = isCubeSat && state.found ? verificationEntry(game, item.id as CubeSatRisk) : undefined
      return <div className="risk-item" key={item.id}>
        <strong>{t(item.label)}</strong>
        <small>{t(item.detail)}</small>
        <small>{t(item.maturity === 'new' ? 'riskMaturityNew' : 'riskMaturityHeritage')} · {t(item.severity === 'fatal' ? 'riskSeverityFatal' : 'riskSeverityDegraded')} · {t('riskLevel', { level: t(levelNames[verificationLevels[state.level]]) })}</small>
        {state.fixed ? <p className="verified">{t('riskFixed')}</p> : state.found ? <>
          <p className="warning" role="status">{verification
            ? t('riskTestFoundBy', { work: t(mission.costs[verification.id]?.label ?? 'analyze') })
            : t('riskTestFound')}</p>
          <button className="button secondary" disabled={!affordable(game, fix)} onClick={() => send({ type: 'fix', risk: item.id })}>
            {t('riskFixAction', { work: t(mission.costs[fix.work].label), weeks: fix.weeks, cost: money(fix.credits) })}
          </button>
          {!affordable(game, fix) && <small>{t('riskNoFix')}</small>}
          <small>{t('riskOrFly')}</small>
        </> : <>
          {state.level > 0 && <small role="status">{t('riskTestPassed', { percent: percent(1 - detection[state.level]) })}</small>}
          {next ? <button className="button secondary" disabled={!affordable(game, next) || tooCostly} onClick={() => send({ type: 'verify', risk: item.id })}>
            {t('riskVerifyAddOn', { work: t(mission.costs[next.work].label), cost: money(next.credits), percent: percent(next.passRisk) })}
          </button> : <small>{t('riskTopLevel', { percent: percent(1 - detection[state.level]) })}</small>}
          {tooCostly && <small>{t('riskTooCostly')}</small>}
        </>}
        <small>{t('riskChance', { percent: percent(item.risk) })}</small>
      </div>
    })}
    <small>{t('riskBeliefNote')} {t('riskAddOnNote')}</small>
  </section>
}

// What each risk item turned out to be, what the player believed, and what the next test would have said.
function RiskDebrief({ game, mission, t }: Pick<Props, 'game' | 'mission' | 't'>) {
  if (!mission.risks) return null
  const items = mission.risks.view(game)
  return <section className="risk-panel" aria-label={t('riskFlightTitle')}>
    <h2>{t('riskFlightTitle')}</h2>
    {game.outcomes.map(outcome => {
      const item = items.find(entry => entry.id === outcome.id)
      if (!item) return null
      const next = game.missionId === cubeSat.id ? riskDebrief(game, outcome.id) : null
      const values = { item: t(item.label), percent: percent(outcome.believed) }
      return <div className="risk-item" key={outcome.id}>
        <p className={outcome.failed ? 'warning' : undefined}>{t(outcome.failed ? 'riskFlightFailed' : 'riskFlightHeld', values)}</p>
        {outcome.failed && <small>{t(item.failure)}</small>}
        {outcome.failed && <small>{item.state.found ? t('riskFlewKnowingly') : next
          ? t(next.found ? 'riskDebriefNext' : 'riskDebriefMissed', { work: t(mission.costs[next.work].label), weeks: next.weeks, cost: money(next.credits) })
          : t('riskDebriefTop')}</small>}
      </div>
    })}
    {game.outcomes.length > 0 && game.outcomes.every(outcome => !outcome.failed) && <small>{t('riskCleanAll')}</small>}
    {game.accepted.length > 0 && <small>{t('riskAccepted', { items: game.accepted.map(id => t(items.find(entry => entry.id === id)!.label)).join(t('listSeparator')) })}</small>}
    <small>{t('riskSeed', { seed: game.seed })} · {t('riskGameSetting')}</small>
  </section>
}

function Flight({ game, mission, t, send }: Controls) {
  const [choice, setChoice] = useState(game.missionId === cubeSat.id && game.scienceGoal === 'stretch' ? 'extra' : mission.flightChoices?.[0] ?? '')
  const evidence = contactEvidence(game)
  if (!evidence) return null
  if (game.contact) {
    const { next, accepted, choice, diagnosticsPending } = game.contact
    const { batches, diagnostics } = planContact(evidence as CubeSatEvidence, choice)
    const remaining = batches - next - 1
    const minimum = cubeSat.minimumBatches
    const goal = goalBatches(game.scienceGoal)
    const reachable = accepted + batches - next
    const archiveMisses = [goal, minimum].find(threshold => reachable === threshold)
    const progress = <p className="action-note" role="status">{t('contactProgress', {
      accepted, remaining: batches - next, minimumGap: Math.max(0, minimum - accepted), goalGap: Math.max(0, goal - accepted),
    })}</p>
    if (diagnosticsPending) return <>
      <ReportCard speaker="ground" t={t}>
        <p>{t('groundDiagnosticsReport', { slots: diagnostics, count: batches })}</p>
      </ReportCard>
      {progress}
      <ActionButton onClick={() => send({ type: 'checkDiagnostics' })}>{t('groundLogDiagnostics')}</ActionButton>
    </>
    return <>
      <div className="batch-record">
        <strong>{t('groundBatchId', { batch: next + 1 })}</strong>
        <span>{t(remaining === 0 ? 'groundLastBatch' : remaining === 1 ? 'groundRemainingOne' : 'groundRemaining', { count: remaining })}</span>
      </div>
      {progress}
      {archiveMisses !== undefined && <p className="warning" id="archive-impact">
        {t(archiveMisses === minimum ? 'groundArchiveShortfall' : 'archiveGoalShortfall', { goal })}
      </p>}
      <div className="action-row">
        <ActionButton onClick={() => send({ type: 'checkBatch', batch: next, deliver: true })}>{t('groundAccept')}</ActionButton>
        <button className="button secondary" aria-describedby={archiveMisses === undefined ? undefined : 'archive-impact'}
          onClick={() => send({ type: 'checkBatch', batch: next, deliver: false })}>{t('groundArchive')}</button>
      </div>
    </>
  }
  const plan = mission.contact && planContact(evidence as CubeSatEvidence, choice)
  const all = mission.contact && planContact(evidence as CubeSatEvidence, 'extra')
  const goal = goalBatches(game.scienceGoal)
  const minimum = cubeSat.minimumBatches
  const missed = plan && all && [minimum, goal].find(threshold => plan.batches < threshold && all.batches >= threshold)
  return <>
    {mission.contact && <ReportCard speaker="ground" t={t}>
      <p>{t('contactEstimate', { count: testedBatches(evidence as CubeSatEvidence) })}</p>
    </ReportCard>}
    <Options legend="ground" value={choice} choose={setChoice} t={t} options={mission.ui.flightOptions?.(evidence, t) ?? []} />
    {missed && <p className="warning" role="status">{t(missed === minimum ? 'contactPlanMissesMinimum' : 'contactPlanMissesGoal', { goal })}</p>}
    {all && all.batches < goal && <p className="action-note">{t('contactCapacityBelowGoal', { count: all.batches, goal })}</p>}
    <ActionButton onClick={() => send({ type: mission.contact ? 'startContact' : 'fly', choice })}>{t('runFlight')}</ActionButton>
  </>
}

function SegmentHistory({ mission, steps, t }: { mission: MissionModule; steps: SegmentEntry[]; t: Translate }) {
  return <ol className="decision-log">
    {steps.map(step => {
      const segment = mission.segmentedFlight?.segments.find(item => item.id === step.id)
      return <li key={step.id}>
        <strong>{segment ? t(segment.title) : step.id}</strong>
        {step.updates?.map((update, index) => <p key={index}>{copy(t, update)}</p>)}
        {step.report && <p>{copy(t, step.report)}</p>}
      </li>
    })}
  </ol>
}

function SegmentControls({ game, mission, send, t }: Controls) {
  // A decision with a single option starts selected, so the player is not asked to pick the only choice.
  const [choice, setChoice] = useState<string | null>(() => {
    const only = currentFlightSegment(game)?.choices?.(flightContext(game)) ?? []
    return only.length === 1 ? only[0].id : null
  })
  const segment = currentFlightSegment(game)
  if (!segment) return null
  const context = flightContext(game)
  const brief = segment.brief?.(context)
  const file = segment.file?.(context)
  const quote = segment.quote?.(context)
  const status = segment.status?.(context)
  const lastReport = context.progress.steps.at(-1)?.report
  const choices = segment.choices?.(context) ?? []
  return <>
    <h2>{t(segment.title)}</h2>
    {brief && <p>{copy(t, brief)}</p>}
    {game.commission && lastReport && <p role="status">{copy(t, lastReport)}</p>}
    {context.progress.updates?.map((update, index) => <p key={index}>{copy(t, update)}</p>)}
    {status && <p className="action-note">{copy(t, status)}</p>}
    {choices.length > 0 && <Options legend="segmentChoices" value={choice} choose={setChoice} t={t}
      options={choices.map(option => ({ id: option.id, name: option.label, detail: copy(t, option.detail), extra: option.consequence &&
        <small className={option.warning ? 'bad' : undefined}>{copy(t, option.consequence)}</small>,
      }))} />}
    <ActionButton disabled={choices.length > 0 && !choices.some(option => option.id === choice)}
      onClick={() => send({ type: 'segment', segment: segment.id, choice, turn: context.progress.turn ?? 0 })}>{t(segment.action ?? 'runSegment')}</ActionButton>
    {quote && <Disclosure label={t('missionStory')}><blockquote>{t(quote)}</blockquote></Disclosure>}
    {file && <MissionFile file={file} t={t} />}
    {context.progress.steps.length > 0 && <Disclosure label={t('flightHistory')}>
      <SegmentHistory mission={mission} steps={context.progress.steps} t={t} />
    </Disclosure>}
  </>
}

function ReviewControls({ game, send, t }: Controls) {
  const [selected, setSelected] = useState<string[]>([])
  const review = pendingReview(game)
  if (!review) return null
  const offered = review.issues.flatMap(issue => issue.waiver ? [issue.waiver] : [])
  const waivers = selected.filter(id => offered.some(waiver => waiver.id === id))
  const previous = [...game.log].reverse().find(entry => entry.review?.gate === review.gate)?.review
  return <>
    {review.gate === 'FRR' && <p className="action-note"><strong>Elena</strong> · {t(offered.length ? 'storyReviewRisk' : 'storyReviewEvidence')}</p>}
    {previous && !previous.passed && previous.detail && <p className="warning" role="status">{copy(t, previous.detail)}</p>}
    {review.issues.some(issue => !issue.waiver) && <ul>{review.issues.filter(issue => !issue.waiver).map(({ detail, item }, index) => <li key={index}>{item && `${t(item)} · `}{copy(t, detail)}</li>)}</ul>}
    {offered.length > 0 && <fieldset className="options rows">
      <legend>{t('chapterReviewSign')}</legend>
      {offered.map(waiver => <label className="option" key={waiver.id}>
        <input type="checkbox" checked={waivers.includes(waiver.id)}
          onChange={event => setSelected(event.target.checked ? [...waivers, waiver.id] : waivers.filter(id => id !== waiver.id))} />
        <span><strong>{t(waiver.label)}</strong><small>{copy(t, waiver.detail)}</small></span>
      </label>)}
    </fieldset>}
    <ActionButton onClick={() => send({ type: 'review', waivers, turn: game.log.length })}>
      {t('submitGate', { gate: review.gate })}
    </ActionButton>
  </>
}

function evidenceStatus(current: ReturnType<typeof currentEvidence>, t: Translate) {
  return current
    ? t('checksPassed', { count: current.checks.filter(Boolean).length, total: current.checks.length })
    : t('noCurrentEvidence')
}

function CubeSatReviewStatus({ game, t }: Pick<Props, 'game' | 't'>) {
  const evidence = currentEvidence(game) as CubeSatEvidence | null
  const result = evidence ?? testDesign(game.design as CubeSatDesign)
  const status = evidence ? passes(evidence) ? 'evidencePassed' : 'evidenceReturned'
    : game.evidence ? 'evidenceRetest' : 'evidencePending'
  return <section className="evidence-status" aria-label={t('releaseStatus')}>
    <h2>{t('releaseStatus')} · <span>{t(status)}</span></h2>
    {status === 'evidenceRetest' && <p className="warning">{t('evidenceRetestWhy')}</p>}
    {evidence && !passes(evidence) && <div className="warning">
      <Findings evidence={evidence} t={t} />
      {!evidence.ditlPass && <p>{t('ditlComparison', evidence.ditl)}</p>}
    </div>}
    <Disclosure label={t('releaseRules')}>
      <p>{t('releaseThresholds', { available: result.available, count: cubeSat.minimumBatches, minutes: result.ditl.threshold, limit: result.massLimit })}</p>
    </Disclosure>
  </section>
}

// Four plain criteria the challenge asks a score to reward: success, science value, efficient use of resources and
// good engineering decisions. Each is shown with its reason, so the rating explains itself.
function MissionRating({ game, mission, t }: Pick<Props, 'game' | 'mission' | 't'>) {
  const { flight } = game
  const left = game.missionId === cubeSat.id ? game.credits : flight?.credits ?? game.credits
  const reserveTarget = game.missionId === lunarMission.id ? lunarMission.returnedReserveForEfficiency : Math.ceil(mission.budget / 10)
  const criteria = [
    { id: 'ratingDelivered', met: Boolean(flight?.delivered) },
    { id: 'ratingStretch', met: Boolean(flight?.stretch) },
    { id: 'ratingReserve', met: Boolean(flight?.delivered) && left >= reserveTarget },
    { id: 'ratingVerified', met: game.log.some(entry => mission.ui.verificationWork?.has(entry.id.replace(/^(lab|support):/, '')) && !entry.incomplete)
      && !mission.ui.knownDefectAtLaunch?.(game) },
  ] as const
  const stars = criteria.filter(item => item.met).length
  return <section className="mission-rating" aria-label={t('ratingTitle')}>
    <strong>{t('ratingTitle')} · {'★'.repeat(stars)}{'☆'.repeat(criteria.length - stars)}</strong>
    <ul>{criteria.map(item => <li key={item.id} className={item.met ? 'good' : undefined}>
      {item.met ? '✓' : '·'} {t(item.id === 'ratingReserve' && game.missionId === lunarMission.id ? 'lunarRatingReserve' : item.id,
        { percent: 10, target: reserveTarget })}
    </li>)}</ul>
  </section>
}

function Results({ game, mission, progress, t, back, replay, open, studio = false }: Props & { studio?: boolean }) {
  const { flight, stop, evidence } = game
  const legacyCubeSat = game.missionId === cubeSat.id && !game.commission
  const next = nextMission(game.missionId)
  const current = currentEvidence(game)
  const outcome = !flight ? mission.outcomes.stopped : flight.stretch ? mission.outcomes.extra
    : flight.delivered ? mission.outcomes.success : mission.outcomes.partial
  const customOutcome = mission.ui.outcome?.(game, t)
  const interrupted = mission.segmentedFlight?.segments.find(segment => segment.id === flight?.interruptedAt)
  const stopCopy = { deadline: 'stopDeadline', funds: 'stopFunds', cancelled: 'stopCancelled', margin: 'orbitalStopMargin' } as const
  const batches = (count: number) => t('dataBatches', { count })
  const summary = <>
    <Heading eyebrow={`${t('results')} · ${t('phaseF')}`} title={t(customOutcome?.title ?? outcome)} focusable={studio}>
      {customOutcome?.detail ? copy(t, customOutcome.detail) : flight ? mission.ui.flightSummary(flight, t) : stop && t(stopCopy[stop])}
    </Heading>
    {interrupted && <p className="notice">{t('flightInterrupted', { segment: t(interrupted.title) })}</p>}
    {flight?.delivered && next && missions[next.id] && <p className={studio ? 'studio-unlocked' : 'notice'} role="status">{t('nextUnlocked', { mission: t(next.title) })}</p>}
    <dl className="resource-line">
      <div><dt>{t('usedWeeks')}</dt><dd>{t('weeks', { count: game.week })}</dd></div>
      <div><dt>{t('spentCredits')}</dt><dd>{missionMoney(mission, missionSpending(mission, game), t)}</dd></div>
    </dl>
  </>
  const actions = <div className="action-row">
      {flight?.delivered && next && <ActionButton onClick={() => open(next.id)}>{t('nextBrief', { mission: t(next.title) })}</ActionButton>}
      <button className="button secondary" onClick={back}>{t('home')}</button>
      <button className="button secondary" onClick={replay}>{t(game.commission ? 'replayCommission' : 'playAgain')}</button>
      {game.commission && <button className="button secondary" onClick={() => open(game.missionId)}>{t('changeCommission')}</button>}
    </div>
  const client = game.commission ? commissionFor(game) : null
  const detail = !studio ? undefined : client && flight ? <CommissionDeliveryFeedback game={game} flight={flight} t={t} />
    : flight?.delivered ? <p>{t(mission.id === orbitalLaunch.id ? 'studioOrbitalImpact' : 'studioLunarImpact')}</p>
    : game.evidence?.auxPass === false ? <p>{t('commissionInterfaceFailed')}</p> : undefined
  const outcomeArt = flight ? flight.delivered ? 'delivered' : 'short' : 'stopped'
  return <article className={studio ? 'studio-results' : 'manual'}>
    {studio ? <>
      <div className="studio-workspace">
        <StudioScene missionId={mission.id} game={game} result={outcomeArt} speaker={flight ? 'comms' : 'power'} prop={flight ? 'data' : 'scale'} t={t} />
        <div className="studio-handoff studio-outcome">
          {summary}
          {!flight && <p className="studio-update">{t('studioStoppedAt', { stage: t(stoppedStage(game)) })}</p>}
          {detail && <StudioBubble t={t} speaker={flight ? 'comms' : 'power'} prop={flight ? 'data' : 'scale'}>{detail}</StudioBubble>}
        </div>
      </div>
      {actions}
    </> : summary}
    <ResultsDetails studio={studio} t={t}>
      {legacyCubeSat && <CubeSatDebrief game={game} goal={goalBatches(game.scienceGoal)} t={t} />}
      {mission.ui.Debrief && <mission.ui.Debrief game={game} t={t} />}
      <section className="receipt" aria-label={t('results')}>
        <Disclosure label={t('estimate')} value={legacyCubeSat
          ? passes(testDesign(game.design as CubeSatDesign)) ? batches(forecast(game.design as CubeSatDesign).batches) : t('planBlocked')
          : undefined}>
          <mission.ui.Estimate design={game.design} game={game} t={t} />
        </Disclosure>
        {evidence ? <Disclosure label={t('report')} value={current && legacyCubeSat
          ? t('testedData', { count: testedBatches(current as CubeSatEvidence) })
          : evidenceStatus(current, t)}>
          <EvidenceReport mission={mission} evidence={evidence} t={t} outdated={!current} />
        </Disclosure> : <div className="receipt-line"><span>{t('report')}</span><small>{t('noEvidence')}</small></div>}
        {flight ? <Disclosure label={t('delivery')} value={game.missionId === cubeSat.id ? batches(flight.batches) : mission.ui.flightSummary(flight, t)}>
          <mission.ui.Delivery flight={flight} t={t} />
          {flight.segments && <SegmentHistory mission={mission} steps={flight.segments} t={t} />}
        </Disclosure> : <div className="receipt-line"><span>{t('delivery')}</span><small>{t('noFlight')}</small></div>}
      </section>
      <RiskDebrief game={game} mission={mission} t={t} />
      <MissionRating game={game} mission={mission} t={t} />
      <StoryDebrief game={game} t={t} />
      {game.missionId === 'lunar-mission' && <Portfolio progress={progress} t={t} />}

      <div className="references">
        <Disclosure label={t('phaseTableTitle')}><PhaseTable t={t} current="F" /></Disclosure>
        {mission.ui.sources && <Disclosure label={t('nasaSources')}>
          <p>{t('nasaSourcesDetail')}</p>
          <ul>{mission.ui.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.source}</a></li>)}</ul>
        </Disclosure>}
        {game.missionId !== cubeSat.id && <p>{t('gates', { gate: game.gate })}</p>}
        {game.log.length > 0 && <Disclosure label={t('log')}><DecisionLog game={game} mission={mission} t={t} /></Disclosure>}
      </div>
    </ResultsDetails>
    {!studio && actions}
  </article>
}

function ResultsDetails({ studio, t, children }: { studio: boolean; t: Translate; children: ReactNode }) {
  return studio ? <Disclosure label={t('studioResultDetails')}>{children}</Disclosure> : children
}

function Repair({ game, mission, t, send }: Controls) {
  const [choice, select] = useState<string | null>(null)
  const options = repairOptions(game).map(remedy => {
    const total = repairAndRetestCost(game, remedy)
    const fits = affordable(game, total)
    return {
      id: remedy,
      name: mission.costs[remedy].label,
      detail: t('repairAndRetest', { weeks: total.weeks, cost: missionMoney(mission, total.credits, t) }),
      extra: <>
        <small className={fits ? 'good' : 'bad'}>{t(fits ? 'repairFits' : 'noRepairTime')}</small>
        <mission.ui.RemedyPreview design={game.design} remedy={remedy} t={t} />
      </>,
      disabled: !fits,
    }
  })
  const selected = options.find(option => option.id === choice && !option.disabled)
  return <>
    <Options legend="repairChoices" value={choice} choose={select} t={t} options={options} />
    <ActionButton disabled={!selected} onClick={() => selected && send({ type: 'repair', remedy: selected.id })}>
      {t('selectCorrection')}
    </ActionButton>
  </>
}

function Reference({ game, mission, t, send, showEvidence = true }: Controls & { showEvidence?: boolean }) {
  const editable = canConfigure(game)
  const estimate = game.missionId === cubeSat.id && !game.commission ? testDesign(game.design as CubeSatDesign) : null
  const cost = baselineRemainingCost(game)
  const current = currentEvidence(game)
  const matching = game.analysis && sameDesign(game.analysis.design, game.design)
  const canEnd = !game.event && game.stage !== 'flight' && (mission.tasks || game.stage !== 'review' || game.returned)
  const analysisCost = mission.costs.analyze
  const wait = taskOptions(game).find(task => task.id === 'wait')
  return <aside className="references" aria-label={t('missionInfo')}>
    {showEvidence && game.evidence && <Disclosure label={t('report')} value={evidenceStatus(current, t)}>
      <EvidenceReport mission={mission} evidence={game.evidence} t={t} outdated={!current} />
    </Disclosure>}
    {editable && !mission.tasks && mission.forecast && analysisCost && <Disclosure label={t('analysisAction')}>
      <button className="button secondary" disabled={Boolean(matching) || !affordable(game, analysisCost)}
        onClick={() => send({ type: 'analyze' })}>{t('analyze')} <CostLabel t={t} mission={mission} {...analysisCost} /></button>
    </Disclosure>}
    {game.analysis && <Disclosure label={t('analysisReport')}>
      {!matching && <p>{t('analysisOld')}</p>}
      <DesignSummary mission={mission} design={game.analysis.design} t={t} />
      <mission.ui.Forecast design={game.analysis.design} forecast={game.analysis.forecast} t={t} />
    </Disclosure>}
    {(!editable || game.missionId !== cubeSat.id) && <Disclosure label={t('estimate')}>
      <dl className="fact-list">
        {estimate && <div><dt>{t('planDataLabel')}</dt><dd>{passes(estimate) ? t('dataBatches', { count: estimate.batches }) : t('planBlocked')}</dd></div>}
        {cost > 0 && <div><dt>{t('designCost')}</dt><dd>{missionMoney(mission, cost, t)}</dd></div>}
      </dl>
      {mission.ui.Status ? <mission.ui.Status game={game} t={t} /> : <mission.ui.Estimate design={game.design} game={game} t={t} />}
    </Disclosure>}
    <Disclosure label={t('glossaryTitle')}><Glossary t={t} /></Disclosure>
    <Disclosure label={t('details')}>
      {game.stage !== 'results' && <p>{t(game.returned ? 'returnedDetail' : mission.stageDetails[game.stage], { percent: percent(reviewRiskThreshold) })}</p>}
      <Disclosure label={t('configuration')}><DesignSummary mission={mission} design={game.design} t={t} /></Disclosure>
      {!game.commission && <Disclosure label={t('briefTitle')}><mission.ui.Requirements t={t} /></Disclosure>}
      <Disclosure label={t('phaseTableTitle')} value={`Phase ${phaseOf(game)}`}>
        <PhaseTable t={t} current={phaseOf(game)} />
      </Disclosure>
      {game.log.length > 0 && <Disclosure label={t('log')}><DecisionLog game={game} mission={mission} t={t} /></Disclosure>}
    </Disclosure>
    {canEnd && <Disclosure label={t('missionActions')}>
      <div className="action-row">
        {!mission.tasks && <button className="text-button" onClick={() => send({ type: 'wait' })}>{t('wait')}</button>}
        {wait && <button className="text-button" disabled={!affordable(game, wait.cost)}
          onClick={() => send({ type: 'task', task: wait.id, turn: game.log.length })}>
          {t(mission.costs[wait.id].label)} <CostLabel t={t} mission={mission} {...wait.cost} />
        </button>}
        <button className="text-button" onClick={() => window.confirm(t('cancelPrompt')) && send({ type: 'cancel' })}>{t('cancel')}</button>
      </div>
    </Disclosure>}
  </aside>
}

function MissionFile({ file, t }: { file: File; t: Translate }) {
  return <Disclosure label={t(file.title.message, file.title.values)}>
    <p>{copy(t, file.detail)}</p>
    <ul>{file.sources.map(source => <li key={source.url}>
      <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
    </li>)}</ul>
  </Disclosure>
}

function MissionEvent({ game, mission, t, send }: Controls) {
  const event = pendingEvent(game)
  if (!event) return null
  const work = pendingWorkId(game)
  const subject = event.subject?.(game)
  return <section className="next-decision" aria-labelledby="mission-event">
    <h2 id="mission-event">{t(event.title)}</h2>
    <p>{t(event.detail, { ...event.values?.(game), ...(subject && { item: t(subject) }) })}</p>
    {game.missionId === 'orbital-launch' && event.id === 'foundLink' &&
      <p className="action-note"><strong>Elena</strong> · {t('storyOrbitalFound')}</p>}
    {work && <p className="notice">{t(game.pendingWork!.remaining ? 'workPaused' : 'workPausedDone', { work: t(mission.costs[work].label), week: game.week, count: game.pendingWork!.remaining })}</p>}
    <div className="event-choices">
      {event.choices.filter(choice => choice.available?.(game) !== false).map(choice => {
        const label = t(choice.label)
        const detailId = `${event.id}-${choice.id}-detail`
        return <ActionButton className="button secondary event-option" key={choice.id} aria-label={`${t('eventChoose')} ${label}`}
          aria-describedby={detailId}
          onClick={() => send({ type: 'choose', event: event.id, choice: choice.id })}>
          <span><strong>{label}</strong><small id={detailId}>{t(choice.detail, choice.values?.(game))}</small></span>
        </ActionButton>
      })}
    </div>
    {event.quote && <Disclosure label={t('missionStory')}><blockquote>{t(event.quote)}</blockquote></Disclosure>}
    {event.file && <MissionFile file={event.file} t={t} />}
  </section>
}

function ChapterConfig({ game, mission, t, send }: Controls) {
  const groups = Object.entries(mission.groups).filter(([id]) => mission.configurable?.(game, id) !== false)
  const [selected, select] = useState(groups[0]?.[0])
  const active = groups.some(([id]) => id === selected) ? selected : groups[0]?.[0]
  if (active === undefined) return null
  const group = mission.groups[active]
  return <div className="decisions chapter-config">
    {groups.length > 1 && <ConfigSwitch active={active} label={t('configuration')} choose={select}
      items={groups.map(([id, item]) => ({ id, name: t(item.legend) }))} />}
    <Options key={active} legend={group.legend} layout="pair" options={optionList(group.options, t, mission)} value={game.design[active]} t={t}
      choose={value => send({ type: 'configure', design: { ...game.design, [active]: value } })} />
  </div>
}

function MissionWork({ game, mission, t, send }: Controls) {
  const work = currentWork(game)
  const cost = !mission.tasks && work && workCost(game, work)
  const tasks = taskOptions(game).filter(task => task.id !== 'wait')
  const primary = tasks.filter(task => game.returned || !mission.ui.optionalTasks?.has(task.id))
  const optional = tasks.filter(task => !game.returned && mission.ui.optionalTasks?.has(task.id))
  const last = game.log.at(-1)?.detail
  function renderTask(task: (typeof tasks)[number], secondary = false) {
    const name = t(mission.costs[task.id].label, { ...task.cost, slots: 1 })
    const support = task.id.startsWith('lab:') || task.id.startsWith('support:')
    return <div key={task.id}>
      <ActionButton {...(secondary && { className: 'button secondary' })}
        disabled={!affordable(game, task.cost)} onClick={() => send({ type: 'task', task: task.id, turn: game.log.length })}>
        {support ? t(task.id.startsWith('lab:') ? 'orbitalSupportTask' : 'lunarSupportTask', { work: name }) : name} <CostLabel t={t} mission={mission} {...task.cost} />
      </ActionButton>
      {mission.ui.TaskNote && <mission.ui.TaskNote game={game} task={task.id} cost={task.cost} t={t} />}
    </div>
  }
  return <div className="decisions">
    {last && game.log.at(-1)?.review === undefined && <p className="action-note" role="status">{copy(t, last)}</p>}
    {game.log.at(-1)?.review?.passed && game.log.at(-1)?.review?.detail && <p className="verified" role="status">{copy(t, game.log.at(-1)!.review!.detail!)}</p>}
    {canConfigure(game) && <ChapterConfig game={game} mission={mission} t={t} send={send} />}
    {mission.ui.Preview && <div className="forecast-line"><mission.ui.Preview game={game} t={t} /></div>}
    {mission.tasks ? <div className="task-list">{primary.map(task => renderTask(task))}</div>
      : work && cost && !(game.gate === 'PDR' && mission.reviews?.PDR) &&
      <ActionButton disabled={!affordable(game, cost)} onClick={() => send({ type: 'work' })}>
        {t(work === 'integrate' && game.evidence ? 'retest' : mission.costs[work].label)} <CostLabel t={t} mission={mission} {...cost} />
      </ActionButton>}
    {optional.length > 0 && <Disclosure label={t('optionalTasks')}>
      <div className="task-list">{optional.map(task => renderTask(task, true))}</div>
    </Disclosure>}
  </div>
}

function MissionTools({ game, mission, t, send }: Controls) {
  return <Reference key={game.stage} game={game} mission={mission} t={t} send={send} />
}

// The verification choice sits in the main column with a one-line summary, so a first-time player sees it.
function CubeSatRiskChecks({ game, mission, t, send }: Controls) {
  const items = mission.risks?.view(game) ?? []
  const open = items.filter(item => !item.state.fixed && item.risk > reviewRiskThreshold)
  return <Disclosure label={t('optionalRiskChecks')} value={open.length
    ? t('riskSummary', { count: open.length, items: open.map(item => `${t(item.label)} ${percent(item.risk)}%`).join(t('listSeparator')) })
    : t('riskSummaryClear')}>
    <RiskPanel game={game} mission={mission} t={t} send={send} />
  </Disclosure>
}

export function Single(props: Props) {
  const { game } = props
  const studio = usesStudio(game)
  if (game.stage === 'results' && !game.playback) return <Results {...props} studio={studio} />
  return studio ? <Studio {...props} /> : <LegacyWorkbench {...props} />
}

function LegacyWorkbench(props: Props) {
  const { game, mission, t, send, back } = props
  const isCubeSat = game.missionId === cubeSat.id && !game.commission
  const checks = currentEvidence(game)
  const editable = canConfigure(game)
  const stage = game.playback?.kind === 'assembly' ? 'build' : game.playback?.kind ?? game.stage
  const segment = currentFlightSegment(game)
  const customReview = stage === 'design' ? mission.reviews?.PDR : stage === 'review' ? mission.reviews?.FRR : undefined
  const latestAnalysis = editable && game.analysis && ['analysisClear', 'analysisConflict'].includes(game.log.at(-1)?.id ?? '')
    && sameDesign(game.analysis.design, game.design) ? game.analysis : null
  const latestReview = [...game.log].reverse().find(entry => entry.review)?.review

  const phase = phaseOf(game, stage)
  return <article className="single-mission">
    <div className="mission-heading">
      <Heading eyebrow={t(mission.title)} title={t(game.returned ? 'returned' : stage)} />
      <Back t={t} onClick={back} />
    </div>
    <div className="mission-steps" aria-label={t('process')}>
      <span aria-current="step">{phaseLabel(phase, t)}</span>
      <progress value={phases.indexOf(phase) + 1} max={phases.length} aria-label={t('process')} />
    </div>
    <dl className="resource-line mission-resources">
      {isCubeSat && stage === 'flight' ? <>
        <div><dt>{t('groundPassLabel')}</dt><dd>{t(game.contact ? 'contactInProgress' : 'contactPending')}</dd></div>
        <div><dt>{t('delivery')}</dt><dd>{t('dataBatches', { count: game.contact?.accepted ?? 0 })}</dd></div>
      </> : <>
        <div><dt>{t('flightWindow')}</dt><dd>{t('weeks', { count: availableWeeks(game) })}</dd></div>
        <div><dt>{t('budgetLabel')}</dt><dd>{missionMoney(mission, game.credits, t)}</dd></div>
      </>}
      {game.commission && <div><dt>{t('commissionChoose')}</dt><dd>{t(commissionFor(game).name)}</dd></div>}
      {isCubeSat && <div><dt>{t('scienceGoal')}</dt><dd>{t('dataBatches', { count: goalBatches(game.scienceGoal) })}</dd></div>}
    </dl>
    <div className={game.playback ? 'mission-layout playback-layout' : 'mission-layout'}>
      {game.playback ? <div className="next-decision">
        <p className="action-note">{t(game.playback.kind === 'assembly' ? 'assemblyPlaybackPurpose' : 'integrationPlaybackPurpose')}</p>
        <Lab game={game as CubeSatGame} t={t} send={send} />
      </div> : <div className="mission-controls">
        {game.event && <MissionEvent {...props} />}
        {!game.event && <section className="next-decision decision-arrival" key={`${stage}:${game.returned}`}>
          {isCubeSat && (stage === 'review' || (stage === 'integration' && game.evidence)) && <CubeSatReviewStatus game={game} t={t} />}
          {isCubeSat && (stage === 'build' || stage === 'integration') && !game.evidence &&
            <p>{t(mission.stageDetails[stage])}</p>}
          {!isCubeSat && stage === 'flight' && latestReview?.passed && latestReview.detail && <p role="status">{copy(t, latestReview.detail)}</p>}
          {isCubeSat
            ? (stage === 'build' || stage === 'integration') && <BenchWork {...props} />
            : stage !== 'flight' && <MissionWork {...props} />}
          {isCubeSat && editable && <CubeSatConfig {...props} />}
          {isCubeSat && stage !== 'flight' && !game.returned && <CubeSatRiskChecks {...props} />}
          {latestAnalysis && <p className={!mission.forecastClear?.(latestAnalysis.forecast) ? 'warning' : 'verified'} role="status">
            {t(!mission.forecastClear?.(latestAnalysis.forecast) ? 'analysisTradeoff' : 'analysisClear')}
          </p>}
          {game.returned && stage === 'review' && !mission.tasks && repairOptions(game).length > 0 && <Repair {...props} />}
          {isCubeSat && stage === 'review' && !game.returned && checks && passes(checks) && riskAcceptance(game).length > 0 && <p className="action-note">
            {t('riskSignNote', { items: mission.risks!.view(game).filter(item => item.risk > reviewRiskThreshold)
              .map(item => t('riskAcceptItem', { item: t(item.label), percent: percent(item.risk), severity: t(item.severity === 'fatal' ? 'riskSeverityFatal' : 'riskSeverityDegraded') })).join(' / ') })}
          </p>}
          {customReview ? <ReviewControls key={game.log.length} {...props} />
            : stage === 'review' && !game.returned && <ActionButton onClick={() => send({ type: 'review' })}>{t('submitReview')}</ActionButton>}
          {stage === 'flight' && (mission.segmentedFlight
            ? <SegmentControls key={`${segment?.id}:${game.flightProgress?.turn ?? 0}`} {...props} />
            : <Flight {...props} />)}
        </section>}
      </div>}
      {isCubeSat && !game.event && !game.playback && <div className="mission-lab">
        <Lab key={stage} game={game as CubeSatGame} t={t} send={send} compact={!game.contact} />
      </div>}
      {!game.commission && !game.event && !game.playback && <div className="mission-reference">
        {isCubeSat && editable ? <Disclosure label={t('missionTools')}><MissionTools {...props} /></Disclosure>
          : <MissionTools {...props} />}
      </div>}
    </div>
  </article>
}

const draftKey = 'space-mission.studio-draft.v1'

export function clearDecisionDraft() {
  writeLocal(draftKey, null)
}

function useDecisionDraft(key: string) {
  const prefix = key + '|'
  const [values, setValues] = useState<string[]>(() => {
    const draft = readLocal(draftKey)
    return draft?.startsWith(prefix) ? draft.slice(prefix.length).split('|').filter(Boolean) : []
  })
  return [values, (next: string[]) => {
    setValues(next)
    writeLocal(draftKey, prefix + next.join('|'))
  }] as const
}

function Shortage({ game, mission, t, weeks, credits }: Pick<Controls, 'game' | 'mission' | 't'> & { weeks: number; credits: number }) {
  const shortWeeks = Math.max(0, weeks - availableWeeks(game))
  const shortCredits = Math.max(0, credits - game.credits)
  if (!shortWeeks && !shortCredits) return null
  return <small className="studio-blocker">{t(shortWeeks && shortCredits ? 'studioBudgetBlock' : shortWeeks ? 'studioTimeBlock' : 'studioFundsBlock', {
    weeks: t('weeks', { count: shortWeeks }), cost: missionMoney(mission, shortCredits, t),
  })}</small>
}

function studioConfigGroups(game: Game, mission: MissionModule) {
  return Object.entries(mission.groups).filter(([id]) => mission.configurable?.(game, id) !== false)
}

type ConfigGroups = ReturnType<typeof studioConfigGroups>

type PlanningMargin = {
  requirement: Message
  margin: number
  unit: 'kg' | 'W' | 'weeks' | 'credits'
  conservative?: number
}

function planningMargins(game: Game): PlanningMargin[] {
  if (game.commission) {
    const plan = commissionPlan(game)
    return [
      { requirement: 'planMassLabel', margin: plan.massLimit - plan.mass, unit: 'kg' },
      { requirement: 'planPowerLabel', margin: plan.available - plan.peak, unit: 'W' },
      { requirement: 'studioScheduleMargin', margin: plan.spareWeeks, unit: 'weeks' },
      { requirement: 'studioPlanBudget', margin: plan.spareCredits, unit: 'credits' },
    ]
  }
  if (game.missionId === orbitalLaunch.id) {
    const { lift } = orbitalRisks(game.seed, game.design as OrbitalDesign, orbitalState(game))
    return [
      { requirement: 'studioLiftMargin', margin: lift.limit - lift.known.min, conservative: lift.limit - lift.known.max, unit: 'kg' },
      { requirement: 'studioPlanBudget', margin: game.credits - orbitalPlanCost(game), unit: 'credits' },
    ]
  }
  const budget = lunarBudgetForecast(game)
  return [
    { requirement: 'studioPropellantMargin', margin: massBudget(game).margin - lunarMission.reserveKg, unit: 'kg' },
    { requirement: 'studioPlanBudget', margin: -budget.shortfall, unit: 'credits' },
  ]
}

function adjustmentCopy({ requirement, margin, unit, conservative }: PlanningMargin, t: Translate) {
  const target = t(requirement)
  if (margin >= 0) {
    return t(conservative !== undefined && conservative < 0 ? 'studioAdjustmentVerify' : 'studioAdjustmentClears', { target })
  }
  const count = Math.round(-margin * 10) / 10
  const amount = unit === 'weeks' || unit === 'credits' ? t(unit, { count }) : `${count}\u00a0${unit}`
  return t('studioAdjustmentRemaining', { target, amount })
}

function StudioConfiguration({ game, mission, t, send, disclosure, groups, active, select }: Controls & {
  disclosure?: 'open' | 'closed'; groups: ConfigGroups; active: ConfigGroups[number]; select: (group: string) => void
}) {
  const [expanded] = useState(disclosure === 'open')
  const [id, group] = active
  const unmet = new Map(planningMargins(game).filter(item => item.margin < 0).map(item => [item.requirement, item.margin]))
  const comparisons = new Map(groups.map(([key, item]) => {
    const alternatives = Object.keys(item.options).map(value => {
      const alternative = key === id || unmet.size > 0 ? runMission(game, {
        type: 'configure', design: { ...game.design, [key]: value },
      }) : game
      const improvements = alternative !== game && unmet.size > 0
        ? planningMargins(alternative).filter(item => item.margin > (unmet.get(item.requirement) ?? Infinity))
        : []
      return [value, { alternative, improvements }] as const
    })
    return [key, new Map(alternatives)] as const
  }))
  const options = optionList(group.options, t, mission).map(option => {
    const { alternative, improvements } = comparisons.get(id)!.get(option.id)!
    return { ...option, art: designIllustration(id, option.id), extra: <>
      {improvements.map(item => <small key={item.requirement} className="studio-option-guidance"
        data-meets-target={(item.conservative ?? item.margin) >= 0}>{adjustmentCopy(item, t)}</small>)}
      {game.commission ? <CommissionOption game={game} design={alternative.design} t={t} />
        : <span className="studio-option-readings"><DesignReadings game={alternative} t={t} compare /></span>}
    </> }
  })
  const configuration = <div className="studio-configuration">
    <div className="studio-preview" aria-live="polite">
      <strong>{t('studioForecast')}</strong>
      {game.commission ? <CommissionPlan game={game} t={t} /> : mission.ui.Preview && <mission.ui.Preview game={game} t={t} />}
    </div>
    <div className="studio-config-options">
      <ConfigSwitch active={id} label={t('configuration')} choose={select}
        items={groups.map(([key, item]) => {
          const targets = new Set([...comparisons.get(key)!.values()].flatMap(option => option.improvements.map(item => t(item.requirement))))
          return { id: key, name: t(item.legend) + ' · ' + t(item.options[game.design[key]].label),
            guidance: targets.size ? t('studioAdjustmentGroup', { targets: [...targets].join(t('listSeparator')) }) : undefined }
        })} />
      <Options key={id} legend={group.legend} options={options} value={game.design[id]} layout="pair" illustrated t={t}
        choose={value => send({ type: 'configure', design: { ...game.design, [id]: value } })} />
    </div>
  </div>
  return disclosure ? <Disclosure label={t('studioCompare')} open={expanded}>{configuration}</Disclosure> : configuration
}

function CommissionCorrections({ game, mission, send, t }: Controls) {
  return <div className="studio-action-grid">
    {commissionRepairs(game).map(item => {
      const late = game.stage === 'review'
      const strip = item.id === 'strip'
      const plan = commissionPlan(game, strip ? { ...game.design, capability: 'baseline' } : game.design)
      const missingWeeks = Math.max(0, item.weeks - plan.spareWeeks)
      const missingCredits = Math.max(0, item.credits - plan.spareCredits)
      return <div key={item.id} className="studio-action-card">
        <OptionArt art={strip ? { prop: 'box', extra: 'camera' } : { prop: 'camera', extra: 'repair', speaker: 'power' }} />
        <ActionButton className="button secondary" disabled={!item.fits} onClick={() => send({
          type: 'assignStudio', task: item.id, turn: game.log.length, at: Date.now(), review: late && !game.returned,
        })}>
          {t(item.cost.label)} <CostLabel t={t} mission={mission} weeks={item.weeks} credits={item.credits} />
        </ActionButton>
        <p>{t(strip ? late ? 'studioStripLate' : 'studioStripEarly' : late ? 'studioFixLate' : 'studioFixEarly')}</p>
        <small>{t('studioDeliveryEstimate')} · {deliveryEstimate(plan, t)}. {t('studioDeliveryTrade')}</small>
        {!item.fits && <small className="studio-blocker">{t(missingWeeks && missingCredits ? 'studioBudgetBlock' : missingWeeks ? 'studioTimeBlock' : 'studioFundsBlock', {
          weeks: t('weeks', { count: missingWeeks }), cost: missionMoney(mission, missingCredits, t),
        })}</small>}
      </div>
    })}
  </div>
}

type Task = ReturnType<typeof taskOptions>[number] & { correction?: { required: Cost; retest: Cost; design: Design } }

function StudioTask({ game, mission, t, send, task, card = false, onAssign }: Controls & { task: Task; card?: boolean; onAssign?: () => void }) {
  const { id, cost, correction } = task
  const required = correction?.required ?? cost
  const work = t(mission.costs[id].label, { ...cost, slots: 1 })
  const label = id.startsWith('lab:') ? t('orbitalSupportTask', { work }) : id.startsWith('support:') ? t('lunarSupportTask', { work }) : work
  return <div className={card ? 'studio-action-card' : 'studio-task'}>
    {card && <OptionArt art={taskIllustration(id)} />}
    <ActionButton className={card ? 'button secondary' : 'button primary'} disabled={!affordable(game, required)}
      onClick={() => {
        onAssign?.()
        send({ type: 'assignStudio', task: id, turn: game.log.length, at: Date.now() })
      }}>
      {label} <CostLabel t={t} mission={mission} {...cost} />
    </ActionButton>
    <Shortage game={game} mission={mission} t={t} {...required} />
    {mission.ui.TaskNote && <mission.ui.TaskNote game={game} task={id} cost={cost} t={t} />}
    {correction && mission.id === orbitalLaunch.id && <OrbitalCorrectionReading game={game} t={t} design={correction.design as OrbitalDesign} />}
    {correction && mission.id === lunarMission.id && <DesignReadings game={{ ...game, design: correction.design }} t={t} />}
    {correction && correction.retest.weeks > 0 && <small>{t('repairAndRetest', {
      weeks: cost.weeks + correction.retest.weeks, cost: missionMoney(mission, required.credits, t),
    })}</small>}
  </div>
}

function StudioEventChoices({ game, t, send, cards }: Controls & { cards: boolean }) {
  const event = pendingEvent(game)!
  const choices = event.choices.filter(choice => choice.available?.(game) !== false)
  return <div className={cards ? 'studio-action-grid' : 'studio-inline-actions'}>
    {choices.map(choice => {
      const label = t(choice.label)
      const detailId = `event-${event.id}-${choice.id}`
      return <div className={cards ? 'studio-action-card' : undefined} key={choice.id}>
        {cards && <OptionArt art={choiceIllustration(choice.id)} />}
        <ActionButton className={cards ? 'button secondary' : 'button primary'} aria-label={t('eventChoose') + ' ' + label}
          aria-describedby={cards ? detailId : undefined} onClick={() => send({ type: 'choose', event: event.id, choice: choice.id })}>{label}</ActionButton>
        {cards && <p id={detailId}>{t(choice.detail, choice.values?.(game))}</p>}
      </div>
    })}
  </div>
}

function StudioWaivers({ game, t, send, draft }: Controls & { draft: string }) {
  const review = pendingReview(game)!
  const offered = review.issues.flatMap(issue => issue.waiver ? [issue.waiver] : [])
  const [selected, select] = useDecisionDraft(draft)
  const waivers = selected.filter(id => offered.some(item => item.id === id))
  return <>
    <StudioReviewIssues game={game} t={t} />
    <fieldset className="options illustrated-options pair">
      <legend>{t('chapterReviewSign')}</legend>
      {offered.map(waiver => <label className="option" key={waiver.id}>
        <input type="checkbox" checked={waivers.includes(waiver.id)}
          onChange={event => select(event.target.checked ? [...waivers, waiver.id] : waivers.filter(id => id !== waiver.id))} />
        <OptionArt art={waiver.id === 'reserve' ? 'fuel' : waiver.id === 'unfired' ? 'rocket' : 'scale'} />
        <span><strong>{t(waiver.label)}</strong><small>{copy(t, waiver.detail)}</small></span>
      </label>)}
    </fieldset>
    <ActionButton onClick={() => send({ type: 'review', waivers, turn: game.log.length })}>
      {t('submitGate', { gate: review.gate })}
    </ActionButton>
  </>
}

function StudioReviewIssues({ game, t }: Pick<Controls, 'game' | 't'>) {
  const issues = pendingReview(game)?.issues.filter(issue => !issue.waiver) ?? []
  return issues.length > 0 && <ul className="studio-issues">{issues.map(({ detail, item }, index) =>
    <li key={index}>{item && `${t(item)} · `}{copy(t, detail)}</li>)}</ul>
}

function StudioSegmentChoice({ game, send, t, draft, ground = false }: Controls & { draft: string; ground?: boolean }) {
  const segment = currentFlightSegment(game)!
  const context = flightContext(game)
  const choices = segment.choices?.(context) ?? []
  const status = segment.status?.(context)
  const [selected, select] = useDecisionDraft(draft)
  const choice = choices.length === 1 ? choices[0].id : choices.find(option => option.id === selected[0])?.id ?? null
  const turn = context.progress.turn ?? 0
  return <>
    {!ground && status && <p className="studio-preview">{copy(t, status)}</p>}
    <Options legend="segmentChoices" layout="pair" illustrated value={choice} choose={id => select([id])} t={t}
      options={choices.map(option => ({
        id: option.id, name: option.label, detail: copy(t, option.detail), art: choiceIllustration(option.id, game.commission),
        extra: option.consequence && <small className={option.warning ? 'studio-blocker' : undefined}>
          {option.warning && '⚠ '}{copy(t, option.consequence)}
        </small>,
      }))} />
    <ActionButton disabled={choice === null} onClick={() => send({ type: 'segment', segment: segment.id, choice, turn })}>
      {t(ground ? 'studioConfirmGroundResponse' : segment.action ?? 'runSegment')}
    </ActionButton>
  </>
}

function Studio({ game, mission, t, send, back, languageControls }: Props) {
  const controls = { game, mission, t, send }
  const orbital = game.missionId === orbitalLaunch.id
  const lunar = game.missionId === lunarMission.id
  const event = pendingEvent(game)
  const segment = currentFlightSegment(game)
  const context = segment && flightContext(game)
  const flightChoices = context && segment?.choices?.(context) || []
  const flightBrief = context && segment?.brief?.(context)
  const flightStatus = context && segment?.status?.(context)
  const flightFile = context && segment?.file?.(context)
  const flightQuote = context && segment?.quote?.(context)
  const review = pendingReview(game)
  const offeredTasks: Task[] = taskOptions(game).filter(task => task.id !== 'wait' && !['correctEarly', 'correctLate', 'strip'].includes(task.id))
  const comparison = !event && !segment && !game.commission ? chapterCorrections(game) : []
  const tasks = [...offeredTasks.filter(task => !comparison.some(item => item.id === task.id)), ...comparison]
  const mandatory = tasks.filter(task => !mission.ui.optionalTasks?.has(task.id) && !task.correction)
  const optional = tasks.filter(task => mission.ui.optionalTasks?.has(task.id) || task.correction)
  const corrections = game.commission && (game.stage === 'design' || game.stage === 'review') ? commissionRepairs(game) : []
  const orbitalLiftBlocked = orbital && review?.gate === 'FRR' && review.issues.some(issue => issue.detail.message === 'orbitalFrrReturnMargin')
  const reviewBlocked = !game.commission && review?.issues.some(issue => !issue.waiver)
  const revise = !game.commission && (game.returned || reviewBlocked)
  const returnedTasks = revise ? optional.filter(task => adjustmentTasks.has(task.id) || task.id.startsWith('fix:')) : []
  const returned = revise ? [...mandatory, ...returnedTasks] : mandatory
  const extra = revise ? optional.filter(task => !returnedTasks.includes(task)) : optional
  const evidence = currentEvidence(game)
  const latest = game.log.at(-1)
  const eventChoices = event?.choices.filter(choice => choice.available?.(game) !== false) ?? []
  const eventDetail = event && t(event.detail, { ...event.values?.(game), ...(event.subject?.(game) && { item: t(event.subject(game)!) }) })
  const groups = !event && canConfigure(game) && (!game.commission || commissionCanConfigure(game)) ? studioConfigGroups(game, mission) : []
  const canEdit = groups.length > 0
  const client = game.commission ? commissionFor(game) : null
  const commissionNumbers = game.commission && !['flight', 'results'].includes(game.stage) ? commissionPlan(game) : null
  const planLimits = commissionNumbers ? commissionLimits(commissionNumbers) : []
  const stageKey = [game.missionId, game.seed, game.stage, game.log.length].join(':')
  const key = [stageKey, game.gate, game.returned, event?.id, segment?.id, game.flightProgress?.turn].join(':')
  const opening = game.stage === 'feasibility'
  const partnerOffer = lunar && event?.id === 'offers'
  const preflight = opening && !event
  const [motion, setMotion] = useState<{ paused: boolean; skipped?: string }>({ paused: false })
  const [meetingKey, setMeetingKey] = useState<string>()
  const [comparisonGroup, setComparisonGroup] = useState<string>()
  const [releaseKey, setReleaseKey] = useState<string>()
  const releaseHeading = useRef<HTMLHeadingElement>(null)
  const meetingId = lunar && opening && (partnerOffer || preflight)
    ? [game.missionId, game.seed, game.stage].join(':') : [stageKey, event?.id].join(':')
  const meetingHeading = useRef<HTMLHeadingElement>(null)
  const job = game.studioWork
  const launch = game.studioLaunch
  const lunarLaunch = lunar && segment?.id === 'launch'
  const readyToLaunch = studioReadyToLaunch(game)
  const lunarCheckout = lunar && segment?.id === 'checkout'
  const orbitalPass = orbital && segment?.id === 'pass'
  const awaitingSignal = game.commission && segment?.id === 'commission-pass' && !readyToLaunch
  const blockedPlan = event?.id === 'CostReview' || event?.id === 'PartnerExit' || (event?.id === 'budgetCut'
    && game.credits + orbitalLaunch.events.budgetCut.budgetChange < orbitalPlanCost(game))
  const designDecision = Boolean(game.commission && tasks.some(task => task.id === 'screen') && tasks.some(task => task.id === 'freeze'))
  const meetingRequired = !job && !launch && Boolean(preflight || corrections.length || revise || blockedPlan || eventChoices.length > 1 || designDecision)
  const meeting = !job && !launch && meetingKey === meetingId
  const release = !job && !event && review?.gate === 'FRR'
  const releaseVisible = release && releaseKey === stageKey
  const stageGuide = game.commission ? studioTutorialMessage(game.stage) : undefined
  const tutorial = game.studioTutorial && !game.studioTutorial.includes(game.stage) ? stageGuide : undefined
  const comparisonGuide = preflight && meeting ? tutorial : undefined
  const showWorkGuide = !meetingRequired && !event && (review || mandatory.some(task => affordable(game, task.cost)))
  const guidanceAvailable = !meeting && !job && !launch && (preflight || release || designDecision || showWorkGuide)
  const actionGuide = tutorial && guidanceAvailable
    ? preflight ? 'studioTutorialEnter'
      : tutorial
    : undefined
  const teaching = Boolean(comparisonGuide || actionGuide)
  const comparisonOpen = preflight ? !comparisonGuide : canEdit
  const activeGroup = groups.find(([id]) => id === comparisonGroup) ?? groups[0]
  let meetingPreview: MeetingPreview | undefined
  if (meeting && comparisonOpen && activeGroup) {
    const [group] = activeGroup
    const option = game.design[group]
    const art = designIllustration(group, option)
    meetingPreview = { group, option, ...(typeof art === 'string' ? { prop: art } : art) }
  }
  const finishTutorial = () => send({ type: 'studioTeach', stage: game.stage })
  const toggleMotion = () => setMotion(current => ({ ...current, paused: !current.paused, skipped: undefined }))
  const animationControl = <StudioAnimationButton paused={motion.paused} toggle={toggleMotion} t={t} />
  useEffect(() => {
    if (!job) return
    const timeout = window.setTimeout(() => send({ type: 'settleStudio', work: job }), Math.max(0, job.endsAt - Date.now()))
    return () => window.clearTimeout(timeout)
  }, [job, send])
  useEffect(() => { if (meeting && !teaching) meetingHeading.current?.focus({ preventScroll: true }) }, [meeting, teaching])
  useEffect(() => { if (releaseVisible) releaseHeading.current?.focus() }, [releaseVisible])

  const skip = () => setMotion(current => ({ ...current, skipped: key }))
  const noAnimation = motion.paused || motion.skipped === key
  const workReport = job && studioWorkReport(job.task)
  const report = workReport ?? studioReport(game, segment?.id, flightChoices[0]?.prompt, evidence?.auxPass === false || corrections.length > 0 && game.stage === 'design')
  const flightAlert = /^(risk:|card:(Eclipse|Weather|Lightning|Scrub))/.test(flightChoices[0]?.prompt ?? '')
    || flightBrief?.message === 'orbitalPassDegraded'
  const alert = Boolean(reviewBlocked) || sceneModel(mission.id, game).warning || report.message === 'studioAnomaly' || flightAlert
  const title = t(event?.title ?? (lunarLaunch && !readyToLaunch ? 'studioGroundChecks' : segment?.title)
    ?? (game.returned ? 'returned' : game.stage))
  const objective = client ? t(game.commission === 'bay' ? 'studioBayBrief' : 'studioRiverBrief', { count: client.required })
    : orbital ? t('studioOrbitalBrief', { payload: orbitalLaunch.testPayloadKg, units: orbitalLaunch.confirmationUnits })
    : t('studioLunarBrief', { count: lunarMission.minimumBatches })
  const line = job ? t('studioWorkingOn') : preflight || partnerOffer ? objective
    : awaitingSignal ? t('studioAwaitSignal') : game.commission && readyToLaunch ? t('studioClearedToLaunch') : event ? eventDetail
    : flightBrief ? copy(t, flightBrief) : orbitalLiftBlocked ? t('studioOrbitalMarginFailure')
    : lunar && reviewBlocked ? t('studioLunarReviewBlocked')
    : tasks.some(task => task.id === 'screen') ? t('studioDesignQuestion') : t(report.message)
  const work = pendingWorkId(game)
  const beforeEvent = work && <p className="notice">{t(game.pendingWork!.remaining ? 'workPaused' : 'workPausedDone', {
    work: t(mission.costs[work].label), week: game.week, count: game.pendingWork!.remaining,
  })}</p>
  const notes = event ? <>
    {eventChoices.length !== 1 && <p>{eventDetail}</p>}
    {eventChoices.length === 1 && <p>{t(eventChoices[0].detail, eventChoices[0].values?.(game))}</p>}
    {event.quote && <blockquote>{t(event.quote)}</blockquote>}
    {event.file && <MissionFile file={event.file} t={t} />}
  </> : segment && context ? <>
    {flightQuote && <blockquote>{t(flightQuote)}</blockquote>}
    {flightFile && <MissionFile file={flightFile} t={t} />}
    {context.progress.updates && <ul>{context.progress.updates.map((update, index) =>
      <li key={index}>{copy(t, update)}</li>)}</ul>}
    {context.progress.steps.length > 0 && <Disclosure label={t('flightHistory')}>
      <SegmentHistory mission={mission} steps={context.progress.steps} t={t} />
    </Disclosure>}
  </> : null
  const lastFlightReport = context?.progress.updates?.at(-1) ?? context?.progress.steps.at(-1)?.report
  const lastReview = [...game.log].reverse().find(entry => entry.review)?.review
  const latestCopy = !event && (segment
    ? lastFlightReport ?? (lastReview?.passed ? lastReview.detail : undefined)
    : latest?.review?.detail ?? latest?.detail)
  const latestTask = !event && !segment && latest && !latest.incomplete && mission.tasks?.[latest.id] && mission.costs[latest.id]
  const jobTitle = job && t(mission.costs[job.task].label, { ...mission.costs[job.task], slots: 1 })
  const decision = (id: string, label: Message, heading: string, content: ReactNode, incoming = false, secondary = false) =>
    <StudioDecision key={`${id === 'design' ? stageKey : key}:${id}`} title={heading} label={t(label)} t={t} languageControls={languageControls}
      incoming={incoming} secondary={secondary} paused={motion.paused} onSkip={skip}>{content}</StudioDecision>
  let primary: ReactNode
  if (meetingRequired) {
    primary = <ActionButton onClick={() => setMeetingKey(meetingId)}>{t('studioEnterMeeting')}</ActionButton>
  } else if (event) {
    primary = <StudioEventChoices {...controls} cards={false} />
  } else if (lunarLaunch && flightChoices.length > 0) {
    primary = <StudioSegmentChoice key={key} {...controls} draft={key + ':launch'} ground />
  } else if (readyToLaunch) {
    primary = <ActionButton onClick={() => send({ type: 'launchStudio', turn: game.flightProgress?.turn ?? 0, at: Date.now() })}>
      {t('studioLaunchVehicle')}
    </ActionButton>
  } else if (segment && context) {
    primary = flightChoices.length > 1
      ? decision('segment', 'studioRespond', title, <StudioSegmentChoice {...controls} draft={key} />, true)
      : <ActionButton onClick={() => send({ type: 'segment', segment: segment.id, choice: flightChoices[0]?.id ?? null, turn: context.progress.turn ?? 0 })}>
        {t(segment.action ?? 'runSegment')}
      </ActionButton>
  } else if (returned.length > 1) {
    primary = decision('work', 'studioChooseWork', title, <>
      <DesignReadings game={game} t={t} />
      <div className="studio-action-grid">{returned.map(task => <StudioTask key={task.id} {...controls} task={task} card />)}</div>
    </>)
  } else if (returned.length === 1) {
    primary = <StudioTask key={returned[0].id} {...controls} task={returned[0]} />
  }
  const submitReview = () => send({ type: 'review', turn: game.log.length })
  const reviewNeedsWaiver = review?.issues.some(issue => issue.waiver)
  const secondaryReview = Boolean(primary) && game.stage !== 'review'
  const reviewAction = !event && !meetingRequired && review && (!release || releaseVisible) && (reviewNeedsWaiver
    ? decision('review', release ? 'chapterReviewSign' : 'studioReview', t('submitGate', { gate: review.gate }), <StudioWaivers {...controls} draft={key + ':review'} />, false, secondaryReview)
    : !game.returned || !returned.some(task => affordable(game, task.correction?.required ?? task.cost)) ? <ActionButton className={secondaryReview ? 'button secondary' : 'button primary'}
      onClick={submitReview}>{t('submitGate', { gate: review.gate })}</ActionButton> : null)
  const reviewFirst = game.stage === 'review' && Boolean(reviewAction)
  const releaseAction = release && !releaseVisible && <ActionButton key="release-evidence" onClick={() => {
    setReleaseKey(stageKey)
    if (tutorial) finishTutorial()
  }}>{t('studioReview')}</ActionButton>
  const completeActionGuide = preflight || designDecision || release ? undefined : finishTutorial
  const blockedCommission = commissionNumbers && !corrections.length && game.stage === 'design' && !tasks.some(task => task.id === 'freeze')
    && (commissionNumbers.spareWeeks < 0 || commissionNumbers.spareCredits < 0)
  const assess = preflight && offeredTasks.find(task => task.id === 'assess')
  const canConfirm = assess && affordable(game, assess.cost) && (!commissionNumbers || (commissionNumbers.spareWeeks >= 0
    && commissionNumbers.spareCredits >= 0 && !planLimits.length))
  const discussionTasks = revise ? [...returned, ...extra] : tasks.filter(task =>
    task.correction || task.id.startsWith('fix:') || (orbital && (task.id === 'fixLink' || task.id === 'handover')))
  const hasAvailableDiscussionTask = discussionTasks.some(task => affordable(game, task.correction?.required ?? task.cost))
  const canCallMeeting = !event && !segment && (canEdit || hasAvailableDiscussionTask)
  const meetingChoices = event ? <><h3>{title}</h3><StudioEventChoices {...controls} cards />
    {(event.quote || event.file) && <Disclosure label={t('studioEventNotes')}>{notes}</Disclosure>}</>
    : corrections.length ? <>
      <h3>{t('studioAffectedRequirements')}</h3>
      {game.stage === 'review' ? !releaseVisible && <StudioReviewIssues game={game} t={t} /> : latestCopy && <p>{copy(t, latestCopy)}</p>}
      <CommissionCorrections {...controls} />
      {review && (!game.returned || !corrections.some(item => item.fits)) && <>
        {!corrections.some(item => item.fits) && <p>{t('studioNoCorrectionFits')}</p>}
        {releaseVisible && <ActionButton onClick={submitReview}>{t('submitGate', { gate: review.gate })}</ActionButton>}
      </>}
    </> : designDecision ? <>
      {tutorial && <div className="studio-tutorial-target"><TutorialNote message={tutorial} t={t} /></div>}
      <div className="studio-action-grid">{mandatory.map(task =>
        <StudioTask key={task.id} {...controls} task={task} card onAssign={tutorial ? finishTutorial : undefined} />)}
      </div>
    </> : <>
      {!comparisonOpen && !preflight && <>
        <p>{t('studioLockedPlan')}</p>
        <DesignSummary mission={mission} design={game.design} t={t} />
        {game.commission && <CommissionPlan game={game} t={t} />}
        {!game.commission && !revise && <DesignReadings game={game} t={t} />}
      </>}
      {revise && <><h3>{t('studioAffectedRequirements')}</h3><StudioReviewIssues game={game} t={t} /><DesignReadings game={game} t={t} /></>}
      {!preflight && discussionTasks.length > 0 && <div className="studio-action-grid">
        {discussionTasks.map(task => <StudioTask key={task.id} {...controls} task={task} card />)}
      </div>}
      {revise && review && (!release || releaseVisible) && !hasAvailableDiscussionTask &&
        <ActionButton onClick={submitReview}>{t('submitGate', { gate: review.gate })}</ActionButton>}
    </>

  return <article className="studio-run" data-work={job?.task}>
    <header className="studio-top">
      <Back t={t} onClick={back} />
      <h1>{t(mission.title)}</h1>
    </header>
    <dl className="studio-status" aria-label={t('process')}>
      <div><dt>{t('studioWeek', { week: game.week })}</dt><dd>{t('studioRemaining', { weeks: t('weeks', { count: availableWeeks(game) }) })}</dd></div>
      <div><dt>{t('budgetLabel')}</dt><dd>{missionMoney(mission, game.credits, t)}</dd></div>
      <div><dt>{t(segment ? 'studioCurrentGoal' : 'studioDeliveryTarget')}</dt><dd>{segment ? t(segment.title) : client ? t('dataBatches', { count: client.required })
        : mission.id === orbitalLaunch.id ? t('storyConfirmation', { count: orbitalLaunch.confirmationUnits })
        : t('dataBatches', { count: lunarMission.minimumBatches })}</dd></div>
    </dl>
    {launch ? <StudioLaunch game={game} startedAt={launch.startedAt} t={t} paused={motion.paused} toggle={toggleMotion} send={send} />
      : <div className="studio-workspace">
      <StudioScene missionId={mission.id} game={game} t={t} sequence={meeting ? meetingId : key} speaker={report.speaker} prop={report.prop} paused={noAnimation} alert={alert}
        animationControl={animationControl} meeting={meeting} meetingPreview={meetingPreview} launch={readyToLaunch ? 'countdown' : undefined}
        control={lunarCheckout ? 'lunar-checkout' : awaitingSignal || orbitalPass ? 'first-signal' : undefined} />
      <section className={`studio-handoff${alert ? ' studio-alert' : ''}`} aria-label={t('studioStartReport')}>
        <h2 ref={meetingHeading} tabIndex={-1}>{job ? t('studioWorkInProgress') : meeting ? t(preflight || partnerOffer ? 'studioInitialMeeting' : 'studioMeeting') : title}</h2>
        <StudioBubble t={t} speaker={report.speaker} prop={report.prop}><p>{line}</p></StudioBubble>
        {job ? <p className="studio-update" role="status">{jobTitle}</p> : <>
        {partnerOffer && <p>{eventDetail}</p>}
        {lunarCheckout && <p className="studio-update">{t('studioLunarCheckout')}</p>}
        {latestTask && <p className="studio-update" role={!latestCopy ? 'status' : undefined}>{t('studioWorkDone', {
          work: t(latestTask.label, { ...latestTask, slots: 1 }),
        })} {latest?.report && t(passes(latest.report) ? 'studioTestPassed' : 'checksPassed', {
          count: latest.report.checks.filter(Boolean).length, total: latest.report.checks.length,
        })}</p>}
        {latestCopy && latestCopy.message !== report.message && <p className={alert ? 'studio-blocker' : 'studio-update'} role="status">{copy(t, latestCopy)}</p>}
        {meetingRequired && !meeting && <p>{t('studioMeetingInvitation')}</p>}
        {event && beforeEvent}
        {eventChoices.length === 1 && !meeting && <p>{t(eventChoices[0].detail, eventChoices[0].values?.(game))}</p>}
        {!meeting && commissionNumbers && game.stage === 'design' && <p className={blockedCommission || planLimits.length ? 'studio-blocker' : 'studio-update'}>
          {t(client!.name)} · {t('massUse', { mass: commissionNumbers.mass, limit: commissionNumbers.massLimit })}
          {' · '}{t('studioLaunchLimit', commissionNumbers)}
        </p>}
        {!meeting && game.stage === 'design' && planLimits.map(issue => <p key={issue.message} className="studio-blocker">{copy(t, issue)}</p>)}
        {blockedCommission && <p className="studio-blocker">{t('commissionCannotFreeze')}</p>}
        {commissionNumbers && !blockedCommission && !planLimits.length && !corrections.length && game.stage === 'design'
          && ['sensor', 'combined'].includes(game.design.capability) && !game.log.some(entry => entry.id === 'screen')
          && !tasks.some(task => task.id === 'screen') && <p className="studio-blocker">{t('commissionScreenUnavailable', {
            weeks: mission.costs.screen.weeks, cost: missionMoney(mission, mission.costs.screen.credits, t),
          })}</p>}
        {!meeting && !event && !segment && !game.commission && (canEdit || game.returned) && <DesignReadings game={game} t={t} />}
        {!releaseVisible && !meeting && !event && !segment && <StudioReviewIssues game={game} t={t} />}
        {releaseVisible && <section aria-labelledby="studio-release-title" className="studio-release">
          <h3 ref={releaseHeading} id="studio-release-title" tabIndex={-1}>{t('studioReleaseEvidence')}</h3>
          {game.evidence ? <EvidenceReport mission={mission} evidence={game.evidence} t={t} outdated={!evidence} />
            : <p>{t('noEvidence')}</p>}
          <StudioReviewIssues game={game} t={t} />
          {review?.issues.length === 0 && <p className="good">{t('studioReleaseReady')}</p>}
        </section>}
        {flightStatus && <p className="studio-update">{copy(t, flightStatus)}</p>}
        {meeting && !preflight && !meetingRequired && <p>{t('studioTeamWaiting')}</p>}
        {comparisonGuide && <TutorialTarget message={comparisonGuide} t={t}>
          <ActionButton onClick={finishTutorial}>{t('studioCompare')}</ActionButton>
        </TutorialTarget>}
        {meeting && releaseAction}
        {!meeting && <div className="studio-next">
          <TutorialTarget message={actionGuide} complete={completeActionGuide} t={t}>
            {releaseAction || (reviewFirst ? reviewAction : primary ?? reviewAction)}
          </TutorialTarget>
          {releaseAction && primary && <div inert={teaching}>{primary}</div>}
          {!releaseAction && primary && reviewAction && <div inert={teaching}>{reviewFirst ? primary : reviewAction}</div>}
          {!meetingRequired && canCallMeeting && <div inert={teaching}><ActionButton className="button secondary" onClick={() => setMeetingKey(meetingId)}>
            {t(planLimits.length ? 'commissionEditPlan' : 'studioCallMeeting')}
          </ActionButton></div>}
          {stageGuide && guidanceAvailable && !teaching && <button type="button" className="text-button studio-guide-button"
            onClick={() => { setReleaseKey(undefined); send({ type: 'startStudioTutorial' }) }}>{t('studioTutorialResume')}</button>}
        </div>}
        </>}
      </section>
    </div>}
    {meeting && (!preflight || comparisonOpen) && <section className="studio-handoff studio-meeting" aria-label={t(preflight ? 'studioCompare' : 'studioMeeting')}>
      {meetingChoices}
      {comparisonOpen && activeGroup && <StudioConfiguration {...controls} groups={groups} active={activeGroup} select={setComparisonGroup}
        disclosure={preflight ? undefined : designDecision || corrections.length ? 'closed' : 'open'} />}
      {preflight ? <ActionButton disabled={!canConfirm} onClick={() => send({ type: 'assignStudio', task: 'assess', turn: game.log.length, at: Date.now() })}>
        {t('studioConfirmPlan')} <CostLabel t={t} mission={mission} {...mission.costs.assess} />
      </ActionButton> : !meetingRequired && <button className="button secondary" onClick={() => setMeetingKey(undefined)}>{t('studioCloseMeeting')}</button>}
    </section>}
    <div className="studio-files" inert={teaching || Boolean(job || launch)}>
      {!meeting && !event && !segment && extra.length > 0 && <Disclosure label={t('optionalTasks')}>
        <div className="studio-optional"><div className="studio-action-grid">{extra.map(task =>
          <StudioTask key={task.id} {...controls} task={task} card />)}</div></div>
      </Disclosure>}
      {notes && !meeting && <Disclosure label={t(event ? 'studioEventNotes' : 'studioFlightNotes')}>{notes}</Disclosure>}
      {game.evidence && <Disclosure label={t('report')} value={evidenceStatus(evidence, t)}>
        <EvidenceReport mission={mission} evidence={game.evidence} t={t} outdated={!evidence} />
      </Disclosure>}
      <Disclosure label={t('missionInfo')}>
        {game.commission && <>
          {commissionNumbers && <Disclosure label={t('studioPlans')}><CommissionPlan game={game} t={t} /></Disclosure>}
          <CommissionNote t={t} />
        </>}
        {!game.commission && mission.ui.Preview && !segment && <Disclosure label={t('studioPlans')}><mission.ui.Preview game={game} t={t} /></Disclosure>}
        <Reference {...controls} showEvidence={false} />
        <StoryBrief missionId={mission.id} t={t} />
        <MissionSources mission={mission} t={t} />
      </Disclosure>
    </div>
  </article>
}

const adjustmentTasks = new Set(['retarget', 'adapter', 'dropDiagnostics', 'dualStation', 'fixLink',
  'mount', 'partnerMount', 'dropKit', 'reroute', 'basicPayload', 'addLidar', 'handover'])

function chapterCorrections(game: Game): Task[] {
  const orbital = game.missionId === orbitalLaunch.id
  const rules = orbital ? orbitalLaunch : lunarMission
  return Object.keys(rules.remedies).flatMap(id => {
    const correction = orbital ? orbitalCorrection(game, id) : lunarCorrection(game, id)
    return correction ? [{ id, cost: correction.cost, correction }] : []
  })
}

function OrbitalCorrectionReading({ game, design, t }: { game: Game; design: OrbitalDesign; t: Translate }) {
  const { lift } = orbitalRisks(game.seed, design, orbitalState(game))
  return <small>{t('studioAdjustedLift', {
    mass: orbitalCarried(design),
    min: orbitalCapacity(design) - lift.known.max,
    max: orbitalCapacity(design) - lift.known.min,
    slots: orbitalLaunch.grounds[design.ground].capacity,
  })}</small>
}

function studioWorkReport(task: string): { speaker: Speaker; prop: Prop; message: Message } {
  const id = task.split(':').at(-1)!
  const art = taskIllustration(task.startsWith('contract:') ? task : id)
  const speaker = ['assess', 'prelim', 'trade', 'buildPayload'].includes(id) ? 'science'
    : ['buildAvionics', 'buildGround', 'rehearse', 'fixLink', 'stationTest', 'linkAnalysis'].includes(id) ? 'comms' : 'power'
  return { speaker, prop: typeof art === 'string' ? art : art.prop, message: 'studioWorkingOn' }
}

function studioReport(game: Game, segment?: string, prompt?: string, failedCamera = false): {
  speaker: Speaker; prop: Prop; message: Message
} {
  if (game.event) {
    if (/^(found|IcdMismatch|PartsAlert)/.test(game.event)) {
      return { speaker: /Link/.test(game.event) ? 'comms' : 'power', prop: /Link/.test(game.event) ? 'signal' : 'wrench', message: 'studioAnomaly' }
    }
    if (/^(offers|lab|SecondOffer|PartnerExit)/.test(game.event)) return { speaker: 'science', prop: 'contract', message: 'studioPartnership' }
    if (/^(budgetCut|CostReview)/.test(game.event)) return { speaker: 'science', prop: 'contract', message: 'studioFunding' }
    return { speaker: 'power', prop: 'data', message: 'studioEvent' }
  }
  if (segment) {
    if (segment === 'commission-extra') return { speaker: 'comms', prop: game.commission === 'bay' ? 'bay' : 'river', message: 'studioFlight' }
    if (segment === 'surface' || segment === 'night') return { speaker: 'science', prop: segment === 'surface' ? 'science' : 'battery', message: 'studioFlight' }
    if (prompt?.match(/pressure|descent|thrusters/) || segment === 'descent') return { speaker: 'power', prop: 'fuel', message: 'studioFlight' }
    return { speaker: 'comms', prop: 'signal', message: 'studioFlight' }
  }
  if (failedCamera) return { speaker: 'power', prop: 'camera', message: 'studioAuxFault' }
  if (game.returned) return { speaker: 'power', prop: 'scale', message: 'studioCorrection' }
  const lunar = game.missionId === lunarMission.id
  const orbital = game.missionId === orbitalLaunch.id
  const tasks: Record<Game['stage'], [Prop, Message]> = {
    feasibility: [game.commission ?? (orbital ? 'scale' : 'contract'), 'studioFeasibility'],
    design: ['data', lunar ? 'studioLunarDesign' : 'studioDesign'],
    build: [lunar ? 'lander' : orbital ? 'upperStage' : 'box', lunar ? 'studioLunarBuild' : orbital ? 'studioOrbitalBuild' : 'studioBuild'],
    integration: ['wrench', game.evidence ? 'studioRetest' : lunar ? 'studioLunarTest' : orbital ? 'studioOrbitalTest' : 'studioTest'],
    review: ['scale', lunar ? 'studioLunarReview' : 'studioRelease'], flight: ['signal', 'studioFlight'], results: ['data', 'studioStartReport'],
  }
  const [prop, message] = tasks[game.stage]
  return { speaker: game.stage === 'feasibility' ? 'science' : 'power', prop, message }
}

function MissionSources({ mission, t }: { mission: MissionModule; t: Translate }) {
  if (!mission.ui.sources) return null
  return <Disclosure label={t('nasaSources')}>
    <p>{t('nasaSourcesDetail')}</p>
    <ul>{mission.ui.sources.map(source =>
      <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.source}</a></li>)}</ul>
  </Disclosure>
}

function DesignReadings({ game, t, compare = false }: { game: Game; t: Translate; compare?: boolean }) {
  if (game.missionId === orbitalLaunch.id) {
    const design = game.design as OrbitalDesign
    const state = orbitalState(game)
    const { lift } = orbitalRisks(game.seed, design, state)
    const ground = orbitalLaunch.grounds[design.ground]
    const tested = lift.known.min === lift.known.max
    return <span className="studio-readings">
      <span className={lift.limit - lift.known.min < 0 ? 'studio-reading-main studio-blocker' : 'studio-reading-main'}>
        {t(tested ? 'orbitalTestedPreview' : lift.limit < 0 ? 'orbitalPreviewOver' : 'orbitalPreview', {
          carried: orbitalCarried(design), capacity: orbitalCapacity(design), margin: Math.abs(lift.limit),
          measured: lift.limit - lift.known.min, min: lift.known.min, max: lift.known.max,
          orbit: t(orbitalLaunch.orbits[design.orbit].label),
        })}
      </span>
      <small>{t('orbitalDataPlan', { required: orbitalLaunch.confirmationUnits, capacity: ground.capacity,
        degraded: orbitalDegradedCapacity(design, state) })} · {t('credits', { count: orbitalPlanCost(game) })}</small>
    </span>
  }
  const mass = massBudget(game)
  const design = lunarDesign(game)
  const route = lunarMission.routes[design.route]
  return <span className="studio-readings">
    <span className={mass.margin < lunarMission.reserveKg ? 'studio-reading-main studio-blocker' : 'studio-reading-main'}>
      {t('lunarPreview', { margin: mass.margin, reserve: lunarMission.reserveKg, dry: mass.dry })}
    </span>
    <small>{t('lunarRouteBudget', { correction: route.correctionKg, propellant: route.propellantKg,
      week: game.deadline - route.leadWeeks, allocation: lunarAllocation(game) })}</small>
    <small>{t('studioLunarDeliveryPlan', { count: lunarPlanBatches(design, 'extra', lunarMission.daylightWindows + lunarMission.powers[design.power].nightWindows).batches })}</small>
    {compare && <small>{t('chapterPlan', lunarPlanCost(game))}</small>}
  </span>
}
