import { aisleDepth, crew, drawCrew, map, moveToStation, painter, receiver, sprite, type CrewSprite, type Prop, type Rect, type WorkSprite } from './pixelKit'
import { lunarMission } from '../missions/lunar-mission'
import { orbitalLaunch } from '../missions/orbital-launch'

const ink = '#152940'
const navy = '#223d56'
const slate = '#3a596c'
const steel = '#799798'
const cream = '#e6e5cb'
const mint = '#9dd4bd'
const amber = '#f1bc72'
const fault = '#e58761'

export type Scene = 'hangar' | 'lunarWorkshop' | 'ascent' | 'orbitalPass' | 'control' | 'launchControl' | 'pad' | 'meeting' | 'transfer' | 'descent' | 'surface' | 'night'
export type LaunchPhase = 'countdown' | 'ignition' | 'liftoff'
export type MeetingPreview = { group: string; option: string; prop: Prop; extra?: Prop }
export type MeetingDisplay = {
  preview?: MeetingPreview
  commissionMap?: 'river' | 'bay'
  lunar?: boolean
  alternate?: boolean
  advanced?: boolean
  warning?: boolean
}

export const meetingDisplayBounds = { x: 84, y: 18, width: 154, height: 51 }

export type StudioArt = {
  scene: Scene
  stage: string
  reporter?: 'science' | 'power' | 'comms'
  prop?: Prop
  assembled?: boolean
  highMargin?: boolean
  dual?: boolean
  advanced?: boolean
  extended?: boolean
  alternate?: boolean
  lightweight?: boolean
  tested?: boolean
  warning?: boolean
  received?: number
  lunar?: boolean
  payloadReady?: boolean
  groundReady?: boolean
  avionicsReady?: boolean
  work?: WorkSprite & { task: string }
  launch?: { phase: LaunchPhase; progress: number }
  meetingDisplay?: MeetingDisplay
  result?: 'delivered' | 'short' | 'stopped'
}

function stars(r: Rect, width: number, height: number, x = 0, y = 0) {
  r('#122238', x, y, width, height)
  for (let i = 0; i < Math.floor(width / 6); i += 1) {
    r(i % 4 ? '#536c7d' : cream, x + (i * 53 + 13) % width, y + (i * 23 + 7) % height, i % 4 ? 1 : 2, 1)
  }
}

function console(r: Rect, x: number, y: number, width: number, frame: number, warning: boolean) {
  r(ink, x, y, width, 28)
  r(slate, x + 2, y + 2, width - 4, 23)
  r('#142e44', x + 5, y + 5, width - 10, 16)
  r('#345768', x + 7, y + 15, width - 14, 1)
  for (let i = 0; i < width - 15; i += 3) {
    r(warning ? fault : mint, x + 7 + i, y + 15 - [0, 0, 2, 6, 3, 0, 0, 1][(i / 3 + frame) % 8], 3, 1)
  }
  r(steel, x + width / 2 - 2, y + 28, 4, 7)
}

function ground(r: Rect, dark: boolean) {
  r('#243b4c', 0, 102, 320, 38)
  r(dark ? '#344657' : '#566965', 0, 104, 320, 36)
  for (const y of [111, 125, 138]) r('#263c4b', 0, y, 320, 1)
  for (const x of [28, 90, 159, 229, 300]) {
    for (let j = 0; j < 4; j += 1) r('#364e55', x + Math.trunc((x - 160) * j / 26), 104 + j * 9, 1, 9)
  }
}

function workshopCrew(r: Rect, art: StudioArt, frame: number, arrival: number) {
  const stations = [{ id: 'science', x: 58, prop: 'data' }, { id: 'power', x: 125, prop: 'wrench' },
    { id: 'comms', x: 257, prop: 'signal' }] as const
  drawCrew(r, stations.map(({ id, x, prop }): CrewSprite => {
    const reportX = 192
    const station: CrewSprite = { id, x, base: 124, pose: art.work ? 'idle' : 'work', prop }
    if (art.work?.speaker === id) return moveToStation({ ...station, prop: art.prop ?? prop }, art.work, reportX, x, 124)
    const forward = !art.work && art.reporter === id ? arrival : 0
    return forward ? { id, x: x + (reportX - x) * forward, base: aisleDepth(124, 1 - forward),
      pose: forward === 1 ? 'report' : 'walk', prop: art.prop ?? prop } : station
  }), frame)
}

