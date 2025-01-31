import * as dcmjs from 'dcmjs'
import uidToV5BasedUID from './uidToV5BasedUID'
import type { TDicomDataDict } from 'dcmjs'
import { metaheaderTagsToKeep } from './config/dicom/metaheaderTagsToKeep'

const EXPLICIT_LITTLE_ENDIAN = '1.2.840.10008.1.2.1'

export default function mapMetaheader(metaHeader: TDicomDataDict) {
  const naturalMetadata =
    dcmjs.data.DicomMetaDictionary.naturalizeDataset(metaHeader)
  // save the UID to add back later
  const instanceUID = naturalMetadata.MediaStorageSOPInstanceUID
  // keep only the bare set of tags needed to make valid metaheader
  for (let tag in naturalMetadata) {
    if (metaheaderTagsToKeep.indexOf(tag) === -1) {
      delete naturalMetadata[tag]
    }
  }
  // add the UID and transfer syntax explicitly
  const mappedUID = uidToV5BasedUID(instanceUID)
  naturalMetadata.MediaStorageSOPInstanceUID = mappedUID
  naturalMetadata.TransferSynxtaxUID = EXPLICIT_LITTLE_ENDIAN // dcmjs always writes this
  const mappedMetaheader =
    dcmjs.data.DicomMetaDictionary.denaturalizeDataset(naturalMetadata)
  return mappedMetaheader
}
