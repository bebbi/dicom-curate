import { extractCsvMappings } from './csvMapping'
import type {
  TMappingOptions,
  TMapResults,
  TFileInfo,
  OrganizeOptions,
} from './types'

//const mappingWorkerCount = 2;
const mappingWorkerCount = navigator.hardwareConcurrency

//
// Directory scanner web worker management
//
// worker accepts these messages:
//   command: 'scan', directoryHandle
//   command: 'stop'
// worker sends these messages:
//   response: 'file', file info (path, name, size, fileHandle)
//   response: 'done'
//
// TODO: implement a buffering stream to request fileHandles in batches
const filesToProcess: TFileInfo[] = []
const fileListWorker = new Worker(
  new URL('./scanDirectoryWorker.js', import.meta.url),
)
let directoryScanFinished = false
fileListWorker.addEventListener('message', (event) => {
  switch (event.data.response) {
    case 'file':
      filesToProcess.push(event.data.fileInfo)
      if (filesToProcess.length > 10) {
        fileListWorker.postMessage({ request: 'stop' })
      }
      dispatchMappingJobs()
      break
    case 'done':
      console.log('directoryScanFinished')
      directoryScanFinished = true
      break
    default:
      console.error(`Unknown response from worker ${event.data.response}`)
  }
  dispatchMappingJobs()
})

//
// Apply mappings web worker management
//
// worker accepts these messages:
//   request: 'apply', fileInfo, mappingOptions
// worker sends these messages:
//   response: 'finished', mapResults
//
let mappingOptions: Partial<TMappingOptions> = {} // TODO: only send to worker once
const availableMappingWorkers: Worker[] = []
let workersActive = 0
const mapResultsList: TMapResults[] = []

for (let workerIndex = 0; workerIndex < mappingWorkerCount; workerIndex++) {
  let mappingWorker = new Worker(
    new URL('./applyMappingsWorker.js', import.meta.url),
    { type: 'module' },
  )
  mappingWorker.onerror = console.error

  /* eslint-disable no-loop-func */
  mappingWorker.addEventListener('message', (event) => {
    switch (event.data.response) {
      case 'finished':
        availableMappingWorkers.push(mappingWorker)
        mapResultsList.push(event.data.mapResults)
        workersActive -= 1
        dispatchMappingJobs()
        if ((mapResultsList.length - 1) % 100 === 0) {
          console.log(`Finished mapping ${mapResultsList.length} files`)
        }
        break
      default:
        console.error(`Unknown response from worker ${event.data.response}`)
    }
  })
  /* eslint-enable no-loop-func */

  availableMappingWorkers.push(mappingWorker)
}

function dispatchMappingJobs() {
  while (filesToProcess.length > 0 && availableMappingWorkers.length > 0) {
    const fileInfo = filesToProcess.pop()!
    const mappingWorker = availableMappingWorkers.pop()!
    mappingWorker.postMessage({ request: 'apply', fileInfo, mappingOptions })
    workersActive += 1
  }
  if (
    workersActive === 0 &&
    directoryScanFinished &&
    filesToProcess.length === 0
  ) {
    console.log('job is finished')
    console.log(mapResultsList)
  }
}

async function collectMappingOptions(
  organizeOptions: OrganizeOptions,
): Promise<TMappingOptions> {
  //
  // first, get the folder mappings and set output directory
  //
  const inputPathPattern = organizeOptions.filePathPattern
  const outputDirectory = organizeOptions.outputDirectory

  //
  // then, get the field mappings from the csv file
  //
  // assumes all fields are not repeated across rows
  const csvFile = await organizeOptions.fieldMapping.getFile()
  const fieldMappings = await extractCsvMappings(csvFile)

  //
  // then, get the mapping functions
  //
  const functionsFile = await organizeOptions.mappingFunctions.getFile()
  const mappingFunctions = await functionsFile.text()

  return { inputPathPattern, outputDirectory, fieldMappings, mappingFunctions }
}

async function apply(organizeOptions: OrganizeOptions) {
  // Set global mappingOptions
  mappingOptions = (await collectMappingOptions(
    organizeOptions,
  )) as TMappingOptions
  fileListWorker.postMessage({
    request: 'scan',
    directoryHandle: organizeOptions.inputDirectory,
  })
  dispatchMappingJobs()
}

export { apply }
