import * as dcmjs from 'dcmjs'
import memize from 'memize'

function replaceUid(uid: string): string {
  return dcmjs.data.DicomMetaDictionary.uid()
}

const memoized = memize(replaceUid)

export default memoized

export function clearReplaceUidCache() {
  memoized.clear()
}
