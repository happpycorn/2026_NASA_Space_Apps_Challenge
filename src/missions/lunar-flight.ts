import type { Copy, FlightContext, FlightSegment, MissionRules, SegmentChoice } from '../game/types'
import { lunarFlight, lunarMission as mission, lunarPlanBatches, type LunarFlightResult, type LunarFlightUpdate, type LunarPlan, type LunarRisk } from './lunar-mission'
import { lunarDesign, lunarFlightRevised, lunarState, lunarStates, massBudget, missionFile } from './lunar-rules'

type Decision = Extract<LunarFlightUpdate, { type: 'decision' }>
type StoryChoice = { id: string; label: SegmentChoice['label']; detail: Copy['message']; result?: Copy['message'];
  effect?: { credits?: number; propellantKg?: number; windows?: number } }

function replay({ game, progress }: FlightContext, id: string, decisions: string[]) {
  const state = lunarState(game)
  const simulation = lunarFlight(game.seed, {
    design: lunarDesign(game), states: lunarStates(game), marginKg: massBudget(game, true).margin,
    credits: game.credits, revised: lunarFlightRevised(game), responseReserves: state.responseReserves, secondPayload: state.secondPayload, icd: state.icd ?? undefined,
    legacyLaunchOrder: progress.state.legacyLaunchOrder === true,
  })
  let next = simulation.next()
  let step = 0
  while (!next.done) {
    const update = next.value
    if (update.type === 'segment') {
      if (mission.segments.findIndex(segment => segment.id === update.segment) > progress.steps.length) return { boundary: update }
      next = simulation.next(null)
      continue
    }
    if (step === decisions.length) return { decision: update }
    next = simulation.next(decisions[step++])
  }
  return { result: next.value, imaging: next.value.segment === id && (!lunarFlightRevised(game) || (id === 'descent' && !decisions.includes('Abort')))
      && (next.value.outcome === 'lost' || next.value.outcome === 'salvage') &&
      !next.value.engineering && progress.state.imaging === undefined }
}

const savedDecisions = (context: FlightContext) => (context.progress.state.decisions ?? []) as string[]
// The low-rate backup channel makes every batch take one more window to downlink.
const downlinkWindows = (context: FlightContext) => mission.downlinkWindows + (savedDecisions(context).includes('LowRate') ? 1 : 0)

function describe(prompt: string, context: FlightContext, decision?: Decision) {
  if (prompt === 'plan') return { choices: Object.entries({ ...mission.surfacePlans, hosted: mission.hostedPlan }).map(([id, plan]) => ({ id, label: plan.label, detail: plan.description })) }
  if (prompt === 'night') return { choices: Object.entries(mission.nightPlans).map(([id, plan]) => ({ id, label: plan.label, detail: plan.description })) }
  const [kind, id] = prompt.split(':')
  if (kind === 'card') {
    const card = [...mission.launchCards, ...mission.cruiseCards, ...mission.lossCards].find(item => item.id === id)!
    return { choices: card.choices, file: missionFile(card), brief: { message: card.detail } as Copy, quote: card.quote }
  }
  const risk = id as Exclude<LunarRisk, 'night'>
  const item = mission.risks[risk]
  return { choices: mission.responses[risk], file: missionFile(item), brief: { message: item.failure, values: { kg: mission.pressureLossKg } } as Copy,
    quote: item.quote, softwareCost: decision && lunarState(context.game).icd === 'reviewed' ? 0 : 6 + (lunarState(context.game).icd === 'open' ? mission.uplinkOpenExtra : 0) }
}

function reportFor(segment: string, result: LunarFlightResult | undefined): Copy {
  if (result?.outcome === 'lost' || result?.outcome === 'salvage') {
    if (result.critical === 'reserve') return { message: 'lunarTransferFail', values: result.reserveFailure ?? { need: -result.spareKg, margin: 0 } }
    if (result.critical !== 'choice' && result.critical !== 'windows') return { message: mission.risks[result.critical].failure, values: { kg: mission.pressureLossKg } }
  }
  if (result) return { message: 'lunarGroundReceipt', values: { count: result.batches } }
  if (segment === 'descent') return { message: 'lunarLandingComplete' }
  return { message: 'lunarSegmentComplete' }
}

