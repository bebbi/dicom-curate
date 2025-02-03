import { supportedCid7050 } from './cid7050'
import type { TPS315Options } from '../../types'

export function getDcmOrganizeStamp(options: TPS315Options) {
  return {
    PatientIdentityRemoved: 'YES',
    DeidentificationMethod: 'See dcm-organize README for details',
    DeidentificationMethodCodeSequence: getCid7050Codes(options).map(
      (option) => ({
        CodeValue: option.value,
        CodeMeaning: option.meaning,
        CodingSchemeDesignator: option.scheme,
      }),
    ),
  }
}

export function getCid7050Codes(options: TPS315Options) {
  const seq = [supportedCid7050.basicApplicationConfidentialityProfile]

  Object.entries(options).forEach(([_option, v]) => {
    const option = _option as keyof TPS315Options

    if (v === false || v === 'Off') {
      return
    }

    const item =
      option === 'retainLongitudinalTemporalInformationOptions'
        ? v === 'Full'
          ? supportedCid7050.retainLongitudinalTemporalInformationFullDatesOptions
          : supportedCid7050.retainLongitudinalTemporalInformationModifiedDatesOptions
        : supportedCid7050[option]

    seq.push(item)
  })

  seq.sort((a, b) => Number(a.value) - Number(b.value))

  return seq
}
