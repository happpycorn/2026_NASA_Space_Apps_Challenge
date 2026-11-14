import { expect, test, type Page } from '@playwright/test'
import type { Game } from '../src/game/mission'

const labels = {
  en: {
    brief: 'View mission brief', begin: 'Start mission', supply: 'Choose the power supply', assess: /Complete feasibility/,
    radio: 'Choose the radio timer', freeze: /Freeze design/, build: /Build and test subsystems/, test: /Run integration tests/,
    review: 'Submit for flight review', pass: 'Run first ground pass', accept: 'Send to research partner', skip: 'Fast-forward',
  },
  zh: {
    brief: '查看任務簡報', begin: '開始任務', supply: '選擇供電', assess: /完成可行性評估/,
    radio: '設定發訊計時', freeze: /確認設計定版/, build: /製造並驗證子系統/, test: /執行整合測試/,
    review: '送交飛行審查', pass: '執行首次通聯', accept: '交付研究單位', skip: '快轉',
  },
}
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name })
const readout = (page: Page) => page.locator('.lab-readout')
const summary = (page: Page, text: string) => page.locator('summary').filter({ hasText: text })
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })
const saved = (page: Page): Promise<Game> => page.evaluate(() => JSON.parse(localStorage.getItem('space-mission.single.v2')!))

async function start(page: Page, language: keyof typeof labels = 'en') {
  const copy = labels[language]
  await page.goto('/')
  if (language === 'zh') await button(page, '繁中').click()
  await button(page, copy.brief).click()
  await expect(page.getByText('$1,000,000', { exact: true })).toBeVisible()
  await button(page, copy.begin).click()
}

async function design(page: Page, language: keyof typeof labels = 'en') {
  const copy = labels[language]
  for (const step of [copy.supply, copy.assess, copy.radio]) await button(page, step).click()
}

async function assemble(page: Page, language: keyof typeof labels = 'en', skip = false) {
  const copy = labels[language]
  await button(page, copy.freeze).click()
  await button(page, copy.build).click()
  if (skip) await button(page, copy.skip).click()
}

async function finishDelivery(page: Page, count: number, language: keyof typeof labels = 'en') {
  for (let i = 0; i < count; i += 1) await button(page, labels[language].accept).click()
}

test('baseline keeps evidence collapsed, stages handoffs and delivers the required data', async ({ page }) => {
  await start(page)
  await expect(page.locator('.report-speaker')).toHaveText('Science')
  await expect(page.getByRole('radio', { name: /Baseline imager.*\$140,000/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: /Standard power/ })).toBeHidden()
  await button(page, labels.en.supply).click()
  await expect(page.locator('.report-speaker')).toHaveText('Power')
  await expect(page.getByRole('radio', { name: /High-resolution imager/ })).toBeHidden()
  await button(page, labels.en.assess).click()
  await expect(page.getByRole('radio', { name: /Early radio profile/ })).toBeHidden()
  await button(page, labels.en.radio).click()
  await assemble(page)
  await expect(readout(page)).toHaveText('Science calibrates the imager.')
  await button(page, 'Communications').click()
  await expect(page.getByText('Waiting for assembly clearance before switching on the radio.')).toBeVisible()
  await expect(readout(page)).toHaveText('Power connects the test supply.')
  await expect(readout(page)).toHaveText('Communications gets clearance and boots the radio.')
  await page.getByRole('radio', { name: /When the imager starts/ }).check()
  await button(page, labels.en.test).click()
  await expect(readout(page)).toContainText('5 / 10 W')
  await expect(page.getByText('Scope recording')).toBeVisible()
  await expect(readout(page)).toContainText('9 / 10 W')
  const rule = page.locator('.report').first().getByText('32 min after separation · pass at ≥ 30 min (game setting)')
  await expect(rule).toBeHidden()
  await summary(page, 'Integration evidence').click()
  await expect(rule).toBeHidden()
  await summary(page, 'Day-in-the-life (DITL) test').first().click()
  await expect(rule).toBeVisible()
  await expect(page.getByRole('link', { name: /CubeSat 101/ })).toHaveAttribute('href', /page=68/)
  await button(page, labels.en.review).click()
  await expect(rule).toBeHidden()
  await expect(page.locator('.report-speaker')).toHaveText('Ground station')
  await button(page, labels.en.pass).click()
  await expect(readout(page)).toHaveText('Receiving observation batch 1 of 2')
  await finishDelivery(page, 2)
  await expect(heading(page, 'Mission delivered')).toBeVisible()
  await expect(page.getByText('2 usable batches received')).toBeVisible()
  await button(page, 'Return home').click()
  await expect(heading(page, 'Your first CubeSat')).toBeVisible()
  await expect(page.getByText('Team reputation · 1')).toBeVisible()
  await button(page, 'View last mission results').click()
  await expect(page.getByText('2 usable batches received')).toBeVisible()
})

