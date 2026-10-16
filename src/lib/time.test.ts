import { describe, expect, it } from 'vitest'
import { formatDecimalHours, formatHM, parseDuration } from './time'

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

describe('parseDuration', () => {
  it.each([
    ['1:30', 90],
    ['1h30', 90],
    ['1h', 60],
    ['0h45', 45],
    ['1.5', 90],
    ['1,25', 75],
    ['2', 120],
    ['90m', 90],
    ['45 min', 45],
    ['90', 90],
    ['  3 H 15 ', 195],
  ])('%s → %i', (input, expected) => {
    expect(parseDuration(input)).toBe(expected)
  })

  it.each(['', 'abc', '1:75', '1h60', '-1'])('rejects %j', (input) => {
    expect(parseDuration(input)).toBeNull()
  })
})
