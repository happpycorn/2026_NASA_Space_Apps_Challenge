import { expect, test, type Page } from '@playwright/test'
import { translator, type Message } from '../src/i18n'
import { newGame } from '../src/game/mission'
import { commissionRules } from '../src/missions/cubesat-commission'
import { lunarRules } from '../src/missions/lunar-rules'
import { orbitalRules } from '../src/missions/orbital-rules'
import type { Game } from '../src/game/types'
import { activeDecision, button, configure, enterMeeting, firstBrief, meeting, reveal, signReview, useStudioClock, work as doWork } from './studio-controls'
import { start as startLunar } from './lunar-run'
import { meetingDisplayBounds } from '../src/ui/studioArt'

const t = translator('zh-TW')
const prefix = (label: string) => new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const persisted = (page: Page): Promise<Game> => page.evaluate(() => JSON.parse(localStorage.getItem('space-mission.single.v2')!))

test('Traditional Chinese plays all three chapters, adjusts measured lift and restores a surface choice', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?seed=1')
  await button(page, '繁中').click()
  const tap = (key: Message) => button(page, t(key)).click()
  const scene = page.locator('.studio-scene')
  const dialog = activeDecision(page)
  const guide = page.locator('.studio-tutorial-target')
  const work = (key: Message) => doWork(page, prefix(t(key)), 'zh-TW')
  const checkDesign = (group: Message, option: Message) => configure(page, prefix(t(group)), prefix(t(option)), 'zh-TW')
  const event = async (choice: Message) => {
    await enterMeeting(page, 'zh-TW')
    await button(page, t('eventChoose') + ' ' + t(choice)).click()
  }
  const review = async (gate: 'PDR' | 'FRR') => {
    const conditions = button(page, t('studioReview'))
    if (await conditions.isVisible()) await conditions.click()
    const sign = button(page, t('chapterReviewSign'))
    if (await sign.isVisible()) await sign.click()
    for (const waiver of await dialog.getByRole('checkbox').all()) await waiver.check()
    await button(page, t('submitGate', { gate })).click()
  }
  const openChapter = async (missionId: string, seed: number) => {
    await tap('home')
    await page.goto('/?seed=' + seed)
    await page.locator(`[data-mission="${missionId}"]`).getByRole('button', { name: t('openMission') }).click()
    await tap('begin')
  }

  await firstBrief(page, 'zh-TW')
  await tap('acceptCommission')
  await expect(guide).toContainText(t('studioTutorialLabel'))
  await expect(guide).toContainText(t('studioTutorialEnter'))
  await expect(button(page, t('studioEnterMeeting'))).toBeFocused()
  await enterMeeting(page, 'zh-TW')
  await expect(scene).toBeInViewport({ ratio: 1 })
  await expect(button(page, t('studioCompare'))).toBeInViewport({ ratio: 1 })
  await tap('studioCompare')
  await work('studioConfirmPlan')
  for (const job of ['freeze', 'build', 'integrate']) await work(commissionRules.costs[job].label)
  await review('FRR')
  await tap('studioLaunchVehicle')
  await tap('studioSkipLaunch')
  await expect(scene).toHaveAttribute('data-scene', 'launchControl')
  await tap('runFlight')
  await expect(page.getByRole('heading', { name: t('commissionOutcomeSuccess') })).toBeVisible()

  await openChapter('orbital-launch', 2)
  await expect(scene).toHaveAttribute('data-scene', 'hangar')
  await expect(page.getByText(t('studioOrbitalBrief', { payload: 70, units: 2 }))).toBeVisible()
  await expect(button(page, prefix(t(orbitalRules.costs.assess.label)))).toHaveCount(0)
  await enterMeeting(page, 'zh-TW')
  await expect(guide).toHaveCount(0)
  await checkDesign('orbitalOrbit', 'orbitalOrbitSso')
  const forecast = meeting(page).locator('.studio-preview')
  const beforeAdapter = await forecast.innerText()
  await checkDesign('orbitalAdapter', 'orbitalAdapterLightweight')
  await expect.poll(() => forecast.innerText()).not.toBe(beforeAdapter)
  await expect(scene).toHaveAttribute('data-scene', 'meeting')
  await work('studioConfirmPlan')
  await expect(scene).toHaveAttribute('data-scene', 'hangar')
  await expect(guide).toHaveCount(0)
  expect((await persisted(page)).studioTutorial).toBeUndefined()
  await work(orbitalRules.costs.prelim.label)
  await review('PDR')
  await event('orbitalEventAcknowledge')
  await work(orbitalRules.costs.freeze.label)
  await work(orbitalRules.costs.buildStage.label)
  await work(orbitalRules.costs.buildAvionics.label)
  await work(orbitalRules.costs.integrate.label)
  await expect(guide).toHaveCount(0)
  await reveal(page, t('optionalTasks'))
  for (const job of ['trade', 'engineTest', 'hotfire']) await work(orbitalRules.costs[job].label)
  await expect(scene).toHaveAttribute('data-warning', 'true')
  await expect(page.getByText(t('studioOrbitalMarginFailure'))).toBeVisible()
  await expect(button(page, t('submitGate', { gate: 'FRR' }))).toHaveCount(0)
  await enterMeeting(page, 'zh-TW')
  await expect(meeting(page).getByText(/實測少送 6 kg.*運載餘裕 -2 kg/)).toBeVisible()
  const measuredAt = (await persisted(page)).evidence?.week
  await work(orbitalRules.costs.retarget.label)
  await expect.poll(async () => (await persisted(page)).design.orbit).toBe('low')
  expect((await persisted(page)).evidence?.week).toBe(measuredAt)
  await review('FRR')
  await expect(scene).toHaveAttribute('data-scene', 'pad')
  await tap('studioLaunchVehicle')
  const launch = page.locator('[data-launch-phase]')
  await expect(launch).toHaveAttribute('data-launch-phase', 'countdown')
  await page.clock.fastForward(3100)
  await expect(launch).toHaveAttribute('data-launch-phase', 'ignition')
  await page.clock.fastForward(900)
  await expect(launch).toHaveAttribute('data-launch-phase', 'liftoff')
  await page.clock.fastForward(1900)
  await expect(scene).toHaveAttribute('data-scene', 'launchControl')
  expect((await persisted(page)).flightProgress?.steps.map(step => step.id)).toEqual(['ascent'])
  await tap('runSegment')
  await expect(page.getByRole('heading', { name: t('orbitalOutcomeSuccess') })).toBeVisible()

  await openChapter('lunar-mission', 1)
  await expect(scene).toHaveAttribute('data-scene', 'lunarWorkshop')
  await expect(page.getByText(t('studioLunarBrief', { count: 1 }))).toBeVisible()
  await expect(guide).toHaveCount(0)
  await event('lunarOfferDecline')
  await expect(scene).toHaveAttribute('data-scene', 'meeting')
  await expect(guide).toHaveCount(0)
  const lunarForecast = meeting(page).locator('.studio-preview')
  const directPlan = await lunarForecast.innerText()
  await checkDesign('lunarRoute', 'lunarRouteLowEnergy')
  await expect.poll(() => lunarForecast.innerText()).not.toBe(directPlan)
  await expect(lunarForecast).toContainText('月面預計交付')
  await work('studioConfirmPlan')
  await work(lunarRules.costs.prelim.label)
  await review('PDR')
  await work(lunarRules.costs.detail.label)
  await work(lunarRules.costs.freeze.label)
  await event('lunarCardSupplierDelayWait')
  await work(lunarRules.costs.buildFlight.label)
  await event('lunarCardSecondOfferAlone')
  await work(lunarRules.costs.buildPayload.label)
  await event('lunarCardPullInAccept')
  await work(lunarRules.costs.buildGround.label)
  await work(lunarRules.costs.integrate.label)
  await expect(guide).toHaveCount(0)
  await review('FRR')
  expect((await persisted(page)).studioTutorial).toBeUndefined()
  await expect(scene).toHaveAttribute('data-scene', 'pad')
  const lightning = page.getByRole('radio', { name: prefix(t('lunarCardLightningCheck')) })
  await expect(lightning).toHaveCount(0)
  await tap('studioLaunchVehicle')
  await expect(launch).toHaveAttribute('data-launch-phase', 'countdown')
  await expect(lightning).toHaveCount(0)
  const launchSave = (await persisted(page)).studioLaunch!
  await page.reload()
  await tap('continue')
  await expect(launch).toBeVisible()
  expect((await persisted(page)).studioLaunch).toEqual(launchSave)
  await page.clock.fastForward(6100)
  await expect(scene).toHaveAttribute('data-visual-step', 'lunar-checkout')
  expect((await persisted(page)).flightProgress?.steps.map(step => [step.id, step.choice])).toEqual([['launch', null]])
  await expect(lightning).toBeVisible()
  await page.reload()
  await tap('continue')
  await expect(lightning).toBeVisible()
  await lightning.check()
  for (let i = 0; i < 4; i += 1) await tap('runSegment')
  await expect(scene).toHaveAttribute('data-scene', 'surface')
  await dialog.getByRole('radio', { name: prefix(t('lunarCardEclipseExposed')) }).check()
  await tap('runSegment')
  const plan = dialog.getByRole('radio', { name: prefix(t('lunarSurfaceExtra')) })
  await plan.check()
  const beforeReload = await persisted(page)
  await page.reload()
  await tap('continue')
  await expect(plan).toBeChecked()
  expect(await persisted(page)).toEqual(beforeReload)
  await tap('runSegment')
  await tap('runSegment')
  await expect(page.getByRole('heading', { name: t('lunarOutcomeSuccess') })).toBeVisible()
  await expect(scene).toHaveAttribute('data-result', 'delivered')
  await expect.poll(async () => (await persisted(page)).flight?.batches).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await tap('playAgain')
  await event('lunarOfferDecline')
  await expect(guide).toHaveCount(0)
  await expect(meeting(page).locator('.studio-preview')).toBeVisible()
})