test('overload survives a reload, then staggering restores delivery with fewer batches', async ({ page }) => {
  await start(page)
  await page.getByRole('radio', { name: /High-resolution imager/ }).check()
  await design(page)
  await assemble(page, 'en', true)
  await button(page, labels.en.test).click()
  await expect(readout(page)).toContainText('9 / 10 W')
  await expect(readout(page)).toContainText('13 / 10 W')
  await button(page, '繁中').click()
  const before = await saved(page)
  expect(before.playback).toEqual({ kind: 'integration', step: 1 })
  await page.reload()
  await button(page, '繼續任務').click()
  await expect(readout(page)).toContainText('13／10 W')
  await button(page, labels.zh.skip).click()
  await expect(heading(page, '審查退回')).toBeVisible()
  await expect(readout(page)).toContainText('13／10 W')
  await expect(page.locator('.report-speaker')).toHaveText('電力組')
  await expect(page.getByText('衛星平台', { exact: true }).first()).toBeHidden()
  await summary(page, '整合驗證證據').click()
  await summary(page, '任務操作電力').first().click()
  await expect(page.getByText('衛星平台', { exact: true }).first()).toBeVisible()
  const returned = await saved(page)
  expect(returned.week).toBe(4)
  expect(returned.credits).toBe(38)
  expect(returned.log.filter(row => row.id === 'integrate')).toHaveLength(1)
  expect(returned.log.filter(row => row.id === 'return')).toHaveLength(1)
  await page.getByRole('radio', { name: /錯開操作排程.*\$60,000/ }).check()
  await button(page, '執行選取的修正').click()
  await button(page, /重新執行整合測試/).click()
  await expect(readout(page)).toContainText('9／10 W')
  await expect(readout(page)).toContainText('通訊等候交接')
  await expect(readout(page)).toContainText('6／10 W')
  await expect(page.getByText(/本次可下傳 3 批.*少 1 批/)).toBeVisible()
  await button(page, labels.zh.review).click()
  await page.getByRole('radio', { name: /傳回全部可用觀測/ }).check()
  await button(page, labels.zh.pass).click()
  await finishDelivery(page, 1, 'zh')
  await button(page, '留存實驗室').click()
  await expect(page.getByText('第 3 批已通過下傳檢查。委託方需要 2 批，目前已交付 1 批。')).toBeVisible()
  await expect(page.getByText('這是本次通聯的最後一批')).toBeVisible()
  await expect(page.getByText('留存這一批，這次通聯就會少於委託方要求的交付量。')).toBeVisible()
  await page.reload()
  await button(page, '繼續任務').click()
  await expect(readout(page)).toContainText('第 3／3 批')
  await finishDelivery(page, 1, 'zh')
  await expect(heading(page, '完成基本委託')).toBeVisible()
  await expect(page.getByText('已收到 2 批可用資料')).toBeVisible()
  expect((await saved(page)).flight).toMatchObject({ batches: 2, archived: 1 })
  expect((await saved(page)).log.filter(row => row.id === 'operate')).toHaveLength(1)
  await summary(page, '決策紀錄').click()
  await expect(page.getByText('飛行審查退回', { exact: true })).toBeVisible()
  await summary(page, '錯開操作排程').click()
  await expect(page.locator('.decision-log li').filter({ has: summary(page, '錯開操作排程') })
    .getByText('支出 $60,000')).toBeVisible()
})

