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
const filesToProcess = []
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
let mappingOptions = {} // TODO: only send to worker once
const availableMappingWorkers = []
let workersActive = 0
const mappingResultList = []

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
        mappingResultList.push(event.data.mapResults)
        workersActive -= 1
        dispatchMappingJobs()
        if ((mappingResultList.length - 1) % 100 == 0) {
          console.log(`Finished mapping ${mappingResultList.length} files`)
        }
        break
      default:
        console.error(`Unknown response from worker ${event.data.response}`)
    }
  })

  availableMappingWorkers.push(mappingWorker)
}

function dispatchMappingJobs() {
  while (filesToProcess.length > 0 && availableMappingWorkers.length > 0) {
    const fileInfo = filesToProcess.pop()
    const mappingWorker = availableMappingWorkers.pop()
    mappingWorker.postMessage({
      request: 'apply',
      fileInfo: fileInfo,
      mappingOptions: mappingOptions,
    })
    workersActive += 1
  }
  if (
    workersActive == 0 &&
    directoryScanFinished &&
    filesToProcess.length == 0
  ) {
    console.log('job is finished')
    console.log(mappingResultList)
  }
}

async function collectMappingOptions(organizeOptions) {
  //
  // first, get the folder mappings and set output directory
  //
  mappingOptions.folderMappings = organizeOptions.filePathPattern
  mappingOptions.outputDirectory = organizeOptions.outputDirectory

  //
  // then, get the field mappings from the csv file
  //
  // assumes all fields are not repeated across rows
  const csvFile = await organizeOptions.fieldMapping.getFile()
  const csvText = await csvFile.text()
  const rows = csvText.trim().split('\n')
  const headers = rows.slice(0, 1)[0].split(',')
  const fieldMappings = {
    headers: headers,
    rowValues: {},
    rowIndexByFieldValue: {},
  }
  headers.forEach((header) => {
    fieldMappings.rowIndexByFieldValue[header] = {}
  })
  rows.slice(1).forEach((row, rowIndex) => {
    fieldMappings.rowValues[rowIndex] = row.split(',')
    fieldMappings.rowValues[rowIndex].forEach((fieldValue, columnIndex) => {
      fieldMappings.rowIndexByFieldValue[headers[columnIndex]][fieldValue] =
        rowIndex
    })
  })
  mappingOptions.fieldMappings = fieldMappings

  //
  // then, get the mapping functions
  //
  const functionsFile = await organizeOptions.mappingFunctions.getFile()
  mappingOptions.mappingFunctions = await functionsFile.text()
}

async function apply(organizeOptions) {
  await collectMappingOptions(organizeOptions) // sets global mappingOptions
  fileListWorker.postMessage({
    request: 'scan',
    directoryHandle: organizeOptions.inputDirectory,
  })
  dispatchMappingJobs()
}

export { apply }
