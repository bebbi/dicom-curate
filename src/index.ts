import { extractColumnMappings, TColumnMappings } from './csvMapping'
import { clearCaches } from './clearCaches'
import { curateOne } from './curateOne'
import { composeSpecs } from './composeSpecs'
import { serializeMappingOptions } from './serializeMappingOptions'
import { iso8601 } from './offsetDateTime'
import { collectUidsFromFile } from './collectUids'
import * as dcmjs from 'dcmjs'

import type {
  TMappingOptions,
  TMapResults,
  TFileInfo,
  OrganizeOptions,
  TProgressMessage,
  TProgressMessageDone,
  TPs315Options,
} from './types'

import type { FileScanMsg } from './scanDirectoryWorker'
import type { MappingRequest } from './applyMappingsWorker'

type TMappingWorkerOptions = TMappingOptions & {
  outputDirectory?: FileSystemDirectoryHandle
}

export type ProgressCallback = (message: TProgressMessage) => void

export type {
  TPs315Options,
  TMapResults,
  TProgressMessage,
  OrganizeOptions,
  TCurationSpecification,
} from './types'

export { TCurateOneArgs } from './curateOne'

export { specVersion } from './config/specVersion'
export { csvTextToRows } from './csvMapping'
export type { Row } from './csvMapping'
export { composeSpecs } from './composeSpecs'
export type { SpecPart } from './composeSpecs'

const mappingWorkerCount = navigator.hardwareConcurrency

// Update the type to include scan anomalies
let filesToProcess: {
  fileInfo: TFileInfo
  fileIndex: number
  scanAnomalies: string[]
}[] = []
let directoryScanFinished = false
let uidCollectionInProgress = false
let uidCollectionComplete = false

// Track scan anomalies separately since they don't go through the processing pipeline
let scanAnomalies: { fileInfo: TFileInfo; anomalies: string[] }[] = []

function requiresDateOffset(
  deIdOpts: TPs315Options | 'Off',
): deIdOpts is TPs315Options & {
  retainLongitudinalTemporalInformationOptions: 'Offset'
} {
  return (
    deIdOpts !== 'Off' &&
    deIdOpts.retainLongitudinalTemporalInformationOptions === 'Offset'
  )
}

/*
 * Directory scanner web worker management
 *
 * worker accepts these messages:
 *   command: 'scan', directoryHandle
 *   command: 'stop'
 * worker sends these messages:
 *   response: 'file', file info (TFileInfo)
 *   response: 'done'
 */
// TODO: implement a buffering stream to request fileHandles in batches
function initializeFileListWorker() {
  filesToProcess = []
  directoryScanFinished = false
  uidCollectionInProgress = false
  uidCollectionComplete = false
  scanAnomalies = []

  const fileListWorker = new Worker(
    new URL('./scanDirectoryWorker.js', import.meta.url),
    { type: 'module' },
  )

  fileListWorker.addEventListener(
    'message',
    (event: MessageEvent<FileScanMsg>) => {
      switch (event.data.response) {
        case 'file': {
          const { fileIndex, fileInfo } = event.data
          filesToProcess.push({
            fileIndex,
            fileInfo,
            scanAnomalies: [], // Files sent to processing have no scan anomalies
          })

          // Could do some throttling:
          // if (filesToProcess.length > 10) {
          //   fileListWorker.postMessage({ request: 'stop' })
          // }
          dispatchMappingJobs()
          break
        }
        case 'scanAnomalies': {
          // Handle scan anomalies separately - they don't go to processing
          const { fileInfo: anomalyFileInfo, anomalies } = event.data
          scanAnomalies.push({ fileInfo: anomalyFileInfo, anomalies })
          break
        }
        case 'done': {
          console.log('directoryScanFinished')
          directoryScanFinished = true

          // Once scan is done, collect UIDs before starting processing
          collectUidsForDirectory()
          break
        }
        default: {
          // @ts-expect-error: response is string here, not never
          console.error(`Unknown response from worker ${event.data.response}`)
        }
      }
      dispatchMappingJobs()
    },
  )

  return fileListWorker
}

/**
 * Collect UIDs from all files after directory scan completes
 */
async function collectUidsForDirectory() {
  if (uidCollectionInProgress || uidCollectionComplete) {
    return
  }

  const mappingOpts = mappingWorkerOptions as TMappingOptions

  // Check if UID collection is actually needed
  if (!needsUidCollection(mappingOpts)) {
    uidCollectionComplete = true
    dispatchMappingJobs()
    return
  }

  uidCollectionInProgress = true

  try {
    const uidMappings = await generateSharedUidMappings(
      filesToProcess,
      mappingOpts,
    )

    if (uidMappings) {
      mappingWorkerOptions.uidMappings = uidMappings
    }

    uidCollectionComplete = true
    console.log('UID collection complete, starting file processing')

    dispatchMappingJobs()
  } catch (error) {
    console.error('Error collecting UIDs:', error)
    uidCollectionComplete = true // Continue anyway
    dispatchMappingJobs()
  } finally {
    uidCollectionInProgress = false
  }
}

