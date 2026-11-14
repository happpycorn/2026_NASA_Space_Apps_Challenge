import { AudioLines, Camera, ClipboardCheck, FlaskConical, Radio, Wrench, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Message, Translate } from '../i18n'

const speakers = {
  science: { label: 'science', icon: Camera },
  power: { label: 'power', icon: Zap },
  comms: { label: 'comms', icon: Radio },
  assembly: { label: 'speakerAssembly', icon: Wrench },
  test: { label: 'speakerTest', icon: FlaskConical },
  review: { label: 'speakerReview', icon: ClipboardCheck },
  ground: { label: 'speakerGround', icon: AudioLines },
} as const satisfies Record<string, { label: Message; icon: typeof Camera }>

export function ReportCard({ speaker, t, attention = false, children }: {
  speaker: keyof typeof speakers; t: Translate; attention?: boolean; children: ReactNode
}) {
  const { label, icon: Icon } = speakers[speaker]
  return <div className={attention ? 'desk-report attention' : 'desk-report'}>
    <span className="report-icon"><Icon size={16} strokeWidth={1.7} aria-hidden /></span>
    <div>
      <div className="report-speaker">{t(label)}</div>
      <div className="report-words">{children}</div>
    </div>
  </div>
}
