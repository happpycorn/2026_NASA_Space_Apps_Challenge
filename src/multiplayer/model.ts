import { departments, proposals, type Department } from '../missions/cubesat'
import type { MultiplayerRemedy } from '../missions/cubesat'

export const roles = ['pm', ...departments] as const
export type Role = typeof roles[number]
export type Proposal = { roundId: string; remedy: MultiplayerRemedy }
export type Decision = Proposal & { department: Department }
export type Room = {
  scenario: 'cubesat-power-v1'
  roundId: 'integration-1'
  roles: Record<Role, string | null>
  proposals: Record<Department, Proposal | null>
  decision: Decision | null
}

export const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function validCode(code: string) {
  return code.length === 8 && [...code].every(letter => codeAlphabet.includes(letter))
}

export function roleFor(room: Room, uid: string) {
  return roles.find(role => room.roles[role] === uid)
}

export function newRoom(uid: string): Room {
  return {
    scenario: 'cubesat-power-v1',
    roundId: 'integration-1',
    roles: { pm: uid, science: null, power: null, comms: null },
    proposals: { science: null, power: null, comms: null },
    decision: null,
  }
}

export function proposalFor(room: Room, department: Department) {
  const proposal = room.proposals[department]
  if (proposal?.roundId === room.roundId) return { remedy: proposal.remedy, automatic: false }
  return { remedy: proposals[department].fallback, automatic: true }
}

export function hasPlayerProposal(room: Room) {
  return departments.some(department => !proposalFor(room, department).automatic)
}
