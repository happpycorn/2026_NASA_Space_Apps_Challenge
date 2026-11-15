import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { currentEvidence, currentFlightSegment, passes } from '../game/mission'
import type { Game } from '../game/types'
import type { Message, Translate } from '../i18n'
import { completed } from '../missions/chapter'
import { departments } from '../missions/cubesat'
import { capabilityFor } from '../missions/cubesat-commission'
import { orbitalBestMargin, type OrbitalDesign } from '../missions/orbital-launch'
import { orbitalState } from '../missions/orbital-rules'
import { drawLab } from './labArt'
import { crew, painter, sprite, type Prop } from './pixelKit'
import { drawMeetingDisplay, drawStudio, type LaunchPhase, type MeetingDisplay, type MeetingPreview, type Scene, type StudioArt } from './studioArt'

export const motionQuery = '(prefers-reduced-motion: reduce)'
export const arrivalTime = 950
export type Speaker = 'science' | 'power' | 'comms'
type Mood = NonNullable<StudioArt['result']>

export const speakerNames = { science: 'Samuel', power: 'Alex', comms: 'Elena' } as const
export const speakerRoles = { science: 'studioScience', power: 'studioEngineering', comms: 'studioComms' } as const

export function StudioAnimationButton({ paused, toggle, t }: { paused: boolean; toggle: () => void; t: Translate }) {
  return <button type="button" aria-pressed={paused} onClick={toggle} className="studio-animation">{t(paused ? 'studioPlay' : 'studioPause')}</button>
}

export function Portrait({ speaker, prop }: { speaker: Speaker; prop: Prop }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 42, 37)
    crew(painter(ctx), speaker, 15, 38, 'report', 0, prop)
  }, [speaker, prop])
  return <canvas className="studio-portrait" width={42} height={37} aria-hidden="true" ref={ref} />
}

export function StudioBubble({ speaker, prop, children, t }: { speaker: Speaker; prop: Prop; children: ReactNode; t: Translate }) {
  return <div className="studio-bubble" data-speaker={speaker}>
    <Portrait speaker={speaker} prop={prop} />
    <div><strong>{speakerNames[speaker]} <span className="visually-hidden">· {t(speakerRoles[speaker])}</span></strong>{children}</div>
  </div>
}

export type Illustration = Prop | { prop: Prop; extra: Prop; side?: 'north' | 'south'; speaker?: Speaker }

export function OptionArt({ art }: { art: Illustration }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const prop = typeof art === 'string' ? art : art.prop
  const extra = typeof art === 'string' ? undefined : art.extra
  const side = typeof art === 'string' ? undefined : art.side
  const speaker = typeof art === 'string' ? undefined : art.speaker
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const r = painter(ctx)
    r('#223a50', 0, 0, 86, 42)
    for (const x of [2, 10, 18, 26, 34, 42, 50, 58, 66, 74, 82]) {
      for (const y of [2, 10, 18, 26, 34]) r('#365168', x, y, 1, 1)
    }
    r('#446073', 0, 33, 86, 1)
    sprite(r, prop, extra ? 15 : 25, 3, 1.5)
    if (extra) sprite(r, extra, 49, 11, 1.05)
    if (side) {
      const y = side === 'north' ? 11 : 26
      r('#182f45', 47, y - 2, 10, 8)
      r('#f5c279', 49, y, 6, 4)
    }
    if (speaker) crew(r, speaker, 60, 37, 'report', 0, 'wrench')
  }, [prop, extra, side, speaker])
  return <canvas className="option-art" width={86} height={42} ref={ref} aria-hidden="true" />
}

const locations = {
  lab: 'labTitle', orbit: 'labOrbit', hangar: 'studioHangar', ascent: 'studioAscent', orbitalPass: 'studioOrbitalPass',
  control: 'studioControl', transfer: 'studioTransfer', descent: 'studioDescent', surface: 'studioSurface', night: 'studioNight',
  launchControl: 'studioControl', pad: 'studioLaunchPad', meeting: 'studioMeetingRoom',
  lunarWorkshop: 'studioLunarWorkshop',
} satisfies Record<Scene | 'lab' | 'orbit', Message>

const lunarLocations: Record<string, Scene> = { launch: 'control', checkout: 'transfer', transfer: 'transfer', orbit: 'transfer',
  descent: 'descent', surface: 'surface', night: 'night' }

