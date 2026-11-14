import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { collection, doc, getDocFromServer, getDocsFromServer, getFirestore, updateDoc } from 'firebase/firestore'
import { confirmRoom } from '../src/multiplayer/client'
import type { Department, MultiplayerRemedy } from '../src/missions/cubesat'

function services(code: string) {
  const app = getApp('space-mission')
  const db = getFirestore(app)
  const uid = getAuth(app).currentUser!.uid
  return { db, uid, ref: doc(db, 'rooms', code) }
}

export async function roomWrites(code: string) {
  const { db, uid, ref } = services(code)
  const decisions = { department: 'science', remedy: 'basic', roundId: 'integration-1' }
  const operations = [
    () => updateDoc(ref, { 'roles.power': uid }),
    () => updateDoc(ref, { 'roles.pm': uid }),
    () => updateDoc(ref, { 'proposals.power': { roundId: 'integration-1', remedy: 'reinforced' } }),
    () => updateDoc(ref, { 'proposals.science': { roundId: 'integration-1', remedy: 'reinforced' } }),
    () => updateDoc(ref, { 'proposals.science': { roundId: 'integration-0', remedy: 'basic' } }),
    () => updateDoc(ref, { decision: decisions }),
    () => getDocsFromServer(collection(db, 'rooms')),
  ]
  return Promise.all(operations.map(async operation => {
    try { await operation(); return 'allowed' }
    catch (error) { return (error as { code: string }).code }
  }))
}

export async function confirmTwice(code: string, department: Department, remedy: MultiplayerRemedy) {
  return Promise.all([
    confirmRoom(code, department, 'integration-1', remedy),
    confirmRoom(code, 'power', 'integration-1', 'reinforced'),
  ])
}

export async function finalizedRoom(code: string) {
  const { uid, ref } = services(code)
  const snapshot = await getDocFromServer(ref)
  const data = snapshot.data()
  const writes = await Promise.allSettled([
    updateDoc(ref, { decision: null }),
    updateDoc(ref, { 'proposals.science': { roundId: 'integration-1', remedy: 'stagger' } }),
  ])
  return {
    uid,
    data,
    writes: writes.map(result => result.status === 'rejected' ? result.reason.code : result.status),
  }
}
