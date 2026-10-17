import { describe, expect, it } from 'vitest'
import { formatDecimalHours, formatHM } from './time'

describe('formatHM', () => {
  it('formats minutes as hours and padded minutes', () => {
    expect(formatHM(0)).toBe('0h00')
    expect(formatHM(5)).toBe('0h05')
    expect(formatHM(450)).toBe('7h30')
    expect(formatHM(1440)).toBe('24h00')
  })
})

describe('formatDecimalHours', () => {
  it('uses the locale decimal separator', () => {
    expect(formatDecimalHours(450, 'fr')).toBe('7,5')
    expect(formatDecimalHours(450, 'en')).toBe('7.5')
    expect(formatDecimalHours(20, 'en')).toBe('0.33')
  })
})

