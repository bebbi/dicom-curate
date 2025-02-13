import * as dcmjs from 'dcmjs'
import uidToV5BasedUID from './uidToV5BasedUID'
import replaceUid from './replaceUid'
import type {
  TMappingOptions,
  TMapResults,
  TPs315EElement,
  TPs315Options,
} from './types'
import type { TDicomData, TNaturalData } from 'dcmjs'

import getParser from './getParser'
import { elementNamesToAlwaysKeep } from './config/dicom/elementNamesToAlwaysKeep'
import { ps315EElements as rawPs315EElements } from './config/dicom/ps315EElements'
import { retainAdditionalIds } from './config/dicom/retainAdditionalIds'
import { uidRegistryPS3_06_A1 } from './config/dicom/uidRegistryPS3_06_A1'
import { getDcmOrganizeStamp } from './config/dicom/dcmOrganizeStamp'
import { offsetDateTime, iso8601 } from './offsetDateTime'
import dummyValues from './config/dicom/dummyValues'

import { get as _get } from 'lodash'

const elementNamesToAlwaysKeepSet = new Set(elementNamesToAlwaysKeep)

// Special conditions for some PS3.15 E1.1 elements.
const ps315EElements = rawPs315EElements.map((elm) => {
  switch (elm.keyword) {
    case 'EncapsulatedDocument': {
      return {
        ...elm,
        exceptCondition: (data: TNaturalData) => data.Modality === 'DOC',
        // Unless it's a DOC modality, we can remove this tag.
        basicProfile: 'X',
      }
    }
    case 'VerifyingObserverSequence': {
      return {
        ...elm,
        exceptCondition: (data: TNaturalData) => data.Modality === 'SR',
        // Unless it's a SR modality, we can remove this tag.
        // It is only optional in "KO" modality
        basicProfile: 'X',
      }
    }
    default:
      return elm
  }
})

function temporalVr(vr: string) {
  return vr === 'DT' || vr === 'DA' || vr === 'TM'
}

function removeRetiredPrefix(name: string) {
  return name.startsWith('RETIRED_') ? name.slice(8) : name
}

const defaultPs315Options: TPs315Options = {
  cleanDescriptorsOption: true,
  cleanDescriptorsExceptions: [],
  retainLongitudinalTemporalInformationOptions: 'Off',
  retainPatientCharacteristicsOption: false,
  retainDeviceIdentityOption: false,
  retainUIDsOption: 'Off',
  retainSafePrivateOption: false,
  retainInstitutionIdentityOption: false,
}

