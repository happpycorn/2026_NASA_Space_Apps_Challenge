import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, connectAuthEmulator, initializeAuth, signInAnonymously } from 'firebase/auth'
import {
  connectFirestoreEmulator, doc, getDocFromServer, getFirestore, onSnapshot, runTransaction,
} from 'firebase/firestore'
import { proposals, type Department } from '../missions/cubesat'
import type { MultiplayerRemedy } from '../missions/cubesat'
import { emulatorHost, firebaseConfig, multiplayerAvailable, useEmulators } from './config'
import { codeAlphabet, hasPlayerProposal, newRoom, proposalFor, roleFor, validCode, type Room } from './model'

export class RoomError extends Error {
  constructor(readonly reason: 'missing' | 'invalid' | 'closed' | 'taken' | 'role' | 'stale' | 'waiting' | 'network') {
    super(reason)
  }
}

function connect() {
  if (!multiplayerAvailable) throw new RoomError('network')
  const app = initializeApp(firebaseConfig, 'space-mission')
  const auth = initializeAuth(app, { persistence: browserLocalPersistence })
  const db = getFirestore(app)
  if (useEmulators) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true })
    connectFirestoreEmulator(db, emulatorHost, 8080)
  }
  return { auth, db }
}

let services: ReturnType<typeof connect> | undefined
let signIn: Promise<string> | undefined

export function roomIdentity() {
  const { auth } = services ??= connect()
  signIn ??= auth.authStateReady()
    .then(async () => (auth.currentUser ?? (await signInAnonymously(auth)).user).uid)
    .finally(() => { signIn = undefined })
  return signIn
}

function roomRef(code: string) {
  if (!validCode(code)) throw new RoomError('invalid')
  const { db } = services ??= connect()
  return doc(db, 'rooms', code)
}

function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), n => codeAlphabet[n % codeAlphabet.length]).join('')
}

export async function createRoom() {
  const uid = await roomIdentity()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode()
    const ref = roomRef(code)
    const created = await runTransaction(ref.firestore, async tx => {
      if ((await tx.get(ref)).exists()) return false
      tx.set(ref, newRoom(uid))
      return true
    })
    if (created) return code
  }
  throw new RoomError('network')
}

export async function openRoom(code: string) {
  const uid = await roomIdentity()
  const snapshot = await getDocFromServer(roomRef(code))
  if (!snapshot.exists()) throw new RoomError('missing')
  const room = snapshot.data() as Room
  if (room.decision && !roleFor(room, uid)) throw new RoomError('closed')
}

export function watchRoom(code: string, onRoom: (room: Room, fromCache: boolean) => void, onError: (error: unknown) => void) {
  return onSnapshot(roomRef(code), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.exists()) onRoom(snapshot.data() as Room, snapshot.metadata.fromCache)
    else if (!snapshot.metadata.fromCache) onError(new RoomError('missing'))
  }, onError)
}

export async function claimRole(code: string, department: Department) {
  const uid = await roomIdentity()
  const ref = roomRef(code)
  await runTransaction(ref.firestore, async tx => {
    const room = (await tx.get(ref)).data() as Room | undefined
    if (!room) throw new RoomError('missing')
    if (room.decision) throw new RoomError('closed')
    const existing = roleFor(room, uid)
    if (existing === department) return
    if (existing) throw new RoomError('role')
    if (room.roles[department]) throw new RoomError('taken')
    tx.update(ref, `roles.${department}`, uid)
  })
}

export async function submitProposal(code: string, department: Department, roundId: string, remedy: MultiplayerRemedy) {
  const uid = await roomIdentity()
  const ref = roomRef(code)
  await runTransaction(ref.firestore, async tx => {
    const room = (await tx.get(ref)).data() as Room | undefined
    if (!room) throw new RoomError('missing')
    if (room.roles[department] !== uid) throw new RoomError('role')
    if (room.decision) throw new RoomError('closed')
    if (room.roundId !== roundId || !(proposals[department].options as readonly string[]).includes(remedy)) throw new RoomError('stale')
    tx.update(ref, `proposals.${department}`, { roundId, remedy })
  })
}

export async function confirmRoom(code: string, department: Department, roundId: string, remedy: MultiplayerRemedy) {
  const uid = await roomIdentity()
  const ref = roomRef(code)
  try {
    return await runTransaction(ref.firestore, async tx => {
      const room = (await tx.get(ref)).data() as Room | undefined
      if (!room) throw new RoomError('missing')
      if (room.roles.pm !== uid) throw new RoomError('role')
      if (room.roundId !== roundId) throw new RoomError('stale')
      if (room.decision) return room.decision
      if (!hasPlayerProposal(room)) throw new RoomError('waiting')
      if (proposalFor(room, department).remedy !== remedy) throw new RoomError('stale')
      const decision = { department, roundId, remedy }
      tx.update(ref, { decision })
      return decision
    })
  } catch (error) {
    // Rules may reject a concurrent commit after another PM tab closes the round.
    if (error instanceof Error && 'code' in error && error.code === 'permission-denied') {
      const latest = (await getDocFromServer(ref)).data() as Room | undefined
      if (latest?.roles.pm === uid && latest.roundId === roundId && latest.decision) return latest.decision
    }
    throw error
  }
}