test('a lunar propellant shortfall is explained at the bench and resolved through rework and retest', async ({ page }) => {
  const game = startLunar(1).work('assess').work('prelim').work('detail').work('freeze')
    .work('buildFlight').work('buildPayload').work('buildGround').work('integrate').snapshot()
  expect(game.evidence?.margin).toBe(4)
  // Keep the response reserve funded so only the propellant requirement blocks this fixture.
  await page.addInitScript(save => {
    if (!localStorage.getItem('space-mission.single.v2')) localStorage.setItem('space-mission.single.v2', save)
  }, JSON.stringify({ ...game, credits: game.credits + 10 }))
  await page.goto('/')
  await button(page, 'Continue mission').click()
  await expect(page.locator('.studio-scene')).toHaveAttribute('data-scene', 'lunarWorkshop')
  await expect(page.locator('.studio-tutorial-target')).toHaveCount(0)
  await expect(page.getByText(translator('en')('lunarFrrReturnCorrection', { margin: 4, need: 6 }))).toBeVisible()
  await expect(button(page, 'Submit FRR')).toHaveCount(0)
  await enterMeeting(page)
  const plan = meeting(page).locator('.studio-action-card').filter({ hasText: translator('en')('lunarRemedyReroute') })
  await expect(plan).toContainText('Planned lunar delivery')
  await doWork(page, prefix(translator('en')('lunarRemedyReroute')))
  await expect.poll(async () => (await persisted(page)).design.route).toBe('lowEnergy')
  await doWork(page, prefix(translator('en')(lunarRules.costs.retest.label)))
  await expect.poll(async () => (await persisted(page)).evidence?.margin).toBe(16)
  await signReview(page, 'FRR')
  await expect(page.locator('.studio-scene')).toHaveAttribute('data-scene', 'pad')
})

