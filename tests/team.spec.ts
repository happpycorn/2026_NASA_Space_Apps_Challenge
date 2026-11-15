import { expect, test, type Page } from '@playwright/test'

const roomFixture = '/tests/room-fixture.ts'

async function host(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Team review' }).click()
  await page.getByRole('button', { name: 'Create room as PM' }).click()
  const code = page.locator('.room-code-display code')
  await expect(code).toHaveText(/^[A-Z2-9]{8}$/)
  return (await code.textContent())!
}

async function join(page: Page, code: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Team review' }).click()
  await page.getByRole('textbox', { name: 'Room code' }).fill(code)
  await page.getByRole('button', { name: 'Find room' }).click()
  await expect(page.getByRole('heading', { name: 'Choose a department' })).toBeVisible()
}

test.describe('Firebase emulator', () => {
  test.skip(process.env.PLAYWRIGHT_EMULATORS !== 'true', 'Run with the Auth and Firestore emulators')
  test.setTimeout(60_000)

  test('separate identities join, revise, confirm once and recover the localized result', async ({ browser }) => {
    const hostContext = await browser.newContext({ locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'] })
    const guestContext = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const pm = await hostContext.newPage()
    const guest = await guestContext.newPage()
    try {
      const code = await host(pm)
      await pm.getByRole('button', { name: 'Copy room code' }).click()
      await expect(pm.getByRole('status').filter({ hasText: 'Room code copied.' })).toBeVisible()
      const copied = await pm.evaluate(() => navigator.clipboard.readText())
      expect(copied).toBe(code)
      await expect(pm.getByRole('button', { name: 'Confirm and retest' })).toBeDisabled()
      await join(guest, copied)
      await guest.getByRole('button', { name: 'Science Open' }).click()
      await expect(guest.locator('.proposal-panel .report-speaker').filter({ hasText: /^Science$/ })).toBeVisible()
      await expect(guest.getByRole('button', { name: 'Confirm and retest' })).toHaveCount(0)
      await guest.getByRole('radio', { name: /Stagger operations/ }).check()
      await guest.getByRole('button', { name: 'Send proposal' }).click()
      const scienceProposal = pm.getByRole('radio', { name: /Science.*Player proposal.*Stagger operations/ })
      await scienceProposal.check()

      await guest.getByRole('radio', { name: /Switch to baseline imager/ }).check()
      await guest.getByRole('button', { name: 'Update proposal' }).click()
      await expect(pm.getByText('The proposal changed.', { exact: false })).toBeVisible()
      await expect(pm.getByRole('button', { name: 'Confirm and retest' })).toBeDisabled()

      const denied = await guest.evaluate(async ({ path, code }) => {
        const fixture: typeof import('./room-fixture') = await import(path)
        return fixture.roomWrites(code)
      }, { path: roomFixture, code })
      expect(denied).toEqual(Array(7).fill('permission-denied'))

      await guest.getByRole('button', { name: '繁中' }).click()
      await guest.reload()
      await expect(guest.locator('.proposal-panel .report-speaker').filter({ hasText: /^科學組$/ })).toBeVisible()
      await expect(guest.getByRole('radio', { name: /換成基本成像儀/ })).toBeChecked()
      await expect(pm.getByRole('radio', { name: /Power.*Game proposal.*Upgrade power supply/ })).toBeVisible()
      await pm.getByRole('radio', { name: /Science.*Player proposal.*Switch to baseline imager/ }).check()
      await pm.getByRole('button', { name: 'Confirm and retest' }).click()
      await expect(pm.getByRole('heading', { name: 'Integration passed' })).toBeVisible()
      await expect(guest.getByRole('heading', { name: '整合通過' })).toBeVisible()
      await expect(guest.getByText('修正與重測 · 2 週 · $180,000')).toBeVisible()

      const repeats = await pm.evaluate(async ({ path, code }) => {
        const fixture: typeof import('./room-fixture') = await import(path)
        return fixture.confirmTwice(code, 'science', 'basic')
      }, { path: roomFixture, code })
      expect(repeats).toEqual(Array(2).fill({ department: 'science', roundId: 'integration-1', remedy: 'basic' }))

      const [pmState, guestState] = await Promise.all([pm, guest].map((page: Page) => page.evaluate(async ({ path, code }) => {
        const fixture: typeof import('./room-fixture') = await import(path)
        return fixture.finalizedRoom(code)
      }, { path: roomFixture, code })))
      expect(pmState.uid).not.toBe(guestState.uid)
      expect(pmState.data?.roles.pm).toBe(pmState.uid)
      expect(pmState.data?.roles.science).toBe(guestState.uid)
      expect(guestState.data?.decision).toEqual(pmState.data?.decision)
      expect(pmState.writes).toEqual(['permission-denied', 'permission-denied'])
      expect(guestState.writes).toEqual(['permission-denied', 'permission-denied'])

      await Promise.all([pm.reload(), guest.reload()])
      await expect(pm.getByRole('heading', { name: 'Integration passed' })).toBeVisible()
      await expect(guest.getByRole('heading', { name: '整合通過' })).toBeVisible()
      await expect(guest.getByText('第 6 週 · 設計版本 1')).toBeHidden()
      await guest.locator('summary').filter({ hasText: '整合驗證證據' }).click()
      await expect(guest.getByText('第 6 週 · 設計版本 1')).toBeVisible()
      expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    } finally {
      await Promise.all([hostContext.close(), guestContext.close()])
    }
  })
})

test('a four-player room stores only the winning decision during concurrent confirmation', async ({ browser }) => {
  test.skip(process.env.PLAYWRIGHT_EMULATORS !== 'true', 'Run with the Auth and Firestore emulators')
  test.setTimeout(60_000)
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ locale: 'en-US' })))
  const [pm, science, power, comms] = await Promise.all(contexts.map(context => context.newPage()))
  try {
    const code = await host(pm)
    await Promise.all([
      [science, 'Science'], [power, 'Power'], [comms, 'Communications'],
    ].map(async ([page, label]) => {
      const guest = page as Page
      await join(guest, code)
      await guest.getByRole('button', { name: `${label} Open` }).click()
      await expect(guest.locator('.proposal-panel .report-speaker').filter({ hasText: label as string })).toBeVisible()
    }))

    await science.getByRole('radio', { name: /Switch to baseline imager/ }).check()
    await science.getByRole('button', { name: 'Send proposal' }).click()
    await power.getByRole('radio', { name: /Upgrade power supply/ }).check()
    await power.getByRole('button', { name: 'Send proposal' }).click()
    await expect(pm.getByRole('radio', { name: /Science.*Player proposal.*Switch to baseline imager/ })).toBeVisible()
    await expect(pm.getByRole('radio', { name: /Power.*Player proposal.*Upgrade power supply/ })).toBeVisible()

    const decisions = await pm.evaluate(async ({ path, code }) => {
      const fixture: typeof import('./room-fixture') = await import(path)
      return fixture.confirmTwice(code, 'science', 'basic')
    }, { path: roomFixture, code })
    expect(decisions[0]).toEqual(decisions[1])
    expect(['basic', 'reinforced']).toContain(decisions[0].remedy)
    const winningText = decisions[0].remedy === 'basic' ? 'Switch to baseline imager' : 'Upgrade power supply'
    await Promise.all([pm, science, power, comms].map(async page => {
      await expect(page.getByRole('heading', { name: 'Integration passed' })).toBeVisible()
      await expect(page.getByText(new RegExp(`Confirmed correction.*${winningText}`))).toBeVisible()
    }))
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
})
