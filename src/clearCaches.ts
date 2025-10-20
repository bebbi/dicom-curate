import { clearUniqueNumberCache, clearUniqueInGroupCache } from './getParser'

export function clearCaches() {
  clearUniqueNumberCache()
  clearUniqueInGroupCache()
}
