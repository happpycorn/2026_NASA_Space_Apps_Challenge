import { useState } from 'react'
import { nextMission } from '../game/progress'
import {
  affordable, availableWeeks, baselineRemainingCost, canConfigure, currentEvidence, currentWork, passes, pendingEvent, repairOptions,
  sameDesign, workCost, type Action, type BenchLead, type ConfigStep, type DesignOption, type Entry, type Game, type Stage, type TestFocus,
} from '../game/mission'
import type { Message, Translate } from '../i18n'
import { missions, type MissionModule } from '../missions'
import { cubeSat, forecast, planContact, powerTimeline, scopeSegment, testDesign, type CubeSatDesign, type CubeSatEvidence, type CubeSatGame } from '../missions/cubesat'
import { Findings, powerFinding, testedBatches } from '../missions/cubesat-ui'
import { ActionButton, Back, CostLabel, DesignSummary, Disclosure, EvidenceReport, Heading, money, optionValues } from './shared'
import { ReportCard } from './ReportCard'
import { Lab } from './Lab'

const stages: Stage[] = ['feasibility', 'design', 'build', 'integration', 'review', 'flight']
type Props = { game: Game; mission: MissionModule; t: Translate; send: (action: Action) => void; back: () => void }
type Controls = Pick<Props, 'game' | 'mission' | 't' | 'send'>

export function Brief({ mission, t, begin, back, saved }: {
  mission: MissionModule; t: Translate; begin: () => void; back: () => void; saved: boolean
}) {
  return <article className="manual">
    <Back t={t} onClick={back} />
    <Heading eyebrow={t('briefTitle')} title={t(mission.title)}>{t(mission.brief)}</Heading>
    <blockquote>{t(mission.dialogue)}</blockquote>
    <dl className="resource-line">
      <div><dt>{t('flightWindow')}</dt><dd>{t('weeks', { count: mission.deadline })}</dd></div>
      <div><dt>{t('budgetInitial')}</dt><dd>{money(mission.budget)}</dd></div>
    </dl>
    <mission.ui.Requirements t={t} />
    {saved && <p className="notice">{t('replaceSave')}</p>}
    <ActionButton onClick={begin}>{t('begin')}</ActionButton>
  </article>
}

type Option<T extends string> = { id: T; name: Message; detail: string; extra?: React.ReactNode; disabled?: boolean }

function Options<T extends string>({ legend, options, value, choose, t, layout = 'rows' }: {
  legend: Message; options: Option<T>[]; value: T | null; choose: (value: T) => void; t: Translate
  layout?: 'rows' | 'pair'
}) {
  return <fieldset className={`options ${layout}`}>
    <legend>{t(legend)}</legend>
    {options.map(option => <label className="option" key={option.id}>
      <input type="radio" name={legend} checked={value === option.id} disabled={option.disabled} onChange={() => choose(option.id)} />
      <span><strong>{t(option.name)}</strong><small>{option.detail}</small>{option.extra}</span>
    </label>)}
  </fieldset>
}

function optionList(data: Record<string, DesignOption>, t: Translate): Option<string>[] {
  return Object.entries(data).map(([id, option]) => ({ id, name: option.label, detail: t(option.description, optionValues(option)) }))
}

