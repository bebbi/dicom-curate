import { clearReplaceUidCache } from './replaceUid'
import { clearUniqueNumberCache, clearUniqueInGroupCache } from './getParser'

export function clearCaches() {
  clearReplaceUidCache()
  clearUniqueNumberCache()
  clearUniqueInGroupCache()
}