//
// Apply mappings web worker management
//
// worker accepts these messages:
//   request: 'apply', fileInfo, outDirectoryHandle, mappingOptions
// worker sends these messages:
//   response: 'finished', mapResults
//
let mappingWorkerOptions: Partial<TMappingWorkerOptions> = {} // TODO: only send to worker once
const availableMappingWorkers: Worker[] = []
let workersActive = 0
let mapResultsList: TMapResults[] = []

function initializeMappingWorkers() {
  mappingWorkerOptions = {}
  workersActive = 0
  mapResultsList = []
  // Initialize UID collection flags
  uidCollectionInProgress = false
  uidCollectionComplete = false

  for (let workerIndex = 0; workerIndex < mappingWorkerCount; workerIndex++) {
    let mappingWorker = new Worker(
      new URL('./applyMappingsWorker.js', import.meta.url),
      { type: 'module' },
    )
    mappingWorker.onerror = console.error

    mappingWorker.addEventListener('message', (event) => {
      switch (event.data.response) {
        case 'finished':
          availableMappingWorkers.push(mappingWorker)
          mapResultsList.push(event.data.mapResults)
          workersActive -= 1

          // Report progress
          progressCallback({
            response: 'progress',
            mapResults: event.data.mapResults,
            processedFiles: mapResultsList.length,
            totalFiles:
              filesToProcess.length + mapResultsList.length + workersActive,
          })

          dispatchMappingJobs()
          if (mapResultsList.length % 100 === 0) {
            console.log(`Finished mapping ${mapResultsList.length} files`)
          }
          break
        default:
          console.error(`Unknown response from worker ${event.data.response}`)
      }
    })

    availableMappingWorkers.push(mappingWorker)
  }
}

