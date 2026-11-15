import { lazy, StrictMode, Suspense, useEffect, useMemo, useReducer, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, Orbit } from 'lucide-react'
import '@fontsource-variable/inter'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource/ibm-plex-mono/400.css'
import './style.css'
import './studio.css'

import spacecraft from './assets/cubesat-pixel.png'
import { type Game, type ScienceGoal, newGame } from './game/mission'
import { isTutorialStage, runStudioSession, studioTutorialStages, type StudioAction } from './game/studio-session'
import { readGame, readLocal, readStudioTutorial, rememberStudioTutorial, writeGame, writeLocal } from './game/storage'
import { languageKey, preferredLanguage, translator, type Language, type Translate } from './i18n'
import { carriedRecords, completeMission, isUnlocked, readProgress, reputation, writeProgress, type Progress } from './game/progress'
import { commissionMission, missionCatalog, missions } from './missions'
import type { CommissionId } from './missions/cubesat-commission'
import { Brief, clearDecisionDraft, Single } from './ui/Single'
import { StudioScene } from './ui/StudioScene'
import { Portfolio, Prologue, prologueKey, prologueLength } from './ui/Story'
import { ActionButton } from './ui/shared'
import { activeRoomKey, multiplayerAvailable } from './multiplayer/config'

const Team = lazy(() => import('./ui/Team'))

type Screen = 'lobby' | 'prologue' | 'brief' | 'single' | 'team'
type SessionAction = StudioAction | { type: 'new'; missionId: string; records: string[]; seed: number; scienceGoal?: ScienceGoal; commission?: CommissionId; tutorial?: Game['studioTutorial'] }

function session(game: Game | null, action: SessionAction) {
  if (action.type !== 'new') return game && runStudioSession(game, action)
  const next = newGame(action.missionId, action.records, action.seed, action.commission)
  return { ...next, ...(action.scienceGoal && { scienceGoal: action.scienceGoal }), ...(action.tutorial && { studioTutorial: action.tutorial }) }
}

function loadSession() {
  const game = readGame()
  if (!game?.commission || game.studioTutorial || !isTutorialStage(game.stage)
    || readProgress().missions[game.missionId]?.minimum) return game
  const earlier = studioTutorialStages.slice(0, studioTutorialStages.indexOf(game.stage))
  return { ...game, studioTutorial: [...new Set([...earlier, ...(readStudioTutorial() ?? [])])] }
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
}

// Add ?seed=123 to start that scenario from the mission brief.
function runSeed() {
  const requested = new URLSearchParams(window.location.search).get('seed')
  if (requested && /^\d{1,9}$/.test(requested)) return Number(requested)
  return randomSeed()
}

const difficulty = ['difficultyEasy', 'difficultyMedium', 'difficultyHard'] as const
const heroDetails = { cubesat: 'heroDetail', 'orbital-launch': 'heroOrbitalDetail', 'lunar-mission': 'heroLunarDetail' } as const

// The mission the lobby points at: the first unlocked one whose minimum goals are not met yet, or the last one.
function recommendedMission(progress: Progress) {
  return missionCatalog.find(item => missions[item.id] && isUnlocked(progress, item.id) && !progress.missions[item.id]?.minimum)
    ?? missionCatalog.at(-1)!
}

function Lobby({ t, game, progress, open, resume, team, firstStart }: {
  t: Translate; game: Game | null; progress: Progress; open: (missionId: string) => void; resume: () => void; team: () => void; firstStart: boolean
}) {
  const finished = game?.stage === 'results' && !game.playback
  const inProgress = game !== null && !finished
  const completed = missionCatalog.every(item => progress.missions[item.id]?.minimum)
  const featured = inProgress ? { id: game.missionId, title: missions[game.missionId].title } : recommendedMission(progress)
  const first = !inProgress && featured.id === missionCatalog[0].id && !progress.missions[featured.id]
  return <>
    <section className="lobby">
      <div className="lobby-copy">
        <h1>{completed ? t('heroCompleted') : first ? t('heroTitle') : t(inProgress ? 'heroContinue' : 'heroNext', { mission: t(featured.title) })}</h1>
        {!completed && <>
          <p className="lobby-intro">{t(heroDetails[featured.id as keyof typeof heroDetails] ?? 'heroDetail')}</p>
          <p className="lobby-duration">{t('duration', { minutes: missions[featured.id].playMinutes })} · {t('single')}</p>
        </>}
        <div className="action-row">
          {completed && <a className="button primary" href="#mission-portfolio">{t('storyPortfolio')}</a>}
          {(inProgress || !completed) && <ActionButton onClick={inProgress ? resume : () => open(featured.id)}>{t(inProgress ? 'continue' : firstStart ? 'startGame' : 'briefAction')}</ActionButton>}
          {finished && <button className="text-button" onClick={resume}>{t('previousResults')}</button>}
        </div>
      </div>
      {inProgress || !first ? <StudioScene missionId={featured.id} game={inProgress ? game : undefined} t={t} /> : <figure className="lobby-art">
        <img src={spacecraft} alt={t('lobbyArtAlt')} width={128} height={80} fetchPriority="high" />
        <figcaption>{t('lobbyArtCaption')}</figcaption>
      </figure>}
    </section>
    <section className="mission-cards" aria-labelledby="mission-list">
      <div className="mission-cards-head">
        <h2 id="mission-list">{t('missionList')}</h2>
        <p>{t('reputation')} · {reputation(progress)} <small>{t('reputationDetail')}</small></p>
      </div>
      <ol>
        {missionCatalog.map(({ id, title }, index) => {
          const record = progress.missions[id]
          const unlocked = Boolean(missions[id]) && isUnlocked(progress, id)
          return <li key={id} data-mission={id} className={unlocked ? 'mission-card' : 'mission-card locked'}>
            <StudioScene missionId={id} t={t} thumbnail />
            <small>{t(difficulty[index] ?? 'difficultyHard')}</small>
            <strong>{t(title)}</strong>
            <small>{t('duration', { minutes: missions[id]?.playMinutes ?? '?' })}</small>
            <small className={record?.minimum ? 'good' : undefined}>{!missions[id] ? t('planned')
              : record?.stretch ? t('missionStretchDone') : record?.minimum ? t('missionMinimumDone')
              : unlocked ? t('missionOpen') : t('unlockAfter', { mission: t(missionCatalog[index - 1].title) })}</small>
            {unlocked && <button className="button secondary" onClick={() => open(id)}>{t('openMission')}</button>}
          </li>
        })}
      </ol>
    </section>
    <div id="mission-portfolio"><Portfolio progress={progress} t={t} expanded={completed} /></div>
    {multiplayerAvailable && <div className="lobby-links">
      <button className="lobby-team" onClick={team}>
        <span>{t('multiplayer')}</span><small>{t('teamSize')}</small><ArrowRight size={17} aria-hidden />
      </button>
    </div>}
  </>
}

