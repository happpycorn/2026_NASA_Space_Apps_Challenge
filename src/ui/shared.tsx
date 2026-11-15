import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cubeSat } from '../missions/cubesat'
import type { Design, DesignOption, MissionRules, TestResult } from '../game/types'
import type { MissionModule } from '../missions'
import type { Translate } from '../i18n'

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function money(credits: number) {
  return dollars.format(credits * cubeSat.dollarsPerCredit)
}

export function missionMoney(mission: MissionRules, credits: number, t: Translate) {
  return mission.id === cubeSat.id && !mission.tasks ? money(credits) : t('credits', { count: credits })
}

export function ActionButton({ children, ...props }: ComponentPropsWithRef<'button'>) {
  return <button type="button" className="button primary" {...props}>{children}<ArrowRight size={17} aria-hidden /></button>
}

export function Back({ t, onClick }: { t: Translate; onClick: () => void }) {
  return <button className="text-button back" onClick={onClick}><ArrowLeft size={16} aria-hidden />{t('back')}</button>
}

export function Heading({ eyebrow, title, children, focusable = false }: { eyebrow?: string; title: string; children?: ReactNode; focusable?: boolean }) {
  return <header className="section-heading">
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h1 tabIndex={focusable ? -1 : undefined}>{title}</h1>
    {children && <p>{children}</p>}
  </header>
}

export function Disclosure({ label, value, children, open }: { label: string; value?: ReactNode; children: ReactNode; open?: boolean }) {
  return <details className="disclosure" open={open}>
    <summary><span>{label}</span>{value !== undefined && <span className="disclosure-value">{value}</span>}</summary>
    <div className="disclosure-body">{children}</div>
  </details>
}

export function CostLabel({ t, weeks, credits, mission }: { t: Translate; weeks: number; credits: number; mission?: MissionRules }) {
  return <span className="cost">{t('weeks', { count: weeks })} · {mission ? missionMoney(mission, credits, t) : money(credits)}</span>
}

export function optionValues({ params, cost, ...option }: DesignOption, mission: MissionRules, t: Translate) {
  return { ...option, ...params, ...(cost === undefined ? {} : { cost: mission.id === cubeSat.id ? missionMoney(mission, cost, t) : cost }) }
}

export function DesignSummary({ mission, design, t }: { mission: MissionRules; design: Design; t: Translate }) {
  return <dl className="fact-list">
    {Object.entries(mission.groups).filter(([key, group]) => Object.hasOwn(group.options, design[key] ?? '')).map(([key, group]) =>
      <div key={key}><dt>{t(group.legend)}</dt><dd>{t(group.options[design[key]].label)}</dd></div>)}
  </dl>
}

export function EvidenceReport({ mission, evidence, t, outdated }: {
  mission: MissionModule; evidence: TestResult & { week?: number; revision?: number }; t: Translate; outdated?: boolean
}) {
  return <div className="report">
    {outdated && <p className="notice">{t('oldReport')}</p>}
    {evidence.week !== undefined && <small>{t('evidenceWeek', { week: evidence.week, revision: evidence.revision ?? 0 })}</small>}
    <mission.ui.Report evidence={evidence} t={t} />
  </div>
}
