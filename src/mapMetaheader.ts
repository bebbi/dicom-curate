import * as dcmjs from 'dcmjs'
import type { DicomDataset } from 'dcmjs'
import { metaheaderTagsToKeep } from './config/dicom/metaheaderTagsToKeep'

const EXPLICIT_LITTLE_ENDIAN = '1.2.840.10008.1.2.1'

export default function mapMetaheader(
  metaHeader: DicomDataset,
  // mapped UID or original depending on activated PS3.15E option
  newInstanceUid: string,
) {
  const naturalMetadata =
    dcmjs.data.DicomMetaDictionary.naturalizeDataset(metaHeader)
  // keep only the bare set of tags needed to make valid metaheader
  for (let tag in naturalMetadata) {
    if (metaheaderTagsToKeep.indexOf(tag) === -1) {
      delete naturalMetadata[tag]
    }
  }
  // add the UID and transfer syntax explicitly
  naturalMetadata.MediaStorageSOPInstanceUID = newInstanceUid
  naturalMetadata.TransferSynxtaxUID = EXPLICIT_LITTLE_ENDIAN // dcmjs always writes this
  const mappedMetaheader =
    dcmjs.data.DicomMetaDictionary.denaturalizeDataset(naturalMetadata)
  return mappedMetaheader
}