function App() {
  const [language, setLanguage] = useState<Language>(preferredLanguage)
  const [screen, setScreen] = useState<Screen>(() => multiplayerAvailable && readLocal(activeRoomKey) ? 'team' : 'lobby')
  const [game, dispatch] = useReducer(session, null, loadSession)
  const [progress, setProgress] = useState(readProgress)
  const [prologue, setPrologue] = useState(() => {
    const step = Number(readLocal(prologueKey))
    return Number.isInteger(step) && step >= 0 && step <= prologueLength ? step : 0
  })
  const [selected, setSelected] = useState(missionCatalog[0].id)
  const [saved, setSaved] = useState(true)
  const t = useMemo(() => translator(language), [language])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = t('app')
  }, [language, t])

  useEffect(() => {
    if (!game) return
    setSaved(writeGame(game))
    rememberStudioTutorial(game)
    if (!game.playback) setProgress(current => completeMission(current, game))
  }, [game])

  useEffect(() => { writeProgress(progress) }, [progress])

  useEffect(() => { window.scrollTo(0, 0) }, [screen, game?.stage, game?.returned, game?.event, game?.flightProgress?.turn])

  useEffect(() => {
    if (screen !== 'single' || document.activeElement !== document.body) return
    document.querySelector<HTMLElement>('.studio-handoff > h2, .studio-outcome h1')?.focus({ preventScroll: true })
  }, [screen, game])

  const firstStart = !game && !Object.keys(progress.missions).length && prologue < prologueLength
  function open(missionId: string) {
    setSelected(missionId)
    setScreen(firstStart && missionId === commissionMission.id ? 'prologue' : 'brief')
  }

  function advancePrologue() {
    const next = prologue + 1
    writeLocal(prologueKey, String(next))
    setPrologue(next)
    if (next === prologueLength) setScreen('brief')
  }

  function tutorialFor(missionId: string, commission?: CommissionId): Game['studioTutorial'] {
    if (!commission) return undefined
    return readStudioTutorial() ?? (game?.missionId === missionId ? game.studioTutorial : undefined)
      ?? (progress.missions[missionId]?.minimum ? undefined : [])
  }

  function begin(commission?: CommissionId) {
    clearDecisionDraft()
    dispatch({ type: 'new', missionId: selected, records: carriedRecords(progress), seed: runSeed(), commission,
      tutorial: tutorialFor(selected, commission) })
    setScreen('single')
  }

  function replay() {
    if (!game) return
    clearDecisionDraft()
    let seed = randomSeed()
    while (seed === game.seed) seed = randomSeed()
    dispatch({ type: 'new', missionId: game.missionId, records: game.records, scienceGoal: game.scienceGoal, commission: game.commission, seed,
      tutorial: tutorialFor(game.missionId, game.commission) })
    window.scrollTo(0, 0)
  }

  function back() {
    if (screen === 'team') writeLocal(activeRoomKey, null)
    setScreen('lobby')
  }

  function chooseLanguage(next: Language) {
    setLanguage(next)
    writeLocal(languageKey, next)
  }

  const languageControls = <div className="language">
    <button aria-pressed={language === 'en'} lang="en" onClick={() => chooseLanguage('en')}>EN</button>
    <button aria-pressed={language === 'zh-TW'} lang="zh-TW" onClick={() => chooseLanguage('zh-TW')}>繁中</button>
  </div>

  return <>
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={back} aria-label={t('lobby')}><Orbit size={25} aria-hidden /><span>{t('app')}</span></button>
        {languageControls}
      </div>
    </header>
    <main className="shell">
      {!saved && <p className="notice" role="status">{t('saveFailed')}</p>}
      {screen === 'lobby' && <Lobby t={t} game={game} progress={progress} open={open} resume={() => setScreen('single')} team={() => setScreen('team')} firstStart={firstStart} />}
      {screen === 'prologue' && <Prologue step={prologue} next={advancePrologue} back={back} t={t} />}
      {screen === 'brief' && <Brief key={selected} mission={selected === commissionMission.id ? commissionMission : missions[selected]} t={t} saved={Boolean(game)} back={back} begin={begin} />}
      {screen === 'single' && game && <Single game={game} mission={game.commission ? commissionMission : missions[game.missionId]} progress={progress} send={dispatch} back={back} replay={replay} open={open} t={t} languageControls={languageControls} />}
      {screen === 'team' && <Suspense fallback={<p role="status">{t('roomConnecting')}</p>}><Team t={t} back={back} /></Suspense>}
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