function dispatchMappingJobs() {
  // Don't start processing if directory scan is finished but UID collection is still in progress
  if (
    directoryScanFinished &&
    uidCollectionInProgress &&
    !uidCollectionComplete
  ) {
    return // Wait for UID collection to complete
  }

  while (filesToProcess.length > 0 && availableMappingWorkers.length > 0) {
    const { fileInfo, fileIndex } = filesToProcess.pop()!
    const mappingWorker = availableMappingWorkers.pop()!
    const { outputDirectory, ...mappingOptions } =
      // Not partial anymore.
      mappingWorkerOptions as TMappingWorkerOptions
    mappingWorker.postMessage({
      request: 'apply',
      fileInfo,
      fileIndex,
      outputDirectory,
      serializedMappingOptions: serializeMappingOptions(mappingOptions),
    } satisfies MappingRequest)
    workersActive += 1
  }
  // Check if all work is complete
  const allWorkComplete =
    workersActive === 0 &&
    directoryScanFinished &&
    filesToProcess.length === 0 &&
    (!uidCollectionInProgress || uidCollectionComplete)

  if (allWorkComplete) {
    // End and remove all workers
    while (availableMappingWorkers.length) {
      availableMappingWorkers.pop()!.terminate()
    }

    clearCaches()
    console.log(`Finished mapping ${mapResultsList.length} files`)
    console.log('job is finished')

    // Create individual mapResults entries for each scan anomaly
    // Only do this during actual processing (not first pass)
    if (!mappingWorkerOptions.skipWrite) {
      scanAnomalies.forEach(({ fileInfo, anomalies }) => {
        const scanAnomalyResult: TMapResults = {
          sourceInstanceUID: `scan_${fileInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
          outputFilePath: `${fileInfo.path}/${fileInfo.name}`, // Use the actual file path
          mappings: {},
          anomalies: anomalies, // Keep the original anomalies array
          errors: [],
          quarantine: {},
        }

        // Add each scan anomaly result to the final results
        mapResultsList.push(scanAnomalyResult)
      })
    }

    progressCallback({
      response: 'done',
      mapResultsList: mapResultsList,
      processedFiles: mapResultsList.length,
      totalFiles: mapResultsList.length,
    })
  }
}

async function collectMappingOptions(
  organizeOptions: OrganizeOptions,
): Promise<TMappingWorkerOptions> {
  //
  // first, get the folder mappings and set output directory
  //
  const outputDirectory = organizeOptions.outputDirectory

  //
  // then, get the curation spec
  //
  const curationSpec = organizeOptions.curationSpec

  const { dicomPS315EOptions: deIdOpts, additionalData } =
    composeSpecs(curationSpec())

  // Parse the column mappings if the spec requires them and they exist.
  // The need for mapping can come from additionalData or from the
  // retainLongitudinalTemporalInformationOptions option
  let columnMappings: TColumnMappings | undefined
  if (organizeOptions.table && additionalData) {
    columnMappings = extractColumnMappings(
      organizeOptions.table,
      additionalData.mapping,
    )
  }

  const skipWrite = organizeOptions.skipWrite ?? false
  const skipModifications = organizeOptions.skipModifications ?? false
  const skipValidation = organizeOptions.skipValidation ?? false

  const dateOffset = organizeOptions.dateOffset

  if (requiresDateOffset(deIdOpts) && !dateOffset?.match(iso8601)) {
    throw new Error(
      'When using "Offset" for retainLongitudinalTemporalInformationOptions, an iso8601 compatible dateOffset must be provided.',
    )
  }

  return {
    outputDirectory,
    columnMappings,
    curationSpec,
    skipWrite,
    skipModifications,
    skipValidation,
    dateOffset,
  }
}

function queueFilesForMapping(
  organizeOptions: Extract<OrganizeOptions, { inputType: 'files' }>,
) {
  organizeOptions.inputFiles.forEach((inputFile, fileIndex) => {
    const fileInfo: TFileInfo = {
      path: '',
      name: inputFile.name,
      size: inputFile.size,
      kind: 'blob',
      blob: inputFile,
    }
    filesToProcess.push({
      fileInfo,
      fileIndex,
      scanAnomalies: [],
    })
  })
  // Dispatch jobs once after all files are queued to prevent race conditions
  dispatchMappingJobs()
}

let progressCallback: ProgressCallback

/**
 * Checks if UID collection is needed based on curation spec
 */
function needsUidCollection(mappingOptions: TMappingOptions): boolean {
  const curationSpec = composeSpecs(mappingOptions.curationSpec())

  return !(
    curationSpec.dicomPS315EOptions === 'Off' ||
    curationSpec.dicomPS315EOptions.retainUIDsOption === 'Hashed' ||
    curationSpec.dicomPS315EOptions.retainUIDsOption === 'On'
  )
}

/**
 * Collect all UIDs from files and generate a shared mapping
 * This ensures consistent UID replacement across all workers
 */
async function generateSharedUidMappings(
  files: { fileInfo: TFileInfo }[],
  mappingOptions: TMappingOptions,
): Promise<Record<string, string> | undefined> {
  if (!needsUidCollection(mappingOptions)) {
    return undefined
  }

  if (files.length === 0) {
    return undefined
  }

  console.log('Collecting UIDs from all files for consistent mapping...')

  // Collect all unique UIDs
  const allUids = new Set<string>()

  // Process files in batches to avoid overwhelming memory
  const batchSize = 100
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, Math.min(i + batchSize, files.length))

    const batchPromises = batch.map(async ({ fileInfo }) => {
      const uids = await collectUidsFromFile(fileInfo, mappingOptions)
      return uids
    })

    const batchResults = await Promise.all(batchPromises)
    batchResults.flat().forEach((uid) => allUids.add(uid))

    console.log(
      `Collected UIDs from ${Math.min(i + batchSize, files.length)}/${files.length} files`,
    )
  }

  if (allUids.size === 0) {
    console.log('No UIDs found that need mapping')
    return undefined
  }

  // Generate mappings for all unique UIDs
  const uidMappings: Record<string, string> = {}
  allUids.forEach((uid) => {
    uidMappings[uid] = dcmjs.data.DicomMetaDictionary.uid()
  })

  console.log(`Generated ${Object.keys(uidMappings).length} UID mappings`)

  return uidMappings
}

async function curateMany(
  organizeOptions: OrganizeOptions,
  onProgress?: ProgressCallback,
): Promise<TProgressMessageDone> {
  return new Promise<TProgressMessageDone>(async (resolve, reject) => {
    // Resolve promise if progressCallback gets called with 'done'
    progressCallback = (msg) => {
      onProgress?.(msg)

      if (msg.response === 'done') {
        resolve(msg)
      }
    }

    try {
      // create the mapping workers
      initializeMappingWorkers()

      // Set global mappingWorkerOptions
      mappingWorkerOptions = (await collectMappingOptions(
        organizeOptions,
      )) as TMappingWorkerOptions

      //
      // If the request provides a directory, then use the worker
      // to recursively convert to fileSystemHandles.
      // If the request provides a list of File objects,
      // send them to the mapping workers directly.
      //
      if (organizeOptions.inputType === 'directory') {
        const fileListWorker = initializeFileListWorker()
        const curationSpec = composeSpecs(organizeOptions.curationSpec())
        const specExcludedFiletypes = curationSpec.excludedFiletypes
        fileListWorker.postMessage({
          request: 'scan',
          directoryHandle: organizeOptions.inputDirectory,
          excludedFiletypes: specExcludedFiletypes,
        })

        // For directory input, we need to wait for the scan to finish before collecting UIDs
        // This is handled by waiting for filesToProcess to be populated
        // We'll do UID collection in a deferred way after files are discovered
      } else if (organizeOptions.inputType === 'files') {
        // For files input, queue all files first
        queueFilesForMapping(organizeOptions)

        // Check if UID collection is needed
        if (needsUidCollection(mappingWorkerOptions as TMappingOptions)) {
          // Generate shared UID mappings before processing
          const uidMappings = await generateSharedUidMappings(
            filesToProcess,
            mappingWorkerOptions as TMappingOptions,
          )
          if (uidMappings) {
            mappingWorkerOptions.uidMappings = uidMappings
          }
        }

        // Processing can start immediately for files input
        uidCollectionComplete = true
        directoryScanFinished = true
      } else {
        console.error('`inputType` should be "directory" or "files"')
      }
      dispatchMappingJobs()
    } catch (error) {
      reject(error)
    }
  })
}

export { curateMany, curateOne, extractColumnMappings, clearCaches }