function rocket(r: Rect, x: number, y: number, highMargin = false, exhaust = 0) {
  r(ink, x - 2, y + 14, 29, 72)
  r(cream, x + 9, y, 8, 6)
  r(cream, x + 5, y + 6, 16, 8)
  r(cream, x + 1, y + 14, 25, 64)
  r(steel, x + 19, y + 13, 7, 65)
  r(navy, x, y + 21, 27, 4)
  r(highMargin ? amber : mint, x + 1, y + 28, 24, highMargin ? 13 : 7)
  r(navy, x, y + 46, 27, 3)
  r(cream, x - 5, y + 64, 5, 15)
  r(steel, x + 26, y + 64, 5, 15)
  r(ink, x + 3, y + 80, 21, 5)
  if (exhaust > 0) {
    r(fault, x + 4, y + 85, 19, exhaust)
    r(amber, x + 8, y + 85, 11, exhaust + 5)
    r(cream, x + 11, y + 85, 5, Math.floor(exhaust * .65))
  }
}

function launchPad(r: Rect, art: StudioArt, frame: number) {
  const launch = art.launch!
  stars(r, 320, 140)
  r('#314e65', 0, 79, 320, 27)
  for (const [x, y, w] of [[0, 87, 93], [25, 80, 34], [212, 90, 108], [264, 83, 42]]) r('#415f70', x, y, w, 22)
  ground(r, true)
  r(ink, 108, 99, 96, 10)
  r(steel, 107, 97, 98, 3)
  for (const x of [115, 120]) r(slate, x, 20, 3, 77)
  for (const y of [29, 45, 61, 77, 93]) r(steel, 115, y, 10, 2)
  r(slate, 121, 42, launch.phase === 'countdown' ? 25 : 8, 3)
  const lift = launch.phase === 'liftoff' ? 92 * launch.progress ** 1.6 : 0
  rocket(r, 147, 12 - lift, art.highMargin, launch.phase === 'countdown' ? 0 : 13 + frame % 4)
  if (art.lunar) {
    r(ink, 221, 53, 43, 30)
    r(navy, 224, 56, 37, 24)
    sprite(r, 'moon', 232, 56, .95)
  }
  if (launch.phase !== 'countdown') {
    const spread = launch.phase === 'liftoff' ? 15 + launch.progress * 45 : 5 + frame % 8
    for (let i = 0; i < 7; i++) {
      const x = 155 + (i - 3) * spread / 2
      r(i % 2 ? steel : '#809395', x, 101 + i % 3 * 4, 13 + spread / 3, 4)
    }
  }
}

