import { expect, type Page } from '@playwright/test'
import { translator, type Language } from '../src/i18n'

export const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' })
export const summary = (page: Page, name: string) => page.locator('summary').filter({ hasText: name })
export const activeDecision = (page: Page) => page.locator('dialog[open]')
export const meeting = (page: Page) => page.locator('.studio-meeting')

export async function enterMeeting(page: Page, language: Language = 'en') {
  const enter = button(page, translator(language)('studioEnterMeeting'))
  if (await enter.isVisible()) await enter.click()
}

export async function firstBrief(page: Page, language: Language = 'en') {
  const t = translator(language)
  await button(page, t('startGame')).click()
  for (let i = 0; i < 4; i++) await button(page, t('nextStep')).click()
  await button(page, t('prologueReadOffers')).click()
}

const clocks = new WeakSet<Page>()
export async function useStudioClock(page: Page) {
  if (clocks.has(page)) return
  await page.clock.install()
  clocks.add(page)
}

export async function finishWork(page: Page) {
  const working = page.locator('.studio-run[data-work]')
  await expect(working).toBeVisible()
  await page.clock.fastForward(6100)
  await expect(working).toHaveCount(0)
}

export async function work(page: Page, name: RegExp, language: Language = 'en') {
  await useStudioClock(page)
  const t = translator(language)
  const action = button(page, name)
  const choose = button(page, t('studioChooseWork'))
  await enterMeeting(page, language)
  if (!(await action.isVisible()) && await choose.isVisible()) {
    await choose.click()
  }
  await action.click()
  await finishWork(page)
}

export async function configure(page: Page, group: RegExp, option: RegExp, language: Language = 'en') {
  const t = translator(language)
  await enterMeeting(page, language)
  const area = meeting(page)
  const opened = await area.isVisible()
  if (!opened) {
    const compare = button(page, t('studioCompare'))
    const edit = button(page, t('commissionEditPlan'))
    await (await compare.isVisible() ? compare : await edit.isVisible() ? edit : button(page, t('studioCallMeeting'))).click()
  }
  const comparison = area.locator('summary').filter({ hasText: t('studioCompare') })
  if (await comparison.isVisible() && !(await area.getByRole('button', { name: group }).isVisible())) await comparison.click()
  await area.getByRole('button', { name: group }).click()
  await area.getByRole('radio', { name: option }).check()
  const close = button(page, t('studioCloseMeeting'))
  if (!opened && await close.isVisible()) await close.click()
}

export async function chooseLanguage(page: Page, name: 'EN' | '繁中') {
  const dialog = activeDecision(page)
  const area = await dialog.isVisible() ? dialog : page.locator('.topbar')
  await area.getByRole('button', { name, exact: true }).click()
}

export async function signReview(page: Page, gate: 'PDR' | 'FRR') {
  const review = button(page, 'Review release conditions')
  if (await review.isVisible()) await review.click()
  const sign = button(page, 'Risks and waivers to sign')
  if (await sign.isVisible()) await sign.click()
  for (const waiver of await activeDecision(page).getByRole('checkbox').all()) await waiver.check()
  await button(page, 'Submit ' + gate).click()
}

export async function reveal(page: Page, name: string) {
  const target = summary(page, name).first()
  await expect(target).toBeVisible()
  if (!(await target.evaluate(node => node.parentElement?.hasAttribute('open')))) await target.click()
}
