import { Check, CircleAlert } from 'lucide-react'
import type { Translate } from '../i18n'
import type { MissionUi } from '.'
import { Disclosure } from '../ui/shared'
import { applyRemedy, cubeSat, planContact, testDesign, type CubeSatDesign, type CubeSatEvidence, type Remedy } from './cubesat'

type TestResult = ReturnType<typeof testDesign>
type PowerValues = Pick<TestResult, 'payloadWatts' | 'peak' | 'available'>

export function PowerBreakdown({ design, t, result = testDesign(design) }: { design: CubeSatDesign; t: Translate; result?: PowerValues }) {
  return <>
    <dl className="fact-list">
      <div><dt>{t('bus')}</dt><dd>{cubeSat.busWatts} W</dd></div>
      <div><dt>{t(cubeSat.payloads[design.payload].label)}</dt><dd>{result.payloadWatts} W</dd></div>
      <div><dt>{t('downlinkRadio')}</dt><dd>{cubeSat.downlinkWatts} W</dd></div>
      <div><dt>{t('powerDemand')}</dt><dd>{result.peak} W</dd></div>
      <div><dt>{t(cubeSat.supplies[design.supply].label)}</dt><dd>{result.available} W</dd></div>
    </dl>
    <p>{t(design.schedule === 'overlap' ? 'powerConcurrent' : 'powerSequential')}</p>
  </>
}

function Status({ pass, t }: { pass: boolean; t: Translate }) {
  const Icon = pass ? Check : CircleAlert
  return <span className={`status ${pass ? 'good' : 'bad'}`}><Icon size={15} aria-hidden />{t(pass ? 'pass' : 'fail')}</span>
}

export function powerFinding(result: TestResult, t: Translate) {
  return t(result.design.schedule === 'overlap' ? 'powerConflict' : 'powerInsufficient', { peak: result.peak, available: result.available })
}

export function testedBatches(evidence: TestResult) {
  return evidence.testedBatches ?? (evidence.powerPass ? evidence.batches : 0)
}

export function Findings({ evidence, t }: { evidence: TestResult; t: Translate }) {
  return <ul className="findings">
    {!evidence.powerPass && <li>{powerFinding(evidence, t)}</li>}
    {!evidence.ditlPass && <li>{t('earlyTransmission', evidence.ditl)}</li>}
    {evidence.powerPass && !evidence.dataPass && <li>{t('dataShortfall', { count: testedBatches(evidence), minimum: cubeSat.minimumBatches })}</li>}
  </ul>
}

function Report({ evidence, t }: { evidence: TestResult; t: Translate }) {
  const { ditl } = evidence
  return <>
    <Disclosure label={t('powerCheck')} value={<Status pass={evidence.powerPass} t={t} />}>
      <PowerBreakdown design={evidence.design} result={evidence} t={t} />
    </Disclosure>
    <div className="check row">
      <span>{t('dataCheck')}<small>{t('dataThreshold', { count: testedBatches(evidence), minimum: cubeSat.minimumBatches })}</small></span>
      <Status pass={evidence.dataPass} t={t} />
    </div>
    <Disclosure label={t('ditl')} value={<Status pass={evidence.ditlPass} t={t} />}>
      <dl className="fact-list">
        <div><dt>{t('separation')}</dt><dd>{t('timestamp', { count: ditl.separation })}</dd></div>
        <div><dt>{t('deployment')}</dt><dd>{t('timestamp', { count: ditl.deploy })}</dd></div>
        <div><dt>{t('firstTx')}</dt><dd>{t('timestamp', { count: ditl.firstTx })}</dd></div>
      </dl>
      <p>{t('ditlRule', ditl)}</p>
      <a href={cubeSat.ditl.url} target="_blank" rel="noreferrer">{cubeSat.ditl.source} ↗</a>
    </Disclosure>
  </>
}

export function RemedyPreview({ design, remedy, t }: { design: CubeSatDesign; remedy: Remedy; t: Translate }) {
  const result = testDesign(applyRemedy(design, remedy))
  return <small>{remedy === 'compliant'
    ? `${t('firstTx')} ${t('timestamp', { count: result.ditl.firstTx })}`
    : `${t('powerUse', { peak: result.peak, available: result.available })} · ${t('dataBatches', { count: result.batches })}`}</small>
}

function Requirements({ t }: { t: Translate }) {
  return <ul className="requirements">
    <li>{t('briefMinimum', { count: cubeSat.minimumBatches, orbits: cubeSat.missionOrbits })}</li>
    <li>{t('briefExtra', { count: cubeSat.stretchBatches })}</li>
    <li>{t('briefIcd', { count: cubeSat.ditl.minQuietMinutes })}</li>
  </ul>
}

export const cubeSatUi: MissionUi = {
  Requirements,
  Estimate: ({ design, t }) => <PowerBreakdown design={design as CubeSatDesign} t={t} />,
  Forecast: ({ design, forecast, t }) => <PowerBreakdown design={design as CubeSatDesign} result={forecast as PowerValues} t={t} />,
  Report: ({ evidence, t }) => <Report evidence={evidence as TestResult} t={t} />,
  RemedyPreview: ({ design, remedy, t }) => <RemedyPreview design={design as CubeSatDesign} remedy={remedy as Remedy} t={t} />,
  Delivery: ({ flight, t }) => <>
    <p>{t('firstTx')} · {t('timestamp', { count: flight.firstTx })}</p>
    {Boolean(flight.diagnostics) && <p>{t('flightDiagnosticsSent')}</p>}
    {Boolean(flight.archived) && <p>{t('groundArchivedResult', { count: flight.archived })}</p>}
  </>,
  flightOptions: (evidence, t) => {
    const extra = planContact(evidence as CubeSatEvidence, 'extra')
    const diagnostics = planContact(evidence as CubeSatEvidence, 'diagnostics')
    return [
      { id: 'priority', name: 'flightPriority', detail: t('flightPriorityDetail', { count: cubeSat.minimumBatches }) },
      { id: 'extra', name: 'flightExtra', detail: t('flightExtraDetail', { count: extra.batches }) },
      { id: 'diagnostics', name: 'flightDiagnostics', detail: t('flightContactDiagnostics', { slots: diagnostics.diagnostics, count: diagnostics.batches }) },
    ]
  },
  flightSummary: (flight, t) => t('flightBatches', { count: flight.batches }),
}