function CubeSatConfig({ game, mission, t, send }: Controls) {
  const design = game.design as CubeSatDesign
  const result = testDesign(design)
  function choose(key: string, value: string) {
    send({ type: 'configure', design: { ...design, [key]: value } })
  }

  const feasibility = game.stage === 'feasibility'
  const first: ConfigStep = feasibility ? 'payload' : 'schedule'
  const second: ConfigStep = feasibility ? 'supply' : 'radio'
  const step = game.configStep === second ? second : first
  const payload = <div className="reported-choice">
    <ReportCard speaker="science" t={t}><p>{t(feasibility ? 'reportPayload' : 'reportPayloadRevision', { count: cubeSat.minimumBatches })}</p></ReportCard>
    <Options legend="payload" layout="pair" options={optionList(mission.groups.payload.options, t)}
      value={design.payload} choose={value => choose('payload', value)} t={t} />
  </div>
  const supply = <div className="reported-choice">
    <ReportCard speaker="power" t={t}><p>{t(feasibility ? 'reportSupply' : 'reportSupplyRevision')}</p></ReportCard>
    <Options legend="supply" layout="pair" options={optionList(mission.groups.supply.options, t)}
      value={design.supply} choose={value => choose('supply', value)} t={t} />
  </div>
  const schedule = <div className="reported-choice">
    <ReportCard speaker="comms" t={t}><p>{t('reportSchedule')}</p></ReportCard>
    <Options legend="schedule" layout="pair" options={optionList(mission.groups.schedule.options, t)}
      value={design.schedule} choose={value => choose('schedule', value)} t={t} />
  </div>
  const radio = <div className="reported-choice">
    <ReportCard speaker="comms" t={t}><p>{t('reportRadio', { minutes: cubeSat.ditl.minQuietMinutes })}</p></ReportCard>
    <Options legend="radio" layout="pair" options={optionList(mission.groups.radio.options, t)}
      value={design.radio} choose={value => choose('radio', value)} t={t} />
  </div>
  const choices = { payload, supply, schedule, radio }
  const work = feasibility ? 'assess' : 'freeze'
  const cost = workCost(game, work)
  return <div className="decisions">
    {choices[step]}
    {step === second && (!result.powerPass || (!feasibility && (!result.ditlPass || !result.dataPass))) && <div className="warning" aria-live="polite">
      {!result.powerPass && <p>{powerFinding(result, t)}</p>}
      {!feasibility && !result.ditlPass && <p>{t('earlyTransmissionEstimate', result.ditl)}</p>}
      {!feasibility && result.powerPass && !result.dataPass &&
        <p>{t('dataShortfallEstimate', { count: result.batches, minimum: cubeSat.minimumBatches })}</p>}
    </div>}
    <div className="action-row">
      {step === first ? <ActionButton onClick={() => send({ type: 'configStep', step: second })}>
        {t(feasibility ? 'nextSupply' : 'nextRadio')}
      </ActionButton> : <>
        <ActionButton disabled={!affordable(game, cost)} onClick={() => send({ type: 'work' })}>
          {t(mission.costs[work].label)} <CostLabel t={t} {...cost} />
        </ActionButton>
        <button className="text-button" onClick={() => send({ type: 'configStep', step: first })}>
          {t(feasibility ? 'backPayload' : 'backSchedule')}
        </button>
      </>}
    </div>
    {!feasibility && <Disclosure label={t('hardwareChoices')}><div className="decisions">{payload}{supply}</div></Disclosure>}
  </div>
}

function logLabel(mission: MissionModule, { id, label }: Entry): Message {
  if (label) return label
  switch (id) {
    case 'approve': return 'logApprove'
    case 'return': return 'logReturn'
    case 'operate': return 'logOperate'
    case 'analysisConflict':
    case 'analysisClear': return id
    default: return mission.costs[id].label
  }
}

