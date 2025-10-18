import * as dcmjs from 'dcmjs'
import { composeSpecs } from './composeSpecs'
import { collectUidsToReplace } from './deidentifyPS315E'
import type { TMappingOptions, TFileInfo } from './types'

/**
 * Collect UIDs from a DICOM file that need to be replaced
 * This is used during the first pass to gather all UIDs before generating mappings
 */
export async function collectUidsFromFile(
  fileInfo: TFileInfo,
  mappingOptions: TMappingOptions,
): Promise<string[]> {
  try {
    // Read the file
    let arrayBuffer: ArrayBuffer
    if (fileInfo.kind === 'handle') {
      const file = await fileInfo.fileHandle.getFile()
      arrayBuffer = await file.arrayBuffer()
    } else {
      arrayBuffer = await fileInfo.blob.arrayBuffer()
    }

    // Parse DICOM data
    const dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer)

    // Get the curation spec
    const finalSpec = composeSpecs(mappingOptions.curationSpec())

    // Skip UID collection if:
    // - De-identification is disabled
    // - UIDs are hashed (deterministic, no pre-collection needed)
    // - UIDs are retained as-is (no replacement needed)
    if (
      finalSpec.dicomPS315EOptions === 'Off' ||
      finalSpec.dicomPS315EOptions.retainUIDsOption === 'Hashed' ||
      finalSpec.dicomPS315EOptions.retainUIDsOption === 'On'
    ) {
      return []
    }

    // Make naturalized data
    const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
      dicomData.dict,
    )

    // Collect UIDs that need to be replaced
    return collectUidsToReplace({
      naturalData,
      retainUIDsOption: finalSpec.dicomPS315EOptions.retainUIDsOption,
    })
  } catch (error) {
    console.error(`Error collecting UIDs from file ${fileInfo.name}:`, error)
    return []
  }
}
