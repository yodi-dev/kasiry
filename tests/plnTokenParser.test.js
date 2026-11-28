import { describe, it, expect } from 'vitest'
import { parseFastpayPlnToken } from '../src/utils/plnTokenParser'

describe('parseFastpayPlnToken', () => {
  it('parses Fastpay PLN token format into tokenCode and customer summary', () => {
    const input = '5702-3195-8454-5494-4868/SRI RIDHOAH/R1/000002200VA/125,9kWh'
    const parsed = parseFastpayPlnToken(input)

    expect(parsed).not.toBeNull()
    expect(parsed.tokenCode).toBe('5702-3195-8454-5494-4868')
    expect(parsed.customerName).toBe('SRI RIDHOAH')
    expect(parsed.tariff).toBe('R1')
    expect(parsed.power).toBe('2200VA')
    expect(parsed.kwh).toBe('125,9kWh')
    expect(parsed.summaryNote).toBe('SRI RIDHOAH • R1/2200VA • 125,9kWh')
  })

  it('returns null for non-Fastpay or invalid token strings', () => {
    expect(parseFastpayPlnToken('1234-5678')).toBeNull()
    expect(parseFastpayPlnToken('5702-3195-8454-5494-4868')).toBeNull()
    expect(parseFastpayPlnToken('')).toBeNull()
  })
})