const segments: FlightSegment[] = mission.segments.map(segment => {
  const { id } = segment
  function state(context: FlightContext) {
    const stage = replay(context, id, savedDecisions(context))
    const prompt = stage.imaging ? 'card:Imaging' : stage.decision?.prompt
    const options = stage.imaging ? ['Share', 'Decline'] : stage.decision?.options
    const description = prompt ? describe(prompt, context, stage.decision) : undefined
    return { ...stage, description, options, prompt }
  }
  return {
    id, title: segment.label,
    brief: context => state(context).description?.brief ?? { message: segment.carried },
    file: context => state(context).description?.file,
    quote: context => state(context).description?.quote,
    status: (context): Copy | undefined => {
      const { decision, prompt, boundary } = state(context)
      const view = decision?.view
      // Every surface decision shows the window budget, so a window spent on the eclipse is weighed against the batches.
      if (view && (prompt === 'plan' || decision?.segment === 'surface')) {
        const { each } = lunarPlanBatches(lunarDesign(context.game), 'extra', view.windows, downlinkWindows(context))
        return { message: 'lunarSurfaceBudget', values: { windows: view.windows, each, kg: view.spareKg, credits: view.credits } }
      }
      if (view || boundary) {
        const actual = view ?? boundary!.view
        return { message: 'chapterFlightResources', values: { kg: actual.spareKg, credits: actual.credits, windows: actual.windows } }
      }
    },
    choices: context => {
      const { description, options, decision, prompt } = state(context)
      if (!description || !options) return []
      const d = lunarDesign(context.game)
      const view = decision?.view
      const windows = view?.windows ?? 0
      const downlink = view?.downlink ?? mission.downlinkWindows
      return (description.choices as readonly StoryChoice[]).filter(choice => options.includes(choice.id)).map(choice => {
        const surfaceResponse = prompt === 'card:Eclipse' || prompt === 'risk:payload'
        const consumed = choice.id === 'Restart' ? view?.restartCost ?? 1 : Math.abs(choice.effect?.windows ?? 0)
        const countAfter = surfaceResponse ? choice.id === 'Engineering' ? 0
          : lunarPlanBatches(d, 'extra', windows - consumed, downlink + Number(choice.id === 'LowRate')).batches : undefined
        const surfacePlan = prompt === 'plan' ? lunarPlanBatches(d, choice.id as LunarPlan, windows, downlink) : undefined
        return {
          id: choice.id, label: choice.label, prompt, resources: view,
          ...(countAfter !== undefined && lunarFlightRevised(context.game) && {
            consequence: { message: 'lunarProjectedScience' as const, values: { count: countAfter } },
            warning: countAfter === 0,
          }),
          detail: { message: choice.detail, values: {
            credits: prompt === 'risk:software' && choice.id === 'Uplink' ? description.softwareCost!
              : prompt === 'night' ? mission.wakeCredits : Math.abs(choice.effect?.credits ?? 0),
            kg: Math.abs(choice.effect?.propellantKg ?? 0),
            windows: prompt === 'night' ? mission.wakeWindows
              : choice.id === 'Switch' ? mission.tiltedWindows : consumed,
            more: view?.more ?? 0,
            result: surfacePlan?.batches ?? 0,
            count: choice.id === 'diagnostics' ? mission.surfacePlans.diagnostics.reservedWindows : surfacePlan?.batches ?? 0,
          } },
        }
      })
    },
    resolve: (context, choice): ReturnType<FlightSegment['resolve']> => {
      const current = state(context)
      const decisions = savedDecisions(context)
      const selected = (current.description?.choices as readonly StoryChoice[] | undefined)?.find(item => item.id === choice)
      const report: Copy | undefined = selected?.result ? { message: selected.result } : undefined
      if (current.imaging && current.result) return {
        end: true, report, state: { decisions, result: current.result, imaging: choice === 'Share' },
      }
      const nextDecisions = choice === null ? decisions : [...decisions, choice]
      const next = replay(context, id, nextDecisions)
      const nextState = { ...context.progress.state, decisions: nextDecisions }
      // A ground response clears the event. The launch segment still awaits countdown.
      const groundResponse = id === 'launch' && choice !== null && next.boundary?.segment === 'checkout'
        && context.progress.state.legacyLaunchOrder !== true
      if (next.imaging || next.decision || groundResponse) return { continued: true, report, state: nextState }
      return {
        end: Boolean(next.result), report: report ?? reportFor(id, next.result),
        state: { ...nextState, ...(next.result && { result: next.result }) },
      }
    },
  }
})

export const lunarSegments: NonNullable<MissionRules['segmentedFlight']> = {
  segments,
  finish: ({ progress }) => {
    const result = progress.state.result as LunarFlightResult
    return { ...result, choice: progress.steps.at(-1)?.choice ?? 'rest', siteConfirmed: progress.state.imaging === true,
      delivered: result.outcome === 'success' || result.outcome === 'extra', stretch: result.outcome === 'extra' }
  },
}
