import { clearReplaceUidCache } from './replaceUid'
import { clearUniqueNumberCache } from './getParser'

export function clearCaches() {
  clearReplaceUidCache()
  clearUniqueNumberCache()
}
