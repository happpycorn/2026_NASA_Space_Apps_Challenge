import { en, type Message } from './en'
import { zhTW } from './zh-TW'
import { readLocal } from '../game/storage'

export type Language = 'en' | 'zh-TW'
// The old key stored browser-detected defaults as well as explicit choices.
export const languageKey = 'space-mission.language-choice'
export type { Message }

export function preferredLanguage(): Language {
  return readLocal(languageKey) === 'zh-TW' ? 'zh-TW' : 'en'
}

export function translator(language: Language) {
  const dictionary = language === 'zh-TW' ? zhTW : en
  return (key: Message, values: Record<string, string | number> = {}) =>
    dictionary[key].replace(/\{(\w+)\}/g, (token, name: string) => String(values[name] ?? token))
}

export type Translate = ReturnType<typeof translator>