for (const route of [
  { seed: 3, choice: 'lunarCardScrubWait', id: 'Wait' },
  { seed: 5, choice: 'lunarCardWeatherRollback', id: 'Rollback' },
] as const) {
  test(`lunar seed ${route.seed}: the ground response clears the pad before countdown`, async ({ page }) => {
    const run = startLunar(route.seed).design({ route: 'lowEnergy' }).work('assess').work('prelim').work('detail').work('freeze')
      .work('buildFlight').work('buildPayload').work('buildGround').work('integrate')
    expect(run.review().passed).toBe(true)
    await page.addInitScript(raw => {
      if (!localStorage.getItem('space-mission.single.v2')) localStorage.setItem('space-mission.single.v2', raw)
    }, JSON.stringify(run.snapshot()))
    const en = translator('en')
    await page.goto('/')
    await button(page, 'Continue mission').click()
    await expect(button(page, en('studioLaunchVehicle'))).toHaveCount(0)
    await expect(page.locator('[data-launch-phase]')).toHaveCount(0)
    await page.getByRole('radio', { name: prefix(en(route.choice)) }).check()
    await button(page, en('studioConfirmGroundResponse')).click()
    await expect(button(page, en('studioLaunchVehicle'))).toBeEnabled()
    expect((await persisted(page)).flightProgress).toMatchObject({ steps: [], state: { decisions: [route.id] } })
    await page.reload()
    await button(page, 'Continue mission').click()
    await button(page, en('studioLaunchVehicle')).click()
    await button(page, en('studioSkipAscent')).click()
    await expect(page.locator('.studio-scene')).toHaveAttribute('data-visual-step', 'lunar-checkout')
    expect((await persisted(page)).flightProgress).toMatchObject({ steps: [{ id: 'launch' }], state: { decisions: [route.id] } })
  })
}