function sceneFor(missionId: string, segment?: string): Scene | 'lab' | 'orbit' {
  if (missionId === 'cubesat') return segment ? 'orbit' : 'lab'
  if (missionId === 'orbital-launch') return segment === 'ascent' ? 'ascent' : segment ? 'orbitalPass' : 'hangar'
  return lunarLocations[segment ?? ''] ?? 'lunarWorkshop'
}

export function sceneModel(missionId: string, game?: Game, briefing = false, result?: Mood) {
  const segment = game && (currentFlightSegment(game)?.id ?? game.flight?.interruptedAt
    ?? game.flight?.segments?.at(-1)?.id ?? (game.flight ? 'pass' : undefined))
  const scene = sceneFor(missionId, segment)
  const design = game?.design
  const built = game && ['integration', 'review', 'flight'].includes(game.stage)
  const evidence = game && currentEvidence(game)
  const entries = game?.log ?? []
  const latest = entries.at(-1)
  const kit = game?.commission && capabilityFor(game.design)
  const finding = latest?.detail?.message === 'commissionScreenFound'
  const warning = Boolean(result === 'short' || result === 'stopped' || game?.returned
    || (evidence && !passes(evidence)) || finding || (game?.event && /^(found|budgetCut)/.test(game.event))
    || (game && missionId === 'orbital-launch' && game.stage !== 'flight'
      && orbitalBestMargin(game.seed, game.design as OrbitalDesign, orbitalState(game)) < 0))
  const step = result ? 'result' : briefing ? 'map' : scene === 'orbit' ? segment ?? 'pass' : missionId === 'cubesat'
    ? game?.stage === 'integration' ? 'test' : game?.stage === 'review' ? 'checked' : game?.stage === 'build' || game?.stage === 'design' ? 'parts' : 'map'
    : segment ?? game?.stage ?? 'brief'
  return {
    scene, step, warning,
    bay: game?.commission === 'bay',
    built: Boolean(built || (game && (completed(game, 'build') || completed(game, 'buildStage') || completed(game, 'buildFlight')))),
    tested: Boolean(evidence),
    auxiliary: Boolean(kit && kit.backup),
    pointing: Boolean(kit && kit.pointing),
    adjusted: entries.some(entry => entry.id === 'correctLate' || entry.id === 'correctEarly'),
    removed: !kit || !kit.backup ? entries.some(entry => entry.id === 'strip') : false,
    received: Number(game?.flight?.batches ?? game?.flight?.confirmation ?? game?.flightProgress?.state.batches ?? 0),
    highMargin: design?.stage === 'highMargin',
    dual: design?.ground === 'dual',
    advanced: ['advanced', 'diagnostics'].includes(design?.payload ?? design?.telemetry ?? ''),
    extended: design?.power === 'extended',
    alternate: design?.route === 'lowEnergy' || design?.orbit === 'sso',
    lightweight: design?.adapter === 'lightweight' || design?.mount === 'lightweight',
  }
}

const emptyScene = sceneModel('cubesat')

