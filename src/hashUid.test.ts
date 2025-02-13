import hashUid from './hashUid'

describe('hashUid length almost fills DICOM tag (64 chars)', () => {
  it('creates a UID', () => {
    const hashed = hashUid('12345')

    expect(hashed.length).toBeLessThanOrEqual(64)
    expect(hashed.length).toBeGreaterThanOrEqual(62)
  })

  it('Is repeatable', () => {
    const hashed1 = hashUid('1.2.3.860.0.1')
    const hashed2 = hashUid('1.2.3.860.0.1')

    expect(hashed1).toEqual(hashed2)
  })

  it('Fixes one example', () => {
    const hashed = hashUid('1.2.3.860.0.1.2.1')

    expect(hashed).toEqual(
      '2.25.194192006138162042199053036200183065023040236100018044223',
    )
  })
})