function hangar(r: Rect, art: StudioArt, frame: number, arrival: number) {
  const showsWork = (task: string) => art.work?.task === task && art.work.progress >= .62
  r('#314c5c', 0, 0, 320, 140)
  r('#416275', 17, 13, 286, 83)
  r(navy, 100, 21, 117, 79)
  for (const x of [5, 18, 98, 218, 301, 313]) {
    r(ink, x, 0, 5, 105)
    r(steel, x + 1, 4, 1, 98)
  }
  r(ink, 0, 9, 320, 5)
  r(cream, 110, 12, 101, 3)
  r('#607f83', 110, 16, 101, 2)
  for (const x of [30, 244]) {
    r(navy, x, 24, 48, 25)
    r('#556e74', x + 2, 26, 44, 21)
    for (let i = 4; i < 42; i += 5) r(steel, x + i, 28, 1, 16)
  }
  ground(r, false)
  for (let x = 98; x < 218; x += 8) {
    r(x % 16 === 2 ? amber : ink, x, 101, 8, 4)
    r(x % 16 === 2 ? amber : ink, x, 126, 8, 3)
  }
  for (const x of [106, 199]) {
    r(steel, x, 29, 3, 74)
    r(slate, x + 4, 29, 3, 74)
    for (const y of [35, 53, 71, 89]) r(steel, x, y, 8, 2)
  }
  r(ink, 114, 92, 84, 11)
  r(steel, 114, 91, 84, 3)
  if (art.lunar) {
    const lander = art.assembled || showsWork('buildFlight')
    sprite(r, lander ? 'lander' : 'box', lander ? 136 : 144, lander ? 45 : 64, lander ? 1.95 : 1.2)
    sprite(r, art.payloadReady || showsWork('buildPayload') ? art.advanced ? 'twoCameras' : 'camera' : 'data', 96, 73, .85)
    if (lander && art.extended) sprite(r, 'battery', 181, 65, .8)
  } else if (art.assembled || showsWork('buildStage')) rocket(r, 141, 9, art.highMargin)
  else {
    r(steel, 129, 74, 42, 16)
    r(cream, 131, 72, 37, 4)
    r(art.highMargin ? amber : mint, 142, 75, 16, 13)
    r(ink, 127, 89, 45, 2)
    sprite(r, art.lightweight ? 'adapter' : 'scale', 173, 76, .7)
    sprite(r, 'box', 108, 76, .7)
  }
  if (art.assembled && art.lightweight) r(amber, 143, 61, 24, 3)
  if (art.stage === 'integration' || art.tested) {
    r(art.warning ? fault : mint, 71, 84, 26, 2)
    r(art.warning ? fault : mint, 96, 84, 2, 11)
    r(art.warning ? fault : mint, 96, 94, 41, 2)
    if (art.work && art.work.progress >= .22) r(cream, 98 + frame % 8 * 4, 94, 3, 2)
  }
  r(ink, 21, 87, 58, 19)
  r(steel, 22, 86, 54, 3)
  console(r, 28, 56, 42, frame, !!art.warning)
  if (art.tested) r(art.warning ? fault : mint, 44, 62, 16, 3)
  r(ink, 234, 83, 72, 23)
  r(steel, 234, 81, 72, 4)
  if (!art.lunar || art.groundReady || showsWork('buildGround')) receiver(r, 238, 59, true)
  else sprite(r, 'box', 239, 69, .85)
  if (art.dual) receiver(r, 267, 59)
  if (!art.lunar && (art.avionicsReady || showsWork('buildAvionics'))) sprite(r, art.advanced ? 'archive' : 'data', 287, 69, .75)
  workshopCrew(r, art, frame, arrival)
}

function moon(r: Rect, width: number, horizon: number, dark: boolean) {
  for (let x = 0; x < width; x += 4) {
    const rise = Math.floor(Math.sin(x / 23) * 5 + Math.cos(x / 57) * 5)
    r(dark ? '#475466' : '#a6a69e', x, horizon + rise, 4, 140 - horizon - rise)
    r(dark ? '#626f7c' : '#d9d3b9', x, horizon + rise, 4, 2)
  }
  for (let i = 0; i < Math.floor(width / 8); i += 1) {
    const x = (i * 51 + 11) % (width - 12)
    const y = horizon + 9 + (i * 7) % Math.max(1, 125 - horizon)
    r(dark ? '#374357' : '#797f7c', x, y, 3 + i % 7, 2)
  }
}

