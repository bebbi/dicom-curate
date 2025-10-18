import * as dcmjs from 'dcmjs'
import memize from 'memize'

function replaceUid(uid: string): string {
  return dcmjs.data.DicomMetaDictionary.uid()
}

const memoized = memize(replaceUid)

// Shared UID mappings (when provided from main thread for multi-worker consistency)
let sharedUidMappings: Record<string, string> | undefined

export function setSharedUidMappings(
  mappings: Record<string, string> | undefined,
) {
  sharedUidMappings = mappings
}

export default function replaceUidWithMapping(uid: string): string {
  // If shared mappings are provided, use them
  if (sharedUidMappings && uid in sharedUidMappings) {
    return sharedUidMappings[uid]
  }
  // Otherwise, use the memoized random generation
  return memoized(uid)
}

export function clearReplaceUidCache() {
  memoized.clear()
  sharedUidMappings = undefined
}
