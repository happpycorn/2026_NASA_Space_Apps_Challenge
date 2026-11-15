import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { studioLaunchDuration, type StudioAction } from '../game/studio-session'
import type { Game, Stage } from '../game/types'
import type { Message, Translate } from '../i18n'
import { ActionButton } from './shared'
import { StudioAnimationButton, StudioScene } from './StudioScene'

const tutorialText: Partial<Record<Stage, Message>> = {
  feasibility: 'studioTutorialFeasibility', design: 'studioTutorialDesign', build: 'studioTutorialBuild',
  integration: 'studioTutorialTest', review: 'studioTutorialReview',
}

export function studioTutorialMessage(stage: Stage) {
  return tutorialText[stage]
}

export function TutorialNote({ t, message, id }: { t: Translate; message: Message; id?: string }) {
  return <div id={id} className="studio-tutorial-note">
    <strong>{t('studioTutorialLabel')}</strong>
    <p>{t(message)}</p>
  </div>
}

export function TutorialTarget({ message, complete, t, children }: {
  message?: Message; complete?: () => void; t: Translate; children: ReactNode
}) {
  const target = useRef<HTMLDivElement>(null)
  const id = useId()
  useLayoutEffect(() => {
    if (!message) return
    const button = target.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    if (!button) return
    const previous = button.getAttribute('aria-describedby')
    button.setAttribute('aria-describedby', previous ? previous + ' ' + id : id)
    button.focus({ preventScroll: true })
    const reveal = window.requestAnimationFrame(() => target.current?.scrollIntoView({ block: 'nearest' }))
    return () => {
      window.cancelAnimationFrame(reveal)
      if (previous) button.setAttribute('aria-describedby', previous)
      else button.removeAttribute('aria-describedby')
    }
  }, [id, message])

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (message && event.target instanceof Element && event.target.closest('button') === target.current?.querySelector('button:not(:disabled)')) complete?.()
  }

  return <div className={message ? 'studio-tutorial-target' : 'studio-next'} ref={target} onClickCapture={onClick}>
    {message && <TutorialNote id={id} message={message} t={t} />}
    {children}
  </div>
}

export function StudioLaunch({ game, startedAt, t, paused, toggle, send }: {
  game: Game; startedAt: number; t: Translate; paused: boolean; toggle: () => void; send: (action: StudioAction) => void
}) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt)
  const finish = () => send({ type: 'finishStudioLaunch', startedAt })
  useEffect(() => {
    const end = startedAt + studioLaunchDuration
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 100)
    const complete = window.setTimeout(() => send({ type: 'finishStudioLaunch', startedAt }), Math.max(0, end - Date.now()))
    return () => { window.clearInterval(timer); window.clearTimeout(complete) }
  }, [send, startedAt])
  const phase = elapsed < 3000 ? 'countdown' : elapsed < 3800 ? 'ignition' : 'liftoff'
  const label = phase === 'countdown' ? t('studioCountdown', { count: Math.min(3, Math.ceil((3000 - elapsed) / 1000)) })
    : t(phase === 'ignition' ? 'studioIgnition' : 'studioLiftoff')

  return <div className="studio-workspace" data-launch-phase={phase}>
    <StudioScene missionId={game.missionId} game={game} t={t} launch={phase} paused={paused} animationControl={
      <StudioAnimationButton t={t} paused={paused} toggle={toggle} />
    } />
    <section className="studio-handoff" aria-label={t('studioLaunchPad')}>
      <h2 role="status">{label}</h2>
      <ActionButton className="button secondary" onClick={finish}>{t(game.commission ? 'studioSkipLaunch' : 'studioSkipAscent')}</ActionButton>
    </section>
  </div>
}
