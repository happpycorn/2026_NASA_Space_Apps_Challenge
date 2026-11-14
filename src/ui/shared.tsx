import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cubeSat } from '../missions/cubesat'
import type { Design, DesignOption, MissionRules, TestResult } from '../game/types'
import type { MissionModule } from '../missions'
import type { Translate } from '../i18n'

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function money(credits: number) {
  return dollars.format(credits * cubeSat.dollarsPerCredit)
}

export function ActionButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className="button primary" {...props}>{children}<ArrowRight size={17} aria-hidden /></button>
}

export function Back({ t, onClick }: { t: Translate; onClick: () => void }) {
  return <button className="text-button back" onClick={onClick}><ArrowLeft size={16} aria-hidden />{t('back')}</button>
}

export function Heading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <header className="section-heading">
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h1>{title}</h1>
    {children && <p>{children}</p>}
  </header>
}

export function Disclosure({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return <details className="disclosure">
    <summary><span>{label}</span>{value !== undefined && <span className="disclosure-value">{value}</span>}</summary>
    <div className="disclosure-body">{children}</div>
  </details>
}

export function CostLabel({ t, weeks, credits }: { t: Translate; weeks: number; credits: number }) {
  return <span className="cost">{t('weeks', { count: weeks })} · {money(credits)}</span>
}

export function optionValues({ params, cost, ...option }: DesignOption) {
  return { ...option, ...params, ...(cost === undefined ? {} : { cost: money(cost) }) }
}

export function DesignSummary({ mission, design, t }: { mission: MissionRules; design: Design; t: Translate }) {
  return <dl className="fact-list">
    {Object.entries(mission.groups).map(([key, group]) =>
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
