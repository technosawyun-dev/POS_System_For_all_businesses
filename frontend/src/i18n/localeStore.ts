import { create } from 'zustand'
import { translations } from './translations'

type TFn = (key: string) => string

interface LocaleState {
  locale: string
  t: TFn
  setLocale: (locale: string) => void
}

function makeTFn(locale: string): TFn {
  const lang = locale === 'my-MM' ? 'my' : 'en'
  const dict = translations[lang] ?? translations.en
  return (key: string) => dict[key] ?? translations.en[key] ?? key
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: 'en-US',
  t: makeTFn('en-US'),
  setLocale: (locale: string) => set({ locale, t: makeTFn(locale) }),
}))