function DecisionLog({ game, mission, t }: Pick<Props, 'game' | 'mission' | 't'>) {
  return <ol className="decision-log">
    {game.log.map((entry, index) => <li key={index}>
      <Disclosure label={t(logLabel(mission, entry))} value={t('logWeek', { week: entry.week })}>
        <p>{t('logCost', { count: money(entry.cost) })}</p>
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
    {build ? <>
      <ReportCard speaker="assembly" t={t}><p>{t('reportBenchChoice')}</p></ReportCard>
      <Options legend="benchChoice" value={benchLead} choose={setBenchLead} t={t} options={[
        { id: 'science', name: 'benchScience', detail: t('benchScienceDetail') },
        { id: 'power', name: 'benchPower', detail: t('benchPowerDetail') },
      ]} />
    </> : <>
      <ReportCard speaker="test" t={t}>
        <p>{t(game.evidence ? 'reviewRetest' : 'reportIntegrationFocus')}</p>
      </ReportCard>
      <Options legend="focusChoice" value={testFocus} choose={setTestFocus} t={t} options={[
        { id: 'imaging', name: 'focusImaging', detail: t('focusImagingDetail') },
        { id: 'downlink', name: 'focusRadio', detail: t('focusRadioDetail') },
      ]} />
    </>}
    <ActionButton disabled={!affordable(game, cost)} onClick={() => send({ type: 'runLab', benchLead, testFocus })}>
      {t(!build && game.evidence ? 'retest' : mission.costs[work].label)} <CostLabel t={t} {...cost} />
    </ActionButton>
  </>
}

function Flight({ game, mission, t, send }: Controls) {
  const [choice, setChoice] = useState(mission.flightChoices[0])
  const evidence = currentEvidence(game)
  if (!evidence) return null
  if (game.contact) {
    const { next, accepted, choice, diagnosticsPending } = game.contact
    const { batches, diagnostics } = planContact(evidence as CubeSatEvidence, choice)
    const remaining = batches - next - 1
    if (diagnosticsPending) return <>
      <ReportCard speaker="ground" t={t}>
        <p>{t('groundDiagnosticsReport', { slots: diagnostics, count: batches })}</p>
      </ReportCard>
      <ActionButton onClick={() => send({ type: 'checkDiagnostics' })}>{t('groundLogDiagnostics')}</ActionButton>
    </>
    return <>
      <ReportCard speaker="ground" t={t}>
        <p>{t(accepted < cubeSat.minimumBatches ? 'groundRequiredBatch' : 'groundExtraBatch', {
          batch: next + 1, accepted, minimum: cubeSat.minimumBatches,
        })}</p>
      </ReportCard>
      <div className="batch-record">
        <strong>{t('groundBatchId', { batch: next + 1 })}</strong>
        <span>{t(remaining === 0 ? 'groundLastBatch' : remaining === 1 ? 'groundRemainingOne' : 'groundRemaining', { count: remaining })}</span>
      </div>
      {accepted + remaining + 1 === cubeSat.minimumBatches && <p className="action-note">
        {t('groundArchiveShortfall')}
      </p>}
      <div className="action-row">
        <ActionButton onClick={() => send({ type: 'checkBatch', batch: next, deliver: true })}>{t('groundAccept')}</ActionButton>
        <button className="button secondary" onClick={() => send({ type: 'checkBatch', batch: next, deliver: false })}>{t('groundArchive')}</button>
      </div>
    </>
  }
  return <>
    {mission.contact && <ReportCard speaker="ground" t={t}><p>{t('reportFlight')}</p></ReportCard>}
    <Options legend="ground" value={choice} choose={setChoice} t={t} options={mission.ui.flightOptions(evidence, t)} />
    <ActionButton onClick={() => send({ type: mission.contact ? 'startContact' : 'fly', choice })}>{t('runFlight')}</ActionButton>
  </>
}

function Results({ game, mission, t, back }: Props) {
  const { flight, stop, evidence } = game
  const next = nextMission(game.missionId)
  const current = currentEvidence(game)
  const outcome = !flight ? mission.outcomes.stopped : flight.stretch ? mission.outcomes.extra
    : flight.delivered ? mission.outcomes.success : mission.outcomes.partial
  const stopCopy = { deadline: 'stopDeadline', funds: 'stopFunds', cancelled: 'stopCancelled' } as const
  const batches = (count: number) => t('dataBatches', { count })
  return <article className="manual">
    <Heading eyebrow={t('results')} title={t(outcome)}>{flight ? mission.ui.flightSummary(flight, t) : stop && t(stopCopy[stop])}</Heading>
    {flight?.delivered && next && missions[next.id] && <p className="notice" role="status">{t('nextUnlocked', { mission: t(next.title) })}</p>}
    <dl className="resource-line">
      <div><dt>{t('usedWeeks')}</dt><dd>{t('weeks', { count: game.week })}</dd></div>
      <div><dt>{t('spentCredits')}</dt><dd>{money(mission.budget - game.credits)}</dd></div>
    </dl>
    <section className="receipt" aria-label={t('results')}>
      <Disclosure label={t('estimate')} value={game.missionId === cubeSat.id ? batches(forecast(game.design as CubeSatDesign).batches) : undefined}>
        <mission.ui.Estimate design={game.design} t={t} />
      </Disclosure>
      {evidence ? <Disclosure label={t('report')} value={current && game.missionId === cubeSat.id
        ? t('testedData', { count: testedBatches(current as CubeSatEvidence) })
        : current ? t('checksPassed', { count: current.checks.filter(Boolean).length }) : t('noCurrentEvidence')}>
        <EvidenceReport mission={mission} evidence={evidence} t={t} outdated={!current} />
      </Disclosure> : <div className="receipt-line"><span>{t('report')}</span><small>{t('noEvidence')}</small></div>}
      {flight ? <Disclosure label={t('delivery')} value={game.missionId === cubeSat.id ? batches(flight.batches) : mission.ui.flightSummary(flight, t)}>
        <mission.ui.Delivery flight={flight} t={t} />
      </Disclosure> : <div className="receipt-line"><span>{t('delivery')}</span><small>{t('noFlight')}</small></div>}
    </section>
    <ActionButton onClick={back}>{t('home')}</ActionButton>
    <div className="references">
      <p>{t('gates', { gate: game.gate })}</p>
      {game.log.length > 0 && <Disclosure label={t('log')}><DecisionLog game={game} mission={mission} t={t} /></Disclosure>}
    </div>
  </article>
}

function Repair({ game, mission, t, send }: Controls) {
  const [choice, select] = useState<string | null>(null)
  const retest = mission.costs.integrate
  const repairs = repairOptions(game)
  const canFinish = (remedy: string) => availableWeeks(game) >= mission.costs[remedy].weeks + retest.weeks
    && game.credits >= mission.costs[remedy].credits + retest.credits
  return <>
    <Options legend="repairChoices" value={choice} choose={select} t={t} options={repairs.map(remedy => ({
      id: remedy,
      name: mission.costs[remedy].label,
      detail: `${t('weeks', { count: mission.costs[remedy].weeks })} · ${money(mission.costs[remedy].credits)}`,
      extra: <mission.ui.RemedyPreview design={game.design} remedy={remedy} t={t} />,
      disabled: !affordable(game, mission.costs[remedy]),
    }))} />
    <p className="action-note">{t('retestAdditional', { weeks: retest.weeks, credits: money(retest.credits) })}</p>
    {!repairs.some(canFinish) && <p className="notice">{t('noRepairTime')}</p>}
    <ActionButton disabled={!choice || !affordable(game, mission.costs[choice])}
      onClick={() => choice && send({ type: 'repair', remedy: choice })}>{t('selectCorrection')}</ActionButton>
  </>
}

function Reference({ game, mission, t, send }: Controls) {
  const editable = canConfigure(game)
  const estimate = game.missionId === cubeSat.id ? forecast(game.design as CubeSatDesign) : null
  const cost = baselineRemainingCost(game)
  const current = currentEvidence(game)
  const matching = game.analysis && sameDesign(game.analysis.design, game.design)
  const canEnd = game.stage !== 'flight' && (game.stage !== 'review' || game.returned)
  return <aside className="references" aria-label={t('missionInfo')}>
    {game.evidence && <Disclosure label={t('report')} value={current ? t('checksPassed', { count: current.checks.filter(Boolean).length }) : t('noCurrentEvidence')}>
      <EvidenceReport mission={mission} evidence={game.evidence} t={t} outdated={!current} />
    </Disclosure>}
    {editable && <Disclosure label={t('analysisAction')}>
      <button className="button secondary" disabled={Boolean(matching) || !affordable(game, mission.costs.analyze)}
        onClick={() => send({ type: 'analyze' })}>{t('analyze')} <CostLabel t={t} {...mission.costs.analyze} /></button>
    </Disclosure>}
    {game.analysis && <Disclosure label={t('analysisReport')}>
      {!matching && <p>{t('analysisOld')}</p>}
      <DesignSummary mission={mission} design={game.analysis.design} t={t} />
      <mission.ui.Forecast design={game.analysis.design} forecast={game.analysis.forecast} t={t} />
    </Disclosure>}
    <Disclosure label={t('details')}>
      <Disclosure label={t('configuration')}><DesignSummary mission={mission} design={game.design} t={t} /></Disclosure>
      <Disclosure label={t('estimate')}>
        <dl className="fact-list">
          {estimate && <div><dt>{t('estimatedDelivery')}</dt><dd>{t('dataBatches', { count: estimate.batches })}</dd></div>}
          {cost > 0 && <div><dt>{t('designCost')}</dt><dd>{money(cost)}</dd></div>}
        </dl>
        <mission.ui.Estimate design={game.design} t={t} />
      </Disclosure>
      <Disclosure label={t('briefTitle')}><mission.ui.Requirements t={t} /></Disclosure>
      <Disclosure label={t('process')} value={game.gate}>
        <ol className="stage-track">
          {stages.map(stage => <li key={stage} aria-current={stage === game.stage ? 'step' : undefined}>{t(stage)}</li>)}
        </ol>
      </Disclosure>
      {game.log.length > 0 && <Disclosure label={t('log')}><DecisionLog game={game} mission={mission} t={t} /></Disclosure>}
    </Disclosure>
    {canEnd && <Disclosure label={t('missionActions')}>
      <div className="action-row">
        <button className="text-button" onClick={() => send({ type: 'wait' })}>{t('wait')}</button>
        <button className="text-button" onClick={() => window.confirm(t('cancelPrompt')) && send({ type: 'cancel' })}>{t('cancel')}</button>
      </div>
    </Disclosure>}
  </aside>
}

function MissionEvent({ game, t, send }: Controls) {
  const event = pendingEvent(game)
  if (!event) return null
  return <section className="next-decision" aria-labelledby="mission-event">
    <h2 id="mission-event">{t(event.title)}</h2>
    <p>{t(event.detail)}</p>
    {event.choices.map(choice => <div className="repair-option" key={choice.id}>
      <div><strong>{t(choice.label)}</strong><small>{t(choice.detail)}</small></div>
      <button className="button secondary" onClick={() => send({ type: 'choose', choice: choice.id })}>{t('eventChoose')}</button>
    </div>)}
  </section>
}

function MissionWork({ game, mission, t, send }: Controls) {
  const work = currentWork(game)
  if (!work) return null
  const cost = workCost(game, work)
  return <div className="decisions">
    {canConfigure(game) && Object.entries(mission.groups).map(([key, group]) =>
      <Options key={key} legend={group.legend} options={optionList(group.options, t)} value={game.design[key]} t={t}
        choose={value => send({ type: 'configure', design: { ...game.design, [key]: value } })} />)}
    <ActionButton disabled={!affordable(game, cost)} onClick={() => send({ type: 'work' })}>
      {t(work === 'integrate' && game.evidence ? 'retest' : mission.costs[work].label)} <CostLabel t={t} {...cost} />
    </ActionButton>
  </div>
}

export function Single(props: Props) {
  const { game, mission, t, send, back } = props
  const isCubeSat = game.missionId === cubeSat.id
  if (game.stage === 'results' && !game.playback) return <Results {...props} />
  const checks = currentEvidence(game)
  const editable = canConfigure(game)
  const stage = game.playback?.kind === 'assembly' ? 'build' : game.playback?.kind ?? game.stage
  const latestAnalysis = editable && game.analysis && ['analysisClear', 'analysisConflict'].includes(game.log.at(-1)?.id ?? '')
    && sameDesign(game.analysis.design, game.design) ? game.analysis : null

  return <article className="single-mission">
    <Back t={t} onClick={back} />
    <Heading eyebrow={t(mission.title)} title={t(game.returned ? 'returned' : stage)}>
      {!isCubeSat && stage !== 'results' && t(game.returned ? 'returnedDetail' : mission.stageDetails[stage])}
    </Heading>
    <dl className="resource-line">
      <div><dt>{t('flightWindow')}</dt><dd>{t('weeks', { count: availableWeeks(game) })}</dd></div>
      <div><dt>{t('budgetLabel')}</dt><dd>{money(game.credits)}</dd></div>
    </dl>
    <div className="mission-layout">
      {isCubeSat && <Lab game={game as CubeSatGame} t={t} send={send} />}
      <div>
        {game.event && !game.playback && <MissionEvent {...props} />}
        {!game.event && !game.playback && <section className="next-decision decision-arrival" key={`${stage}:${game.returned}`}>
          {isCubeSat
            ? (stage === 'build' || stage === 'integration') && <BenchWork {...props} />
            : <MissionWork {...props} />}
          {isCubeSat && stage === 'review' && checks && (passes(checks)
            ? <ReportCard speaker="review" t={t}>
              <p>{t('reviewReady')}</p>
              {game.testFocus && <p>{t(game.testFocus === 'imaging' ? 'focusImagingReport' : 'focusRadioReport', {
                watts: scopeSegment(powerTimeline(checks.design as CubeSatDesign), game.testFocus).watts, available: checks.available, batches: checks.batches,
              })}</p>}
            </ReportCard>
            : <ReportCard speaker={!checks.powerPass ? 'power' : !checks.ditlPass ? 'comms' : 'science'} t={t} attention>
              <Findings evidence={checks as CubeSatEvidence} t={t} />
              {game.returned && <p>{t('labRepairChoice')}</p>}
            </ReportCard>)}
          {isCubeSat && editable && <CubeSatConfig {...props} />}
          {latestAnalysis && <p className={!mission.forecastClear(latestAnalysis.forecast) ? 'warning' : 'verified'} role="status">
            {t(!mission.forecastClear(latestAnalysis.forecast) ? 'analysisTradeoff' : 'analysisClear')}
          </p>}
          {game.returned && <Repair {...props} />}
          {stage === 'review' && !game.returned && <ActionButton onClick={() => send({ type: 'review' })}>{t('submitReview')}</ActionButton>}
          {stage === 'flight' && <Flight {...props} />}
        </section>}
        {!game.event && !game.playback && <Reference key={stage} {...props} />}
      </div>
    </div>
  </article>
}
