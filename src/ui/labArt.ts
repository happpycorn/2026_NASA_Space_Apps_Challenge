import type { CubeSatDesign } from '../missions/cubesat'
import type { Department } from '../missions/cubesat'

const ink = '#182f45'
const navy = '#294860'
const blue = '#547387'
const steel = '#9aadb3'
const white = '#e9ece1'
const wall = '#e4e2d9'
const shadow = '#b4b9b1'
const floor = '#cbc9bc'
const signal = '#a7d9d3'
const alarm = '#e68147'
const teams = [
  { x: 69, id: 'science', coat: '#ecece0', trim: '#5d8494', skin: '#be8b77', hair: '#2c3844' },
  { x: 161, id: 'power', coat: '#668093', trim: '#a9c3c3', skin: '#8c645b', hair: '#222d3c' },
  { x: 251, id: 'comms', coat: '#405d76', trim: '#aec5cb', skin: '#d3aa91', hair: '#453d4c' },
] as const

export type LabArt = {
  design: CubeSatDesign
  active: readonly Department[]
  comparing?: Department
  assemblyStep: number
  installed: readonly Department[]
  warning: boolean
  orbit: boolean
  receiving: boolean
  received: number
}

export function drawLab(ctx: CanvasRenderingContext2D, art: LabArt, frame: number) {
  const { design, active, installed, warning, orbit, receiving, received } = art
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }

  function monitor(x: number, y: number, w: number, powered: boolean) {
    rect(ink, x, y, w, 23)
    rect(blue, x + 1, y + 1, w - 2, 1)
    rect(powered ? navy : '#20394d', x + 3, y + 3, w - 6, 15)
    rect(blue, x + 4, y + 20, 3, 1)
    rect(powered ? signal : blue, x + w - 5, y + 20, 2, 1)
    rect(blue, x + w / 2 - 2, y + 23, 4, 4)
    rect(ink, x + w / 2 - 6, y + 27, 12, 2)
    if (!powered) return
    rect(blue, x + 6, y + 7, w - 12, 1)
    rect(blue, x + 6, y + 14, w - 12, 1)
    const wave = warning ? alarm : signal
    const samples = [0, 0, 3, 7, 3, 1, 1]
    samples.forEach((_, index) => rect(wave, x + 6 + index * 3, y + 14 - samples[(index + frame) % samples.length], 3, 1))
  }

  function satellite(x: number, y: number, flight = false) {
    const lens = design.payload === 'advanced' ? 10 : 7
    rect(navy, x, y + 4, 33, 27)
    rect(ink, x + 33, y + 4, 13, 27)
    rect(steel, x + 5, y, 41, 4)
    rect(white, x + 5, y + 4, 28, 2)
    rect(steel, x + 3, y + 6, 2, 23)
    rect(steel, x + 30, y + 6, 2, 23)
    rect(blue, x + 35, y + 7, 8, 21)
    rect(steel, x + 2, y + 28, 43, 3)
    for (const bolt of [8, 26, 39]) rect(white, x + bolt, y + 28, 2, 2)
    if (installed.includes('science')) {
      rect(ink, x + 17 - Math.floor(lens / 2), y + 9, lens, lens + 3)
      rect(active.includes('science') ? signal : steel, x + 15, y + 11, lens - 4, lens - 2)
      rect(blue, x + 15, y + 13, lens - 5, 2)
    } else {
      rect(ink, x + 9, y + 9, 17, 15)
      rect(blue, x + 10, y + 21, 14, 2)
    }
    if (installed.includes('power')) {
      const cells = design.supply === 'reinforced' ? 3 : 2
      for (let cell = 0; cell < cells; cell += 1) {
        rect(ink, x + 36, y + 10 + cell * 5, 6, 4)
        rect(signal, x + 37, y + 11 + cell * 5, 3, 1)
      }
    }
    if (installed.includes('comms')) {
      rect(steel, x + 35, y - 4, 4, 7)
      rect(steel, x + 38, y - 7, 7, 2)
      rect(active.includes('comms') ? warning ? alarm : signal : blue, x + 25, y + 8, 2, 2)
    }
    if (flight) {
      for (const side of [-28, 46]) {
        rect(steel, x + side, y + 14, 28, 3)
        rect(navy, x + side, y + 7, 28, 18)
        for (let cell = 2; cell < 27; cell += 5) rect(blue, x + side + cell, y + 9, 3, 14)
      }
    }
  }

  function crew(member: typeof teams[number]) {
    const { x, id, coat, trim, skin, hair } = member
    const working = active.includes(id)
    const y = working ? 82 : 92
    rect('#a5aba5', x - 13, 128, 27, 3)
    rect(ink, x - 8, 116, 6, 12)
    rect(ink, x + 3, 116, 6, 12)
    rect(navy, x - 10, 125, 9, 4)
    rect(navy, x + 3, 125, 9, 4)
    rect(ink, x - 11, y + 15, 23, 118 - y - 15)
    rect(coat, x - 9, y + 16, 19, 115 - y - 16)
    rect(trim, x - 8, y + 16, 16, 2)
    rect(ink, x - 2, y + 19, 4, 2)
    rect(white, x - 7, y + 23, 4, 3)
    rect(hair, x - 8, y + 1, 17, 13)
    rect(hair, x - 6, y - 2, 13, 3)
    rect(skin, x - 6, y + 5, 13, 9)
    rect(skin, x - 3, y + 14, 7, 3)
    rect(hair, x - 6, y + 3, 11, 3)
    rect(ink, x + 3, y + 8, 2, 2)
    if (id === 'science') {
      rect(blue, x - 6, y + 7, 6, 3)
      rect(steel, x - 5, y + 7, 3, 1)
    }
    if (id === 'comms') {
      rect(steel, x - 8, y + 4, 3, 8)
      rect(steel, x - 6, y + 11, 6, 1)
    }
    if (working) {
      const hand = y + 20 + frame % 2
      rect(coat, x + 9, hand, 9, 4)
      rect(skin, x + 17, hand - 1, 5, 5)
      rect(ink, x + 22, hand, id === 'comms' ? 3 : 5, 2)
      rect(warning ? alarm : navy, x - 2, y - 10, 4, 4)
    } else {
      rect(coat, x - 12, y + 18, 3, 9)
      rect(skin, x - 12, y + 26, 3, 4)
    }
  }

  if (orbit) {
    rect('#142942', 0, 0, 320, 140)
    for (const [x, y] of [[9, 21], [29, 49], [48, 15], [88, 28], [112, 10], [117, 72], [134, 36], [175, 16], [200, 83], [210, 26], [243, 12], [271, 23], [302, 51], [285, 65], [184, 60], [312, 12]]) {
      rect(steel, x, y, 2, 2)
    }
    for (const [index, inset] of [97, 72, 54, 43, 29, 20, 14, 7, 2, 0].entries()) {
      rect(index < 2 ? '#7da2a8' : index < 5 ? '#37617e' : navy, inset, 80 + index * 6, 320 - inset * 2, 6)
    }
    for (const [x, y, w] of [[43, 110, 35], [56, 115, 62], [82, 120, 50], [205, 97, 32], [187, 102, 59], [193, 107, 34]]) {
      rect('#567a84', x, y, w, 5)
    }
    satellite(66, 46, true)
    if (receiving) {
      for (const [index, x] of [124, 136, 148, 160, 172, 184, 196, 208, 220, 232].entries()) {
        rect(index % 3 === (received + frame) % 3 ? white : signal, x, 64 + index * 3, 5, 1)
      }
    }
    rect('#101f32', 228, 124, 92, 16)
    rect(ink, 240, 116, 56, 8)
    rect(steel, 266, 101, 5, 18)
    rect(white, 250, 87, 31, 4)
    rect(steel, 254, 91, 24, 4)
    rect(blue, 258, 95, 17, 4)
    rect(white, 263, 80, 2, 8)
    rect(receiving ? signal : blue, 262, 78, 4, 3)
    for (let packet = 0; packet < received; packet += 1) rect(signal, 244 + packet * 7, 119, 4, 2)
    return
  }

  rect(wall, 0, 0, 320, 140)
  rect('#f0eee5', 0, 0, 320, 12)
  rect(shadow, 0, 80, 320, 3)
  rect(floor, 0, 83, 320, 57)
  rect(shadow, 0, 110, 320, 1)
  rect(shadow, 0, 133, 320, 1)
  for (const x of [23, 103, 217, 297]) rect(shadow, x, 111, 1, 29)

  // Observation window, overhead bench light, and pegboard.
  rect(shadow, 15, 17, 70, 36)
  rect(navy, 17, 17, 66, 33)
  rect('#b8c6c7', 20, 20, 60, 27)
  rect('#d2dad4', 20, 20, 60, 13)
  rect('#a3b4b7', 25, 38, 18, 9)
  rect('#a3b4b7', 46, 34, 28, 13)
  rect(navy, 49, 19, 2, 29)
  rect(white, 124, 5, 72, 4)
  rect(steel, 132, 3, 56, 2)
  rect(shadow, 236, 19, 66, 33)
  rect('#d2d4cc', 238, 21, 62, 29)
  for (let y = 23; y < 50; y += 5) {
    for (let x = 241; x < 298; x += 5) rect(shadow, x, y, 1, 1)
  }
  for (const x of [247, 257, 276, 289]) {
    rect(blue, x, 27, 3, 13)
    rect(navy, x - 1, 26, 5, 3)
  }
  rect(white, 101, 20, 119, 2)
  rect(shadow, 101, 23, 119, 1)

  // The side stations share the central test bench.
  for (const x of [13, 232]) {
    rect(navy, x, 77, 75, 23)
    rect(steel, x, 75, 75, 4)
    rect(blue, x + 3, 80, 69, 13)
    rect(ink, x + 3, 94, 69, 2)
    rect(white, x + 27, 83, 15, 2)
  }
  monitor(27, 47, 35, active.includes('science'))
  monitor(267, 47, 32, active.includes('comms'))
  monitor(102, 42, 36, active.includes('power') || art.comparing === 'power')
  rect(navy, 93, 105, 136, 7)
  rect(shadow, 93, 121, 136, 3)
  rect(ink, 99, 100, 5, 24)
  rect(ink, 218, 100, 5, 24)
  rect(blue, 90, 86, 142, 14)
  rect(steel, 90, 85, 142, 4)
  rect(white, 91, 84, 140, 2)
  rect(navy, 115, 91, 92, 5)
  rect(ink, 119, 89, 84, 2)
  rect(ink, 189, 73, 23, 13)
  rect(navy, 191, 74, 19, 9)
  rect(active.includes('power') ? signal : steel, 194, 76, 11, 3)
  rect(steel, 194, 81, 2, 2)
  rect(steel, 206, 81, 2, 2)
  if (installed.includes('power')) {
    rect(warning ? alarm : ink, 179, 81, 11, 2)
  } else {
    const cells = design.supply === 'reinforced' ? 3 : 2
    for (let cell = 0; cell < cells; cell += 1) rect(steel, 194 + cell * 5, 79, 4, 3)
  }
  satellite(143, 54)
  if (!installed.includes('science')) {
    const lens = design.payload === 'advanced' ? 13 : 9
    rect(ink, 113, 83 - lens, lens, lens)
    rect(steel, 114, 84 - lens, lens - 2, 2)
    rect(blue, 116, 87 - lens, lens - 6, lens - 6)
  }
  rect(blue, 214, 83, 12, 2)
  if (art.assemblyStep >= 0) rect(navy, 210, 57, Math.min(art.assemblyStep + 1, 3) * 4, 2)
  teams.forEach(crew)
}
