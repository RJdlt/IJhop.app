import { describe, expect, it } from 'vitest'
import { qrPath } from './qr'

describe('qrPath', () => {
  it('levert een pad en een module-aantal op', () => {
    const { path, size } = qrPath('https://ijhop.app/partner/vanderwerf?code=AB37')
    expect(size).toBeGreaterThan(20)
    expect(path.length).toBeGreaterThan(100)
    expect(path.startsWith('M')).toBe(true)
  })
})