export function StudioScene({ missionId, game, t, sequence, speaker, prop, brief, bay, result, thumbnail = false, paused = false, alert = false,
  animationControl, meeting = false, meetingPreview, control, launch }: {
  missionId: string; game?: Game; t: Translate; sequence?: string; speaker?: Speaker; prop?: Prop; brief?: boolean;
  bay?: boolean; result?: Mood; thumbnail?: boolean; paused?: boolean; alert?: boolean; animationControl?: ReactNode
  meeting?: boolean; meetingPreview?: MeetingPreview; control?: 'warning' | 'released' | 'lost' | 'first-signal' | 'lunar-checkout'; launch?: LaunchPhase
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const meetingDisplay = useRef<MeetingDisplay | undefined>(undefined)
  const paintedScene = useRef<string | undefined>(undefined)
  const model = sceneModel(missionId, game, brief, result)
  const scene = launch ? 'pad' : control ? 'launchControl' : meeting ? 'meeting' : model.scene
  const { built, tested, auxiliary, pointing, adjusted, removed, highMargin, dual, advanced, extended, alternate, lightweight, received }
    = scene === 'meeting' ? emptyScene : model
  const step = launch ?? control ?? (meeting ? 'meeting' : model.step)
  const map = (bay ?? model.bay) ? 'bay' : 'river'
  const warning = model.warning || alert
  const sceneWarning = scene !== 'meeting' && warning
  const work = game?.studioWork
  const lunar = missionId === 'lunar-mission'
  const payloadReady = Boolean(game && completed(game, 'buildPayload'))
  const groundReady = Boolean(game && completed(game, 'buildGround'))
  const avionicsReady = Boolean(game && completed(game, 'buildAvionics'))
  const [motion, setMotion] = useState(() => !window.matchMedia(motionQuery).matches)
  useLayoutEffect(() => {
    if (scene !== 'meeting') return
    const display = { preview: meetingPreview, commissionMap: game?.commission, lunar,
      alternate: model.alternate, advanced: model.advanced, warning }
    meetingDisplay.current = display
    const ctx = canvas.current?.getContext('2d')
    // Paint the monitor even when scene animation is stopped.
    if (ctx && paintedScene.current === 'meeting') drawMeetingDisplay(ctx, display)
  }, [scene, meetingPreview, game?.commission, lunar, model.alternate, model.advanced, warning])
  useEffect(() => {
    const query = window.matchMedia(motionQuery)
    const change = () => setMotion(!query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const animate = motion && !thumbnail && !paused && !result
    const started = performance.now()
    const paint = () => {
      paintedScene.current = scene
      const elapsed = performance.now() - started
      const frame = animate ? Math.floor(elapsed / 130) : 0
      const progress = work ? animate ? Math.min(1, Math.max(0, (Date.now() - work.startedAt) / (work.endsAt - work.startedAt))) : .65 : 0
      const activity = work && speaker ? { speaker, progress, task: work.task.replace(/^(support|lab):/, '') } : undefined
      const assembling = work?.task === 'build'
      const arrival = animate ? Math.min(1, elapsed / 650) : 1
      if (scene === 'lab' || scene === 'orbit') {
        drawLab(ctx, {
          active: step === 'map' ? ['science', 'comms'] : ['science', 'power', 'comms'],
          installed: assembling ? departments.slice(0, Math.floor(progress * 4)) : built || scene === 'orbit' ? departments : [],
          assemblyStep: step === 'parts' ? 0 : built ? 2 : -1,
          warning: sceneWarning, orbit: scene === 'orbit', receiving: scene === 'orbit' && !sceneWarning, received, auxiliaryLens: auxiliary,
          studio: { step, map, reporter: speaker, prop, arrival, pointing, removed, repaired: adjusted, work: activity, result },
        }, frame)
      } else {
        drawStudio(ctx, { scene, stage: step, reporter: speaker, prop, assembled: built || (thumbnail && scene === 'hangar'),
          highMargin, dual, advanced, extended, alternate, lightweight, tested, warning: sceneWarning, received, result, work: activity,
          lunar, payloadReady, groundReady, avionicsReady,
          launch: launch && { phase: launch, progress: animate ? Math.min(1, elapsed / 1700) : .55 },
          meetingDisplay: meetingDisplay.current }, frame, arrival)
      }
    }
    paint()
    if (!animate) return
    const timer = window.setInterval(paint, 95)
    return () => window.clearInterval(timer)
  }, [motion, paused, sequence, scene, step, sceneWarning, built, tested, auxiliary, pointing, adjusted, removed, highMargin, dual,
    advanced, extended, alternate, lightweight, map, received, speaker, prop, result, thumbnail, work, launch,
    lunar, payloadReady, groundReady, avionicsReady])

  const label = t(locations[scene])
  return <figure className={`studio-scene${thumbnail ? ' studio-thumbnail' : ''}`} data-scene={scene} data-visual-step={step}
    data-reporter={speaker} data-warning={warning} data-auxiliary={model.auxiliary} data-result={result}
    data-preview-group={meetingPreview?.group} data-preview-option={meetingPreview?.option} aria-label={thumbnail ? undefined : label}>
    <canvas width={320} height={140} ref={canvas} aria-hidden="true" />
    {!thumbnail && <figcaption><span>{label}{warning && !result && <span className="scene-warning">{t('studioWarning')}</span>}</span>{animationControl}</figcaption>}
  </figure>
}

export function stoppedStage(game: Game): Exclude<Game['stage'], 'results'> {
  if (game.gate === 'FRR' || game.log.at(-1)?.review?.gate === 'FRR' || currentEvidence(game)) return 'review'
  if (game.log.some(entry => entry.id.replace(/^support:/, '') === 'freeze' && !entry.incomplete)) {
    const building = game.missionId === 'orbital-launch' ? ['buildStage', 'buildAvionics']
      : game.missionId === 'lunar-mission' ? ['buildFlight', 'buildPayload', 'buildGround'] : ['build']
    return building.every(id => completed(game, id) || completed(game, 'support:' + id)) ? 'integration' : 'build'
  }
  return game.gate === 'MDR' ? 'feasibility' : 'design'
}