function flight(r: Rect, art: StudioArt, frame: number, arrival: number) {
  stars(r, 320, 140)
  const orbital = art.scene === 'orbitalPass' || art.scene === 'ascent'
  if (orbital) {
    for (let i = 0; i < 12; i += 1) {
      const x = 100 - i * 6
      r(i < 2 ? mint : i < 5 ? '#4f8998' : '#305671', x, 79 + i * 6, 320 - x * 2, 6)
    }
    for (const [x, y, w] of [[68, 122, 50], [82, 132, 83], [190, 110, 33], [207, 115, 38]]) r('#598383', x, y, w, 4)
    if (art.scene === 'ascent') {
      rocket(r, 139, 16 - frame % 4 * 2, art.highMargin, art.warning ? 4 : 11 + frame % 4 * 2)
      if (!art.warning) sprite(r, 'upperStage', 192 + frame % 4, 33, 1.5)
    } else {
      sprite(r, 'upperStage', 83, 29, 2)
      for (let i = 0; i < 13; i += 1) {
        r((i + frame) % 3 ? steel : mint, 116 + 10 * i, 51 + (art.alternate ? 2 : 3) * i, 4, 1)
      }
      receiver(r, 235, 72, true, art.warning)
      if (art.dual) receiver(r, 265, 76, true, art.warning)
      if (art.result === 'delivered') sprite(r, 'data', 260, 99, 1.1)
    }
  } else {
    const surface = art.scene === 'surface' || art.scene === 'night'
    const dark = art.scene === 'night'
    if (surface || art.scene === 'descent') moon(r, 320, surface ? 89 : 108, dark)
    else sprite(r, 'moon', 204, 20, 3)
    sprite(r, 'lander', 148, surface ? 56 : art.scene === 'descent' ? 38 + frame % 4 * 2 : 32, 2)
    if (art.scene === 'descent') {
      r(amber, 167, 73 + frame % 4 * 2, 10, 8)
      r(fault, 170, 80 + frame % 4 * 2, 4, 3)
    }
    if (surface) {
      sprite(r, dark ? 'moon' : 'sun', 253, 17, 1.6)
      sprite(r, art.advanced ? 'twoCameras' : 'camera', 103, 74, .75)
      r(steel, 109, 88, 4, 8)
      r(steel, 103, 96, 16, 2)
      if (frame % 4 || art.result) r(art.warning ? fault : amber, 111, 75, 2, 2)
      if (art.extended) sprite(r, 'battery', 190, 74)
      receiver(r, 215, 67, true, art.warning)
      if (!art.warning && (frame % 4 > 0 || art.result)) r(mint, 228, 62, 6, 1)
    }
  }
  // The foreground is the ground team's console, with the flight view behind it.
  r(ink, 0, 116, 320, 24)
  r(slate, 0, 117, 320, 3)
  console(r, 13, 91, 57, frame, !!art.warning)
  console(r, 268, 93, 39, frame + 2, !!art.warning)
  if (!orbital) {
    sprite(r, 'fuel', 71, 110, .9)
    if (art.alternate) sprite(r, 'route', 102, 111)
  }
  for (let i = 0; i < Math.min(art.received ?? 0, 7); i += 1) r(mint, 242 - i * 8, 129, 5, 4)
  const role = art.reporter ?? 'comms'
  crew(r, role, 77 + (74 * arrival), 135, arrival === 1 ? 'report' : 'walk', frame, art.prop ?? 'signal')
}

function control(r: Rect, art: StudioArt, frame: number, arrival: number) {
  const launch = art.scene === 'launchControl'
  r('#283e57', 0, 0, 320, 140)
  r(slate, 0, 6, 320, 3)
  for (const x of [13, 307]) r(ink, x, 9, 4, 94)
  r(ink, 86, 12, 149, 67)
  stars(r, 143, 59, 89, 15)
  for (let i = 0; i < 19; i += 1) r(steel, 103 + i * 5, 65 - Math.floor(Math.sin(i / 8) * (art.alternate ? 34 : 15)), 2, 1)
  if (launch) {
    const icon = art.stage === 'lunar-checkout' ? 'lander' : art.warning ? 'signal' : art.stage === 'first-signal' ? 'orbit' : 'rocket'
    sprite(r, icon, 151, 26, 1.7)
  }
  else {
    sprite(r, 'moon', 183, 28, 1.8)
    sprite(r, 'lander', 128, 36, 1.05)
  }
  ground(r, true)
  for (const x of [22, 238]) {
    r(ink, x, 81, 58, 24)
    r(steel, x, 81, 58, 3)
    console(r, x + 4, 51, 49, x + frame, !!art.warning)
  }
  r(slate, 111, 84, 99, 13)
  r(steel, 111, 84, 99, 3)
  r(ink, 117, 97, 4, 18)
  r(ink, 200, 97, 4, 18)
  if (launch) receiver(r, 144, 59, true, !!art.warning)
  else {
    sprite(r, 'lander', 146, art.assembled ? 50 : 57, art.assembled ? 1.6 : 1.3)
    sprite(r, art.advanced ? 'twoCameras' : 'camera', 119, 69, .7)
  }
  if (art.extended) sprite(r, 'battery', 182, 64, .86)
  if (art.lightweight) r(amber, 147, 84, 31, 2)
  workshopCrew(r, art, frame, arrival)
}