test('a lunar countdown saved with a preselected lightning response resumes and honors that choice', async ({ page }) => {
  const run = startLunar(1).design({ route: 'lowEnergy' }).work('assess').work('prelim').work('detail').work('freeze')
    .work('buildFlight').work('buildPayload').work('buildGround').work('integrate')
  expect(run.review().passed).toBe(true)
  await useStudioClock(page)
  await page.addInitScript(raw => localStorage.setItem('space-mission.single.v2',
    JSON.stringify({ ...JSON.parse(raw), studioLaunch: { startedAt: Date.now(), choice: 'Check' } })), JSON.stringify(run.snapshot()))
  await page.goto('/')
  await button(page, 'Continue mission').click()
  await expect(page.locator('[data-launch-phase]')).toHaveAttribute('data-launch-phase', 'countdown')
  await button(page, 'View launch report').click()
  await expect(page.locator('.studio-scene')).toHaveAttribute('data-visual-step', 'lunar-checkout')
  await expect(page.getByRole('radio', { name: /Run a full check in parking orbit/ })).toHaveCount(0)
  expect((await persisted(page)).flightProgress).toMatchObject({
    steps: [{ id: 'launch', choice: 'Check' }], state: { decisions: ['Check'] },
  })
})

const meetingRoutes = [
  { rules: commissionRules, commission: 'bay', language: 'zh-TW', width: 390, groups: ['launch', 'capability'] },
  { rules: orbitalRules, language: 'en', width: 1440, groups: ['orbit', 'stage', 'telemetry', 'adapter', 'ground'] },
  { rules: lunarRules, language: 'en', width: 320, groups: ['route', 'payload', 'sensor', 'power'] },
] as const