export default function collectMappings(
  inputFilePath: string,
  dicomData: TDicomData,
  mappingOptions: TMappingOptions,
): [TNaturalData, TMapResults] {
  let {
    ps315Options: passedPs315Options = defaultPs315Options,
    inputPathPattern,
  } = mappingOptions

  // Returns [naturalData, mapResults]
  // sourceInstanceUID : original UID for this dicomData
  // filePath : assembled string of path components
  // mappings are object of the form:
  // key:
  //   "path" : string compatible with lodash get/set
  // value list elements:
  //   "originalValue" : value from the dicomData
  //   "mapOperation" : one of "replace", "delete"
  //   "mappedValue" : replacement for "replace" operation
  // "anomalies" : a list of text strings describing any unexpected contents of the data
  const mapResults: TMapResults = {
    sourceInstanceUID: '',
    outputFilePath: '',
    mappings: {},
    anomalies: [],
    errors: [],
  }

  const nameMap = dcmjs.data.DicomMetaDictionary.nameMap

  // Make make the naturalized data so parser code operates on with tags not hex
  const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
    dicomData.dict,
  )
  mapResults.sourceInstanceUID = naturalData.SOPInstanceUID

  let modifications: () => {
    dicomHeader: { [keyword: string]: string }
    outputFilePathComponents: string[]
  } = () => ({
    dicomHeader: {},
    outputFilePathComponents: [],
  })
  let DICOMPS315EOptions: TPs315Options = passedPs315Options

  // TODO: try/except with useful error hinting at mappingScripts
  eval(mappingOptions.mappingScript)

  // final options Either passed in or from script, but not a mix.
  const ps315Options = DICOMPS315EOptions

  // Final options
  const {
    cleanDescriptorsOption,
    cleanDescriptorsExceptions,
    retainLongitudinalTemporalInformationOptions,
    retainPatientCharacteristicsOption,
    retainDeviceIdentityOption,
    retainUIDsOption,
    retainSafePrivateOption,
    retainInstitutionIdentityOption,
  } = ps315Options

  // create a parser object to be used in the eval'ed mappingFunctions
  const parser = getParser(
    inputPathPattern,
    inputFilePath,
    naturalData,
    mappingOptions.columnMappings,
  )

  let modificationMap = modifications()

  mapResults.outputFilePath = modificationMap.outputFilePathComponents.join('/')

  const taggedps315EEls = ps315EElements.reduce(
    (acc: TPs315EElement[], item: TPs315EElement) => {
      acc.push(item)
      return acc
    },
    [],
  )

  let cleanPolicy = taggedps315EEls.map(({ basicProfile, ...rest }) => {
    return {
      ...rest,
      rule: basicProfile.match(/[^/]*$/)?.[0] ?? '',
    }
  })
  const taggedps315EElSet = new Set(cleanPolicy.map((item) => item.keyword))

  let instanceUids: string[] = []

  // We handle UIs separately
  cleanPolicy = cleanPolicy.filter((p) => {
    let vr = nameMap[p.keyword]?.vr

    if (vr === 'UI') {
      instanceUids.push(p.keyword)
      return false
    }
    if (p.rule === 'U*') {
      // already handled with deep UI cleaning approach
      return false
    }

    return true
  })

  if (retainPatientCharacteristicsOption) {
    retainPatientCharacteristicsOption.forEach((keyword) => {
      // Filter out elements from policy if they match subset
      // but only if they are eligible.
      // If matches an element but is not eligible, keep in filter.
      // We keep independent of 'K' or 'C'.
      cleanPolicy = cleanPolicy.filter(
        (p) => p.keyword !== keyword || !('rtnPatCharsOpt' in p),
      )
    })
  }

  // These are all 'K' -> simply remove from cleanPolicy.
  if (retainInstitutionIdentityOption) {
    cleanPolicy = cleanPolicy.filter((p) => !('rtnInstIdOpt' in p))
  }

  const datesToRetain = new Set<string>()
  // On any date modifications, consider retainDeviceIdentityOption
  if (
    retainLongitudinalTemporalInformationOptions !== 'Full' &&
    retainDeviceIdentityOption
  ) {
    cleanPolicy.forEach((p) => {
      if (
        'rtnDevIdOpt' in p &&
        // We still remove the 'C's which are mostly AETitles
        p.rtnDevIdOpt === 'K' &&
        temporalVr(nameMap[p.keyword]?.vr)
      ) {
        datesToRetain.add(p.keyword)
      }
    })
  }

  // Any level of keeping or offsetting longitudinal info, remove them from cleanPolicy
  if (retainLongitudinalTemporalInformationOptions !== 'Off') {
    // Just remove all temporal VRs from cleanPolicy, that's it.
    cleanPolicy = cleanPolicy.filter((p) => !temporalVr(nameMap[p.keyword]?.vr))
  }

  const cleanPolicyMap = Object.fromEntries(
    cleanPolicy.map((item) => [item.keyword, item]),
  )

  // Now collect the standard mappings with a
  // recursive function to handle sequences (naturalData is a top-level instance of data).
  // Calls modify mapResults in the outer function scope.
  function collectMappingsInData(data: TNaturalData, path = '') {
    for (let name in data) {
      if (/_.*/.test(name)) {
        continue // ignore tags marked internal with leading underscore
      }
      const attrPath = path + name
      if (name in nameMap) {
        // means it's a known name
        let vr = nameMap[name].vr
        // Remove optional RETIRED_ prefix as below we check against
        // dictionaries that don't work this way.
        const normalName = removeRetiredPrefix(name)
        if (
          // We should clean it
          normalName in cleanPolicyMap &&
          // Either cleanDescOpt is off (we handle those separately) or
          // if it's on, it's not one of the exception tags
          (!cleanDescriptorsOption ||
            !cleanDescriptorsExceptions.includes(normalName)) &&
          // No condition for an exception applies
          !cleanPolicyMap[normalName].exceptCondition?.(data) &&
          data[name] !== ''
        ) {
          const { rule } = cleanPolicyMap[normalName]
          switch (rule) {
            case 'Z': {
              mapResults.mappings[attrPath] = [
                data[name],
                'replace',
                'PS3.15E',
                vr === 'SQ' ? [] : '',
              ]
              break
            }
            case 'D': {
              mapResults.mappings[attrPath] = [
                data[name],
                'replace',
                'PS3.15E',
                dummyValues[vr],
              ]
              break
            }
            default: {
              if (rule !== 'X') {
                mapResults.anomalies.push(
                  `don't know how to handle PS3.15E rule ${rule} for ${normalName}.`,
                )
              }
              mapResults.mappings[attrPath] = [
                data[name],
                'delete',
                'PS3.15E',
                undefined,
              ]
            }
          }
        } else if (vr === 'SQ') {
          let subDataIndex = 0
          for (let subData of Object.values(data[name]) as TNaturalData[]) {
            let subPath = `${path}${name}[${subDataIndex}].`
            collectMappingsInData(subData, subPath)
            subDataIndex += 1
          }
        } else if (temporalVr(vr) && data[name] !== '') {
          // This is a date not in cleanOpts and we proceed per longitud option
          const dateOpt = retainLongitudinalTemporalInformationOptions
          // datesToRetain implies retainDeviceIdentifiers option
          if (dateOpt !== 'Full' && !datesToRetain.has(normalName)) {
            if (dateOpt === 'Off') {
              mapResults.mappings[attrPath] = [
                data[name],
                'delete',
                'removeTemporalOpt',
                undefined,
              ]
            } else if (Array.isArray(dateOpt)) {
              const [source, identifier, fromHeader, toHeader] = dateOpt
              const sourceValue = parser.getFrom(source, identifier)
              let error = ''
              if (sourceValue) {
                const duration = parser.getMapping(
                  sourceValue,
                  fromHeader,
                  toHeader,
                )
                if (typeof duration === 'string' && duration.match(iso8601)) {
                  try {
                    mapResults.mappings[attrPath] = [
                      data[name],
                      'replace',
                      'offsetTemporalOpt',
                      offsetDateTime(data[name], duration),
                    ]
                  } catch (e) {
                    error = `Date mapping error: Date mapping failed for attribute ${attrPath}: "${data[name]}"`
                  }
                } else
                  error = `Date mapping error: An ISO-8601 compatible date offset was not found for value ${sourceValue} at columns ${fromHeader}, ${toHeader}.`
              } else {
                error = `Date mapping error: Did not find a value in ${source} for ${identifier}.`
              }

              if (error) {
                mapResults.errors.push(error)
              }
            }
          }
        } else if (
          vr === 'UI' &&
          retainUIDsOption !== 'On' &&
          data[name] !== ''
        ) {
          // Convert UIDs mentioned in 3.15 anyway, and then additionally those
          // that are not well-known class UIDs. The reason for latter is that
          // after subtracting PS3.15 from PS6, we still see instance UIDs such
          // as e.g. ReferencedColorPaletteInstanceUID.
          // Note that we err on the side of privacy; this is not strictly about
          // class vs instance UIDs as we want to de-identify edge cases such as
          // Private Class UIDs as those would be considered identifiable.
          const uid = data[name]
          if (
            // UID explicitly mentioned in PS3.15.
            instanceUids.indexOf(normalName) !== -1 &&
            // UID is not a known class UID.
            !(uid in uidRegistryPS3_06_A1)
          ) {
            // UIDs that need to be mapped
            const mappedUID =
              retainUIDsOption === 'Hashed'
                ? uidToV5BasedUID(uid)
                : replaceUid(uid)
            mapResults.mappings[attrPath] = [
              uid,
              'replace',
              'notRetainInstanceUID',
              mappedUID,
            ]
          }
        } else if (
          // "For example, one approach is to remove all description and
          // comment Attributes except Series Description (0008,103E), since
          // this Attribute rarely contains identifying or diagnosis information
          // yet is typically a reliable source of useful information about the
          // acquisition technique populated automatically from modality device
          // protocols, though it still could be cleaned as described in Note 2"
          cleanDescriptorsOption &&
          (normalName.endsWith('Comment') ||
            normalName.endsWith('Description')) &&
          !cleanDescriptorsExceptions.includes(normalName) &&
          data[name] !== ''
        ) {
          mapResults.mappings[attrPath] = [
            data[name],
            'delete',
            'cleanDescriptors',
            undefined,
          ]
        } else if (
          normalName in retainAdditionalIds &&
          (!retainDeviceIdentityOption ||
            !retainAdditionalIds[normalName] ||
            !retainAdditionalIds[normalName].rtnDevIdOpt) &&
          data[name] !== ''
        ) {
          mapResults.mappings[attrPath] = [
            data[name],
            'delete',
            'notInRtnAdditionalIds',
            undefined,
          ]
        } else if (
          !elementNamesToAlwaysKeepSet.has(normalName) &&
          // Some 3.15 options allow us to keep more of the tagged elements by reducing
          // elements from the cleanProfile.
          // Therefore, after the specific options are applied, elements to keep could be
          // in the taggedps315EElSet.
          !taggedps315EElSet.has(normalName) &&
          data[name] !== ''
        ) {
          mapResults.anomalies.push(
            `instance contains attribute ${normalName} that is not defined in elementNamesToAlwaysKeep.  Marking it for deletion.`,
          )
          mapResults.mappings[attrPath] = [
            data[name],
            'delete',
            'notInElmtsToKeep',
            undefined,
          ]
        }
      } else {
        mapResults.anomalies.push(
          `instance contains attribute ${name} that is not in dictionary.  Marking it for deletion.`,
        )
        mapResults.mappings[attrPath] = [
          data[name],
          'delete',
          'notInDcmjsDictionary',
          undefined,
        ]
      }
    }
  }

  //
  // collect private tags and mark them for delete
  // TODO: put this in recursive function to find nested private tags
  // TODO: add option for `allowlist` of private tags taken from 3.15E and TCIA table
  for (let hexTag in dicomData.dict) {
    if (Number(hexTag[3]) % 2 === 1) {
      if (!retainSafePrivateOption) {
        mapResults.mappings['x' + hexTag] = [
          String(dicomData.dict[hexTag].Value),
          'delete',
          'notRetainSafePrivate',
          undefined,
        ]
      }
    }
  }

  collectMappingsInData(naturalData)

  Object.entries(getDcmOrganizeStamp(ps315Options)).forEach(
    ([attrPath, newValue]) => {
      const oldValue = _get(naturalData, attrPath)
      if (oldValue !== newValue) {
        mapResults.mappings[attrPath] = [
          oldValue,
          'replace',
          'dcm-organize',
          newValue,
        ]
      }
    },
  )

  // Moving this after collectMappingsInData as this should take precedence.
  // collect the tag mappings before assigning them into dicomData
  // - Note the mappingFunctions return a dictionary called 'dicomModifications' of functions to call
  //   for each tag they want to map
  const dicomMap = modificationMap.dicomHeader
  for (let attrPath in dicomMap) {
    // This overrides any default action if attrPath is the same
    mapResults.mappings[attrPath] = [
      _get(naturalData, attrPath),
      'replace',
      'mappingFunction',
      dicomMap[attrPath],
    ]
  }

  return [naturalData, mapResults]
}
