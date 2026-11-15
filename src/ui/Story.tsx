import { useLayoutEffect, useRef, useState } from 'react'
import type { Game } from '../game/types'
import type { Progress } from '../game/progress'
import type { Message, Translate } from '../i18n'
import { commissionMission, missionCatalog, missions } from '../missions'
import { commissions } from '../missions/cubesat-commission'
import { ActionButton, Back, DesignSummary, Disclosure, missionMoney } from './shared'
import { StudioAnimationButton, StudioBubble, StudioScene } from './StudioScene'

export const prologueKey = 'space-mission.prologue.v1'
const prologueBeats = [
  { speaker: 'comms', prop: 'data', control: 'warning', alert: true, line: 'prologueWarning' },
  { speaker: 'power', prop: 'contract', control: 'released', alert: true, line: 'prologueRelease' },
  { speaker: 'comms', prop: 'signal', launch: 'liftoff', line: 'prologueLiftoff' },
  { speaker: 'comms', prop: 'signal', control: 'lost', alert: true, line: 'prologueSignalLost', after: 'prologueInvestigation' },
  { speaker: 'power', prop: 'contract', line: 'prologueOffers' },
] as const

export const prologueLength = prologueBeats.length

export function Prologue({ step, next, back, t }: { step: number; next: () => void; back: () => void; t: Translate }) {
  const beat = prologueBeats[step]
  const present = step === prologueLength - 1
  const [paused, setPaused] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }) }, [step])
  return <article className="studio-brief">
    <header className="studio-top"><Back t={t} onClick={back} /><h1>{t('storyPrologue')}</h1></header>
    <div className="studio-workspace">
      <StudioScene missionId="cubesat" t={t} sequence={String(step)} speaker={beat.speaker} prop={beat.prop} paused={paused}
        control={'control' in beat ? beat.control : undefined} launch={'launch' in beat ? beat.launch : undefined}
        alert={'alert' in beat && beat.alert} animationControl={<StudioAnimationButton t={t} paused={paused} toggle={() => setPaused(value => !value)} />} />
      <section className="studio-handoff">
        <h2 ref={heading} tabIndex={-1}>{t(present ? 'prologuePresent' : 'prologuePast')}</h2>
        <StudioBubble t={t} speaker={beat.speaker} prop={beat.prop}><p>{t(beat.line)}</p></StudioBubble>
        {'after' in beat && <p>{t(beat.after)}</p>}
        <ActionButton onClick={next}>{t(present ? 'prologueReadOffers' : 'nextStep')}</ActionButton>
      </section>
    </div>
  </article>
}

const chapters = {
  cubesat: { title: 'storyFirstLight', opening: 'storyFirstOffer', complete: 'storyFirstComplete', short: 'storyFirstShort' },
  'orbital-launch': { title: 'storySecondAttempt', opening: 'storyOrbitalOffer', complete: 'storyOrbitalComplete', short: 'storyOrbitalShort' },
  'lunar-mission': { title: 'storyLunarContract', opening: 'storyLunarOffer', complete: 'storyLunarComplete', short: 'storyLunarShort' },
} as const

function chapterFor(id: string) {
  return chapters[id as keyof typeof chapters]
}

export function StoryBrief({ missionId, t }: { missionId: string; t: Translate }) {
  const chapter = chapterFor(missionId)
  if (!chapter) return null
  const first = missionId === 'cubesat'
  return <section className="story-panel" aria-label={t('missionStory')}>
    <h2>{t(chapter.title)}</h2>
    {first && <>
      <p>{t('storyPast')}</p>
      <Disclosure label={t('storyPrologue')}>
        <p>{t('storyBeforeLaunch')}</p>
        <p>{t('storyAfterLaunch')}</p>
      </Disclosure>
      <p><strong>Alex</strong> · {t('storyAlexFirst')}</p>
    </>}
    <p><strong>{first || missionId === 'lunar-mission' ? 'Samuel' : 'Alex'}</strong> · {t(chapter.opening)}</p>
    {first && <p><strong>Elena</strong> · {t('storyElenaFirst')}</p>}
    {missionId === 'orbital-launch' && <p><strong>Elena</strong> · {t('storyOrbitalArchive')}</p>}
  </section>
}