for (const route of meetingRoutes) {
  test(`${route.rules.id} meeting changes only the wall display as options change`, async ({ page }, info) => {
    const { rules, language, width, groups } = route
    const tr = translator(language)
    const game = newGame(rules.id, [], 1, 'commission' in route ? route.commission : undefined)
    if (game.commission) game.studioTutorial = ['feasibility', 'design', 'build', 'integration', 'review']
    await page.setViewportSize({ width, height: 900 })
    if (width < 500) await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(raw => {
      if (!localStorage.getItem('space-mission.single.v2')) localStorage.setItem('space-mission.single.v2', raw)
    }, JSON.stringify(game))
    const tap = (key: Message) => button(page, tr(key)).click()
    const scene = page.locator('.studio-workspace .studio-scene')
    const room = meeting(page)
    const pixels = () => scene.locator('canvas').evaluate((element, bounds) => {
      const canvas = element as HTMLCanvasElement
      const { width, height } = canvas
      const data = canvas.getContext('2d')!.getImageData(0, 0, width, height).data
      const colors = new Uint32Array(data.buffer)
      let screen = 0
      let outside = 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const value = colors[y * width + x]
          if (x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height) {
            screen = Math.imul(screen ^ value, 16777619)
          } else {
            outside = Math.imul(outside ^ value, 16777619)
          }
        }
      }
      return { screen, outside }
    }, meetingDisplayBounds)
    const selectGroup = (id: string) => room.getByRole('button', { name: prefix(tr(rules.groups[id].legend)) }).click()
    const option = (group: string, id: string) => room.getByRole('radio', { name: prefix(tr(rules.groups[group].options[id].label)) })
    await page.goto('/')
    if (language === 'zh-TW') await button(page, '繁中').click()
    await tap('continue')
    await enterMeeting(page, language)
    if (rules.id === lunarRules.id) await button(page, tr('eventChoose') + ' ' + tr('lunarOfferDecline')).click()
    await expect(scene).toHaveAttribute('data-scene', 'meeting')
    if (width >= 500) await tap('studioPause')
    const beforeComparison = await persisted(page)
    const initialPixels = await pixels()
    for (const group of groups) {
      const beforeGroup = await persisted(page)
      await selectGroup(group)
      const original = beforeGroup.design[group]
      await expect(scene).toHaveAttribute('data-preview-group', group)
      await expect(scene).toHaveAttribute('data-preview-option', original)
      await expect(option(group, original)).toBeChecked()
      expect(await persisted(page)).toEqual(beforeGroup)
      const originalPixels = await pixels()
      const candidates = Object.keys(rules.groups[group].options)
      for (const candidate of candidates.filter(id => id !== original)) {
        if (group === 'orbit') {
          await option(group, original).focus()
          await option(group, original).press('ArrowRight')
        } else {
          await option(group, candidate).check()
        }
        await expect(scene).toHaveAttribute('data-preview-option', candidate)
        await expect(option(group, candidate)).toBeChecked()
        expect((await persisted(page)).design[group]).toBe(candidate)
        expect((await pixels()).screen).not.toBe(originalPixels.screen)
        expect((await pixels()).outside).toBe(initialPixels.outside)
        await option(group, original).check()
        await expect.poll(pixels).toEqual(originalPixels)
      }
    }
    const group = groups[0]
    const original = beforeComparison.design[group]
    const alternative = Object.keys(rules.groups[group].options).find(id => id !== original)!
    await selectGroup(group)
    const baseline = await pixels()
    const forecast = room.locator('.studio-preview')
    const beforeForecast = await forecast.innerText()
    await page.locator('.studio-workspace').screenshot({ path: info.outputPath('meeting-original.png') })
    await option(group, alternative).check()
    await expect.poll(() => forecast.innerText()).not.toBe(beforeForecast)
    const chosen = await pixels()
    expect(chosen.screen).not.toBe(baseline.screen)
    expect(chosen.outside).toBe(baseline.outside)
    await page.locator('.studio-workspace').screenshot({ path: info.outputPath('meeting-selected.png') })
    await page.screenshot({ path: info.outputPath('meeting-layout.png'), fullPage: true })
    await page.reload()
    await tap('continue')
    await enterMeeting(page, language)
    await selectGroup(group)
    await expect(option(group, alternative)).toBeChecked()
    await expect(scene).toHaveAttribute('data-preview-option', alternative)
    expect((await pixels()).screen).toBe(chosen.screen)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

    if (rules.id === orbitalRules.id) {
      for (const key of ['orbit', 'stage', 'adapter']) {
        await expect(room.getByRole('button', { name: prefix(tr(rules.groups[key].legend)) })).toContainText('Can improve · Lift margin')
      }
      await expect(room.getByRole('button', { name: /^Ground stations/ })).not.toContainText('Can improve')
      await expect(option('orbit', 'low')).toHaveAccessibleName(/Lift margin · Meets the planning target/)
      await selectGroup('stage')
      await expect(option('stage', 'highMargin')).toHaveAccessibleName(/Lift margin · Could meet the target. Verify lift./)
      await selectGroup('orbit')
      await option('orbit', 'low').check()
      await expect(room.locator('.studio-config-guidance')).toHaveCount(0)
    }
  })
}

test('lunar guidance shows the remaining propellant gap and updates after each change', async ({ page }) => {
  const game = startLunar(1).design({ payload: 'advanced', sensor: 'redundant', power: 'extended' }).snapshot()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(raw => {
    if (!localStorage.getItem('space-mission.single.v2')) localStorage.setItem('space-mission.single.v2', raw)
  }, JSON.stringify({ ...game, credits: 500 }))
  await page.goto('/')
  await button(page, '繁中').click()
  await button(page, t('continue')).click()
  await enterMeeting(page, 'zh-TW')
  const room = meeting(page)
  await expect(room.getByText('可改善 · 推進劑餘裕', { exact: true })).toHaveCount(4)
  await room.getByRole('button', { name: prefix(t('lunarRoute')) }).click()
  const lowEnergy = room.getByRole('radio', { name: prefix(t('lunarRouteLowEnergy')) })
  await expect(lowEnergy).toHaveAccessibleName(/推進劑餘裕 · 仍差 12\u00a0kg/)
  await lowEnergy.check()
  await expect(room.getByText('可改善 · 推進劑餘裕', { exact: true })).toHaveCount(3)
  await room.getByRole('button', { name: prefix(t('lunarPower')) }).click()
  const daylight = room.getByRole('radio', { name: prefix(t('lunarPowerDayOnly')) })
  await expect(daylight).toHaveAccessibleName(/推進劑餘裕 · 依目前估計可達標/)
  await daylight.check()
  await expect(room.locator('.studio-config-guidance')).toHaveCount(0)
  await expect(room.locator('.studio-preview')).toContainText('10 kg')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