function displayEarth(r: Rect, x: number, y: number) {
  r('#477a8e', x - 8, y - 11, 16, 22)
  r('#477a8e', x - 11, y - 7, 22, 14)
  r(mint, x - 9, y - 6, 8, 5)
  r(mint, x - 3, y - 2, 6, 3)
  r('#6b9f9b', x + 3, y + 3, 6, 5)
  r(cream, x - 4, y - 11, 8, 2)
}

function displayOrbit(r: Rect, option: string) {
  const orbit = orbitalLaunch.orbits[option as keyof typeof orbitalLaunch.orbits]
  const angle = orbit.inclination * Math.PI / 180
  const radius = 20 * orbit.altitudeKm / orbitalLaunch.orbits.low.altitudeKm
  const color = option === 'sso' ? amber : mint
  displayEarth(r, 161, 44)
  for (let i = 0; i < 108; i++) {
    const time = i * 2 * Math.PI / 108
    const major = radius * Math.cos(time)
    const minor = radius * .62 * Math.sin(time)
    r(i < 54 ? color : '#658892', 161 + major * Math.cos(angle) - minor * Math.sin(angle),
      44 + .82 * (major * Math.sin(angle) + minor * Math.cos(angle)), 2, 2)
  }
  const altitude = Math.round(radius)
  r(slate, 204, 55, 27, 4)
  r(color, 204, 55, altitude, 2)
}

function displayLunarRoute(r: Rect, alternate = false) {
  displayEarth(r, 105, 51)
  sprite(r, 'moon', 200, 20, 1.4)
  for (let i = 1; i < 27; i++) {
    const t = i / 27
    const y = 51 - 16 * t - Math.sin(t * Math.PI) * (alternate ? 21 : 2)
    r(alternate ? amber : mint, 117 + 3 * i, y, 2, 2)
  }
}

function displayPower(r: Rect, option: string) {
  const night = lunarMission.powers[option as keyof typeof lunarMission.powers].nightWindows
  const day = lunarMission.daylightWindows
  sprite(r, 'sun', 109, 22, 1.15)
  sprite(r, 'moon', 197, 22, 1.1)
  if (night) sprite(r, 'battery', 163, 25, 1.1)
  for (let i = 0; i < day + lunarMission.powers.extended.nightWindows; i++) {
    r(i < day ? mint : i < day + night ? amber : slate, 103 + 24 * i, 55, 21, 6)
  }
}

export function drawMeetingDisplay(ctx: CanvasRenderingContext2D, display: MeetingDisplay = {}) {
  const { x, y, width, height } = meetingDisplayBounds
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  const r = painter(ctx)
  const { preview, commissionMap, lunar, alternate, advanced, warning } = display
  r(navy, x, y, width, height)
  for (let column = 91; column < 235; column += 8) {
    for (let row = 21; row < 68; row += 8) r(slate, column, row, 1, 1)
  }
  if (commissionMap) map(r, commissionMap, 90, 22, 74, 43, true)
  if (!preview) {
    if (lunar) displayLunarRoute(r, alternate)
    else {
      if (!commissionMap) sprite(r, advanced ? 'archive' : 'orbit', 104, 22, 1.65)
      for (const y of [28, 41, 54]) {
        r(steel, 173, y, 6, 5)
        r(warning && y === 41 ? fault : mint, 183, y + 1, y === 41 ? 42 : 29, 2)
        r(slate, 183, y + 4, 20, 1)
      }
    }
  } else if (preview.group === 'launch' && preview.extra) {
    sprite(r, preview.extra, 172, 20, 1.9)
  } else if (preview.group === 'capability') {
    sprite(r, preview.prop, 168, 25, 1.4)
    if (preview.extra) sprite(r, preview.extra, 203, 34, 1.25)
  } else if (preview.group === 'orbit') {
    displayOrbit(r, preview.option)
  } else if (preview.group === 'ground') {
    const stations = preview.option === 'dual' ? [105, 186] : [145]
    for (const x of stations) receiver(r, x, 38)
    const { capacity } = orbitalLaunch.grounds[preview.option as keyof typeof orbitalLaunch.grounds]
    for (let i = 0; i < capacity; i++) r(mint, 161 - capacity * 5 + i * 10, 28, 6, 3)
  } else if (preview.group === 'route') {
    displayLunarRoute(r, preview.option === 'lowEnergy')
  } else if (preview.group === 'power') {
    displayPower(r, preview.option)
  } else if (preview.group === 'stage') {
    const scaled: Rect = (color, x, y, width, height) => r(color, 144 + x * .48, 22 + y * .48,
      Math.max(1, Math.round(width * .48)), Math.max(1, Math.round(height * .48)))
    const upgraded = preview.option === 'highMargin'
    rocket(scaled, 0, 0, upgraded)
    const { capacityKg } = orbitalLaunch.stages[preview.option as keyof typeof orbitalLaunch.stages]
    r(upgraded ? amber : mint, 174, 52, Math.round(capacityKg / 3), 3)
  } else if (preview.group === 'adapter' || preview.group === 'mount') {
    const light = preview.option === 'lightweight'
    for (const y of light ? [49] : [39, 49, 59]) r(light ? amber : mint, 108, y, 49, 3)
    sprite(r, preview.prop, 170, 22, 1.75)
  } else if (lunar && preview.group === 'payload') {
    sprite(r, 'lander', 109, 21, 1.9)
    sprite(r, preview.prop, 175, 23, 1.8)
  } else {
    sprite(r, preview.prop, preview.extra ? 110 : 139, 23, 1.7)
    if (preview.extra) sprite(r, preview.extra, 172, 23, 1.7)
  }
  if (warning) r(fault, 227, 22, 6, 2)
  ctx.restore()
}