export function StoryDebrief({ game, t }: { game: Game; t: Translate }) {
  const chapter = chapterFor(game.missionId)
  if (!chapter) return null
  const lunar = game.missionId === 'lunar-mission'
  const result = game.flight?.delivered ? chapter.complete : game.flight ? chapter.short : 'storyHeldLaunch'
  return <section className="story-panel" aria-label={t('missionStory')}>
    <h2>{t(lunar ? 'storyEpilogue' : 'storyDebrief')}</h2>
    <p><strong>{game.flight?.delivered ? 'Samuel' : 'Elena'}</strong> · {t(result)}</p>
    {lunar && <p><strong>Alex</strong> · {t(game.flight?.delivered ? 'storyNewProposal' : 'storyReturnToLab')}</p>}
  </section>
}

const earnedLabels: Record<string, Message> = {
  'cubesat:partnerVerified': 'storyRecordLab',
  [commissions.river.southRecord]: commissions.river.southReward,
  [commissions.bay.southRecord]: commissions.bay.southReward,
  'orbital:onTime': 'storyRecordAdvance',
  'orbital:verified': 'storyRecordSupport',
  'orbital:provenMargin': 'storyRecordMargin',
  'lunar:returnedReserve': 'storyRecordReserve',
}

export function Portfolio({ progress, t, expanded }: { progress: Progress; t: Translate; expanded?: boolean }) {
  if (Object.keys(progress.missions).length === 0) return null
  return <Disclosure label={t('storyPortfolio')} open={expanded}>
    <p>{t('storyPortfolioDetail')}</p>
    {missionCatalog.map(({ id, title }) => {
      const record = progress.missions[id]
      const report = record?.report
      const mission = report?.commission ? commissionMission : missions[id]
      const earned = (record?.records ?? []).filter(item => Object.hasOwn(earnedLabels, item))
      const outcome = record?.stretch ? 'missionStretchDone' : record?.minimum ? 'missionMinimumDone'
        : report?.status === 'stopped' ? 'noFlight' : record ? 'storyRecordShort' : 'storyRecordPending'
      return <Disclosure key={id} label={t(title)} value={t(outcome)}>
        {report ? <>
          {report.commission && <p>{t(commissions[report.commission].name)}</p>}
          <dl className="fact-list">
            <div><dt>{t('usedWeeks')}</dt><dd>{t('weeks', { count: report.weeks })}</dd></div>
            <div><dt>{t('spentCredits')}</dt><dd>{missionMoney(mission, report.spent, t)}</dd></div>
            {report.status !== 'stopped' && <div><dt>{t('delivery')}</dt><dd>
              {t(id === 'orbital-launch' ? 'storyConfirmation' : 'dataBatches', { count: report.data })}
            </dd></div>}
            <div><dt>{t('report')}</dt><dd>{report.checks ? t('checksPassed', {
              count: report.checks.filter(Boolean).length, total: report.checks.length,
            }) : t('noEvidence')}</dd></div>
            {report.accepted > 0 && <div><dt>{t('storyAcceptedRisks')}</dt><dd>{report.accepted}</dd></div>}
          </dl>
          <Disclosure label={t('configuration')}><DesignSummary mission={mission} design={report.design} t={t} /></Disclosure>
        </> : record && <p>{t('storyOlderRecord')}</p>}
        {!record && <p>{t('storyRecordPending')}</p>}
        {earned.length > 0 && <ul>{earned.map(item => <li key={item}>{t(earnedLabels[item])}</li>)}</ul>}
      </Disclosure>
    })}
  </Disclosure>
}
