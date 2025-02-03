import * as dcmjs from 'dcmjs'
import uidToV5BasedUID from './uidToV5BasedUID'
import type { TMappingOptions, TMapResults, TPs315EElement } from './types'
import type { TDicomData, TNaturalData } from 'dcmjs'

import getParser from './getParser'
import { elementNamesToAlwaysKeep } from './config/dicom/elementNamesToAlwaysKeep'
import { ps315EElements as rawPs315EElements } from './config/dicom/ps315EElements'
import { ps36TableA1 } from './config/dicom/ps36TableA1'
import { getDcmOrganizeStamp } from './config/dicom/dcmOrganizeStamp'
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

export default function collectMappings(
  inputFilePath: string,
  dicomData: TDicomData,
  mappingOptions: TMappingOptions,
): [TNaturalData, TMapResults] {
  const {
    cleanDescriptorsOption,
    // K if Full, else C would mean modify. 'Off' would mean 1900-01-01 or so.
    // TODO: Add all DA/TM etc to policy with D or such.
    // And only if they are not already there.
    // Then let retainDeviceIdentityOption remove some.
    // CONTINUE HERE:
    // 1. Do s'thing with this last option
    // 2. Then apply, especially dummies. <- before *Comment|*Description!
    // 3. Could improve UIDs etc.
    retainLongitudinalTemporalInformationOptions,
    // Filter the relevant ones by retainPatientCharacteristicsSubset
    // then K for these
    retainPatientCharacteristicsOption,
    // among C, K only keep K (and document this)
    // Attention there are dates there! Keep fixed independent of above.
    retainDeviceIdentityOption,
    retainUIDsOption,
    retainSafePrivateOption,
    // just has K's -> cancel out base
    retainInstitutionIdentityOption,
  } = mappingOptions.ps315Options

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
  }

  const nameMap = dcmjs.data.DicomMetaDictionary.nameMap

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

  // Make make the naturalized data so parser code operates on with tags not hex
  const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
    dicomData.dict,
  )
  mapResults.sourceInstanceUID = naturalData.SOPInstanceUID

  // create a parser object to be used in the eval'ed mappingFunctions
  const parser = getParser(
    mappingOptions.inputPathPattern,
    inputFilePath,
    naturalData,
    mappingOptions.fieldMappings,
  )

  // run the mapping functions that set the following two variables
  let dicomModifications: { [keyword: string]: () => string } = {}
  let outputFilePathComponents: string[] = []
  let cleanDescriptorsExceptions: string[] = []
  let retainPatientCharacteristicsSubset: string[] = []
  // TODO: try/except with useful error hinting at mappingFns
  eval(mappingOptions.mappingFunctions)
  mapResults.outputFilePath = outputFilePathComponents.join('/')

  const [taggedps315EEls, wildcardEls] = ps315EElements.reduce(
    (acc: [TPs315EElement[], TPs315EElement[]], item: TPs315EElement) => {
      let idx = item.tag.includes('X') ? 1 : 0

      acc[idx].push(item)
      return acc
    },
    [[], []],
  )

  console.log(
    'TODO: Handle wildcardEls - convert tags into regex and separate if clause',
  )

  let cleanPolicy = taggedps315EEls.map(({ basicProfile, ...rest }) => {
    return {
      ...rest,
      rule: basicProfile.match(/[^/]*$/)?.[0] ?? '',
    }
  })
  const taggedps315EElSet = new Set(cleanPolicy.map((item) => item.keyword))

  let instanceUids: string[] = []

  // We handle DA/TM/DT separately except for retainDeviceIdentity option
  // Also handle UI separately
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
    return !temporalVr(vr) || 'rtnDevIdOpt' in p
  })

  if (retainPatientCharacteristicsOption) {
    retainPatientCharacteristicsSubset.forEach((keyword) => {
      // Filter out elements from policy if they match subset
      // but only if they are eligible.
      // If matches an element but is not eligible, keep in filter.
      // We keep independent of 'K' or 'C'.
      cleanPolicy = cleanPolicy.filter(
        (p) => p.keyword !== keyword || !('rtnPatCharsOpt' in p),
      )
    })
  }

  // These are all 'K' -> remove from filter.
  if (retainInstitutionIdentityOption) {
    cleanPolicy = cleanPolicy.filter((p) => !('rtnInstIdOpt' in p))
  }

  // We ignore the 'C's which are mostly AETitles
  if (retainDeviceIdentityOption) {
    cleanPolicy = cleanPolicy.filter(
      (p) => !('rtnDevIdOpt' in p) || p.rtnDevIdOpt !== 'K',
    )
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
      const tagPath = path + name
      if (name in nameMap) {
        // means it's a known name
        let vr = nameMap[name].vr
        // Remove optional RETIRED_ prefix as below we check against
        // dictionaries that don't work this way.
        const normalName = removeRetiredPrefix(name)
        if (
          normalName in cleanPolicyMap &&
          (!cleanDescriptorsOption ||
            !cleanDescriptorsExceptions.includes(normalName)) &&
          !cleanPolicyMap[normalName].exceptCondition?.(data)
        ) {
          const { rule } = cleanPolicyMap[normalName]
          switch (rule) {
            case 'Z': {
              mapResults.mappings[tagPath] = [
                data[name],
                'replace',
                'PS3.15E',
                vr === 'SQ' ? [] : '',
              ]
              break
            }
            case 'D': {
              mapResults.mappings[tagPath] = [
                _get(naturalData, tagPath),
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
              mapResults.mappings[tagPath] = [
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
        } else if (vr === 'UI' && !retainUIDsOption) {
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
            instanceUids.indexOf(normalName) !== -1 ||
            // UID is not a known class UID.
            !(uid in ps36TableA1)
          ) {
            // UIDs that need to be mapped
            const mappedUID = uidToV5BasedUID(uid)
            mapResults.mappings[tagPath] = [
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
          !cleanDescriptorsExceptions.includes(normalName)
        ) {
          mapResults.mappings[tagPath] = [
            data[name],
            'delete',
            'cleanDescriptors',
            undefined,
          ]
        } else if (
          !elementNamesToAlwaysKeepSet.has(normalName) &&
          // Some 3.15 options allow us to keep more of the tagged elements by reducing
          // elements from the cleanProfile.
          // Therefore, after the specific options are applied, elements to keep could be
          // in the taggedps315EElSet.
          !taggedps315EElSet.has(normalName)
        ) {
          mapResults.anomalies.push(
            `instance contains attribute ${normalName} that is not defined in elementNamesToAlwaysKeep.  Marking it for deletion.`,
          )
          mapResults.mappings[tagPath] = [
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
        mapResults.mappings[tagPath] = [
          data[name],
          'delete',
          'notInDcmjsDictionary',
          undefined,
        ]
      }
    }
  }
  collectMappingsInData(naturalData)

  Object.entries(getDcmOrganizeStamp(mappingOptions.ps315Options)).forEach(
    ([name, newValue]) => {
      const oldValue = _get(naturalData, name)
      if (oldValue !== newValue) {
        mapResults.mappings[name] = [
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
  for (let tagPath in dicomModifications) {
    // This overrides any default action if tagPath is the same
    mapResults.mappings[tagPath] = [
      _get(naturalData, tagPath),
      'replace',
      'mappingFunction',
      dicomModifications[tagPath](),
    ]
  }

  return [naturalData, mapResults]
}