function meetingRoom(ctx: CanvasRenderingContext2D, art: StudioArt, frame: number, arrival: number) {
  const r = painter(ctx)
  r('#dedfd1', 0, 0, 320, 140)
  r('#f0eee0', 0, 0, 320, 11)
  r('#c4c9ba', 0, 76, 320, 3)
  r('#b3bdb1', 0, 79, 320, 61)
  for (const y of [99, 119, 137]) r('#a2aea2', 0, y, 320, 1)
  for (const x of [24, 81, 240, 296]) r('#a2aea2', x, 80, 1, 60)
  r(slate, 12, 17, 55, 44)
  stars(r, 47, 36, 16, 21)
  r('#6b8d91', 38, 21, 2, 36)
  r(steel, 9, 61, 61, 3)
  r('#bac4b7', 257, 16, 49, 60)
  r(slate, 260, 19, 43, 57)
  r(navy, 265, 23, 33, 39)
  r(steel, 265, 65, 8, 2)
  r('#879c95', 78, 18, 166, 62)
  r(ink, 79, 13, 164, 61)
  drawMeetingDisplay(ctx, art.meetingDisplay)
  r('#a0ab9e', 80, 111, 159, 11)
  r(ink, 91, 101, 6, 19)
  r(ink, 224, 101, 6, 19)
  r(navy, 74, 87, 171, 20)
  r('#769298', 78, 81, 163, 17)
  r('#a3b5ad', 78, 81, 163, 3)
  sprite(r, 'data', 130, 77, .8)
  sprite(r, 'contract', 162, 76, .8)
  const seats = [{ id: 'science', x: 49, base: 116, prop: 'map' }, { id: 'power', x: 114, base: 128, prop: 'data' },
    { id: 'comms', x: 247, base: 117, prop: 'signal' }] as const
  drawCrew(r, seats.map(({ id, x, base, prop }): CrewSprite => {
    if (id !== art.reporter) return { id, x, base, pose: 'idle' }
    return { id, x: x + (185 - x) * arrival, base: base + (134 - base) * arrival,
      pose: arrival === 1 ? 'report' : 'walk', prop: art.prop ?? prop }
  }), frame)
}

export function drawStudio(ctx: CanvasRenderingContext2D, art: StudioArt, frame: number, arrival: number) {
  const r = painter(ctx)
  if (art.scene === 'pad' && art.launch) launchPad(r, art, frame)
  else if (art.scene === 'meeting') meetingRoom(ctx, art, frame, arrival)
  else if (art.scene === 'hangar' || art.scene === 'lunarWorkshop') hangar(r, art, frame, arrival)
  else if (art.scene === 'control' || art.scene === 'launchControl') control(r, art, frame, arrival)
  else flight(r, art, frame, arrival)
}
