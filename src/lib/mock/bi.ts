/** Bilingual mock value (sample data from the design scripts). Real data will come localized from the API. */
export type Bi = { en: string; ar: string }

export const bi = (value: Bi, locale: string) => (locale === "ar" ? value.ar : value.en)
