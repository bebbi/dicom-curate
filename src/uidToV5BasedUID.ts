import * as uuid from 'uuid'

// value defined here:
// https://www.rfc-editor.org/rfc/rfc9562#name-uuid-version-5
const oidNamespace = '6ba7b812-9dad-11d1-80b4-00c04fd430c8'
const uuidBasedUIDPrefix = '2.25.'

// See https://github.com/bebbi/dcm-organize/issues/7
export default function uidToV5BasedUID(uid) {
  const hashedUID = uuid.v5(uid, oidNamespace)
  const hashedUIDBytes = uuid.parse(hashedUID)
  let hashedString = ''
  for (const byte of hashedUIDBytes) {
    hashedString += String(byte).padStart(3, '0')
  }
  hashedString = hashedString.replace(/^0+/, '')
  let mappedUID = uuidBasedUIDPrefix + hashedString
  return mappedUID
}
