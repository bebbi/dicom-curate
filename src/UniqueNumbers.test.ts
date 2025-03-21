import { UniqueNumbers } from './UniqueNumbers'

describe('UniqueNumbers generator test', () => {
  // Instantiate with default padding of 5 digits.
  const { getUniqueNumberInGroup, clearUniqueNumberCache } = UniqueNumbers(5)

  it('generates unique numbers and resets', () => {
    const groupA = 'seriesUID123'
    const groupB = 'seriesUID456'

    expect(getUniqueNumberInGroup(groupA)).toBe('00001')
    expect(getUniqueNumberInGroup(groupA)).toBe('00002')

    expect(getUniqueNumberInGroup(groupB)).toBe('00001')

    clearUniqueNumberCache()

    // After resetting, groupA should start over
    expect(getUniqueNumberInGroup(groupA)).toBe('00001')
  })
})