test('the launch window closes when failed evidence is left unresolved', async ({ page }) => {
  await start(page)
  await design(page)
  await page.getByRole('radio', { name: /Early radio profile/ }).check()
  await assemble(page, 'en', true)
  await button(page, labels.en.test).click()
  await button(page, labels.en.skip).click()
  await expect(page.getByText('First transmission was 20 minutes after separation. This ride requires at least 30 minutes.')).toBeVisible()
  await expect(page.locator('.report-speaker')).toHaveText('Communications')
  await summary(page, 'Other actions').click()
  await button(page, 'Advance one week').click()
  await button(page, 'Advance one week').click()
  await expect(heading(page, 'No launch')).toBeVisible()
  await expect(page.getByText('The launch slot closed before flight approval.')).toBeVisible()
  await expect(page.getByText('No in-orbit result')).toBeVisible()
})

test('Traditional Chinese mobile play supports reduced motion, alternative bench order and diagnostics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page, 'zh')
  await design(page, 'zh')
  await button(page, labels.zh.freeze).click()
  await page.getByRole('radio', { name: /先驗證供電/ }).check()
  await button(page, labels.zh.build).click()
  await expect(page.getByText('電力組用測試負載確認可供 10 W，接著交台給科學組。')).toBeVisible()
  await button(page, labels.zh.test).click()
  await button(page, labels.zh.review).click()
  await expect(page.getByRole('region', { name: '第一圈軌道' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('radio', { name: /優先下傳飛行診斷/ }).check()
  await button(page, labels.zh.pass).click()
  await expect(readout(page)).toHaveText('正在接收飛行診斷')
  await button(page, '登錄飛行診斷').click()
  await expect(heading(page, '已發射・交付未達標')).toBeVisible()
  await expect(page.getByText('已收到 0 批可用資料')).toBeVisible()
  await expect(page.getByText('已下傳飛行診斷')).toBeHidden()
  await summary(page, '整合驗證證據').click()
  await expect(page.getByRole('region', { name: '任務結算' }).getByText('可用 2 批／需 2 批')).toBeVisible()
  await summary(page, '實際交付成果').click()
  await expect(page.getByText('已下傳飛行診斷')).toBeVisible()
})

test('fast-forward and full playback end with the same saved mission', async ({ browser }) => {
  async function play(skip: boolean) {
    const page = await browser.newPage()
    try {
      await start(page)
      await design(page)
      await assemble(page, 'en', skip)
      await button(page, labels.en.test).click()
      if (skip) await button(page, labels.en.skip).click()
      await button(page, labels.en.review).click()
      await button(page, labels.en.pass).click()
      await finishDelivery(page, 2)
      await expect(heading(page, 'Mission delivered')).toBeVisible()
      return await saved(page)
    } finally {
      await page.close()
    }
  }
  const [full, skipped] = await Promise.all([play(false), play(true)])
  expect(skipped).toEqual(full)
})

test('a saved mission resumes at flight review and can archive a batch', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const design = { payload: 'basic', supply: 'standard', schedule: 'overlap', radio: 'compliant' }
    localStorage.setItem('space-mission.single.v2', JSON.stringify({
      missionId: 'cubesat', stage: 'review', week: 4, deadline: 6, credits: 45, design, revision: 0, gate: 'CDR',
      analysis: null, flight: null, stop: null, returned: false, event: null, events: [], records: [], log: [],
      evidence: {
        design, payloadWatts: 3, peak: 9, available: 10, deficit: 0, contactCapacity: 4, batches: 2, testedBatches: 2,
        ditl: { separation: 0, deploy: 15, firstTx: 32, elapsed: 32, threshold: 30 },
        powerPass: true, ditlPass: true, dataPass: true, checks: [true, true, true], week: 4, revision: 0,
      },
    }))
  })
  await page.reload()
  await button(page, 'Continue mission').click()
  await button(page, labels.en.review).click()
  await button(page, labels.en.pass).click()
  await finishDelivery(page, 1)
  await button(page, 'Keep in lab archive').click()
  await expect(heading(page, 'Launched · delivery incomplete')).toBeVisible()
  expect(await saved(page)).toMatchObject({ week: 4, credits: 45, flight: { batches: 1, archived: 1 } })
})
