import replaceUidWithMapping, {
  setSharedUidMappings,
  clearReplaceUidCache,
} from './replaceUid'

describe('replaceUid', () => {
  beforeEach(() => {
    // Clear cache and shared mappings before each test
    clearReplaceUidCache()
  })

  afterEach(() => {
    // Clean up after each test
    clearReplaceUidCache()
  })

  describe('without shared mappings', () => {
    it('should generate a unique UID for each call with different input', () => {
      const uid1 = '1.2.3.4.5'
      const uid2 = '1.2.3.4.6'

      const replaced1 = replaceUidWithMapping(uid1)
      const replaced2 = replaceUidWithMapping(uid2)

      // Should be different UIDs
      expect(replaced1).not.toBe(replaced2)

      // Should be valid DICOM UIDs (start with digits)
      expect(replaced1).toMatch(/^\d/)
      expect(replaced2).toMatch(/^\d/)
    })

    it('should return the same UID when called multiple times with same input (memoization)', () => {
      const uid = '1.2.3.4.5'

      const replaced1 = replaceUidWithMapping(uid)
      const replaced2 = replaceUidWithMapping(uid)

      expect(replaced1).toBe(replaced2)
    })

    it('should generate different UIDs after cache is cleared', () => {
      const uid = '1.2.3.4.5'

      const replaced1 = replaceUidWithMapping(uid)
      clearReplaceUidCache()
      const replaced2 = replaceUidWithMapping(uid)

      // After clearing cache, should generate a new UID
      expect(replaced1).not.toBe(replaced2)
    })
  })

  describe('with shared mappings', () => {
    it('should use shared mapping when provided', () => {
      const uid = '1.2.3.4.5'
      const mappedUid = '9.8.7.6.5'

      setSharedUidMappings({ [uid]: mappedUid })

      const result = replaceUidWithMapping(uid)

      expect(result).toBe(mappedUid)
    })

    it('should use shared mapping for multiple UIDs', () => {
      const uid1 = '1.2.3.4.5'
      const uid2 = '1.2.3.4.6'
      const mappedUid1 = '9.8.7.6.5'
      const mappedUid2 = '9.8.7.6.6'

      setSharedUidMappings({
        [uid1]: mappedUid1,
        [uid2]: mappedUid2,
      })

      expect(replaceUidWithMapping(uid1)).toBe(mappedUid1)
      expect(replaceUidWithMapping(uid2)).toBe(mappedUid2)
    })

    it('should fall back to random generation for UIDs not in mapping', () => {
      const uid1 = '1.2.3.4.5'
      const uid2 = '1.2.3.4.6'
      const mappedUid1 = '9.8.7.6.5'

      setSharedUidMappings({ [uid1]: mappedUid1 })

      // uid1 should use shared mapping
      expect(replaceUidWithMapping(uid1)).toBe(mappedUid1)

      // uid2 should fall back to random generation
      const result = replaceUidWithMapping(uid2)
      expect(result).not.toBe(mappedUid1)
      expect(result).toMatch(/^\d/)
    })

    it('should clear shared mappings when clearReplaceUidCache is called', () => {
      const uid = '1.2.3.4.5'
      const mappedUid = '9.8.7.6.5'

      setSharedUidMappings({ [uid]: mappedUid })
      expect(replaceUidWithMapping(uid)).toBe(mappedUid)

      clearReplaceUidCache()

      // After clearing, should fall back to random generation
      const result = replaceUidWithMapping(uid)
      expect(result).not.toBe(mappedUid)
      expect(result).toMatch(/^\d/)
    })

    it('should fall back to random generation when mappings are empty or undefined', () => {
      const uid = '1.2.3.4.5'

      // Test with empty mappings
      setSharedUidMappings({})
      const resultEmpty = replaceUidWithMapping(uid)
      expect(resultEmpty).toMatch(/^\d/)

      // Test with undefined mappings
      setSharedUidMappings(undefined)
      const resultUndefined = replaceUidWithMapping(uid)
      expect(resultUndefined).toMatch(/^\d/)
    })

    it('should override previous shared mappings when set again', () => {
      const uid = '1.2.3.4.5'
      const mappedUid1 = '9.8.7.6.5'
      const mappedUid2 = '9.8.7.6.9'

      setSharedUidMappings({ [uid]: mappedUid1 })
      expect(replaceUidWithMapping(uid)).toBe(mappedUid1)

      setSharedUidMappings({ [uid]: mappedUid2 })
      expect(replaceUidWithMapping(uid)).toBe(mappedUid2)
    })
  })

  describe('integration with memoization and shared mappings', () => {
    it('should prefer shared mapping over memoized value', () => {
      const uid = '1.2.3.4.5'

      // First generate without shared mapping (will be memoized)
      const memoizedValue = replaceUidWithMapping(uid)

      // Now set a different shared mapping
      const sharedMappedValue = '9.8.7.6.5'
      setSharedUidMappings({ [uid]: sharedMappedValue })

      // Should use shared mapping, not memoized value
      const result = replaceUidWithMapping(uid)
      expect(result).toBe(sharedMappedValue)
      expect(result).not.toBe(memoizedValue)
    })
  })
})
