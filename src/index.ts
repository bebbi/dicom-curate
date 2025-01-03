
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
const workerFileList = [];
const fileListWorker = new Worker(new URL("./scanDirectoryWorker.js", import.meta.url));
let directoryScanFinished = false;
fileListWorker.addEventListener("message", (event) => {
  switch (event.data.response) {
    case 'file':
      workerFileList.push(event.data.fileInfo);
      if (workerFileList.length > 10) {
        fileListWorker.postMessage({ request: "stop" });
      }
      dispatchMappingJobs();
      break;
    case 'done':
      directoryScanFinished = true;
      break;
    default:
      console.error(`Unknown response from worker ${event.data.response}`);
  }
  dispatchMappingJobs();
});


//
// Apply mappings web worker management
//
// worker accepts these messages:
//   request: 'apply', fileInfo, mappingOptions
// worker sends these messages:
//   response: 'finished', mapResults
//
let mappingOptions = {}; // TODO: only send to worker once
const freeMappingWorkers = [];
const busyStateByWorker = {};
const mappingResultList = [];

for (let workerIndex = 0; workerIndex < navigator.hardwareConcurrency; workerIndex++) {
  const mappingWorker = new Worker(new URL("./applyMappingsWorker.js", import.meta.url), {type: 'module'});

  mappingWorker.addEventListener("message", (event) => {
    switch (event.data.response) {
      case 'finished':
        mappingResultList.push(event.data.mappingResults);
        freeMappingWorkers.push(mappingWorker);
        dispatchMappingJobs();
        break;
      default:
        console.error(`Unknown response from worker ${event.data.response}`);
    }
  });

  busyStateByWorker[mappingWorker] = false;
  freeMappingWorkers.push(mappingWorker);
}

function dispatchMappingJobs() {
  const workersFree = Object.values(busyStateByWorker).reduce((a,b) => {return a && b});
  if ( directoryScanFinished && workersFree ) {
    console.log("job is finished");
  }
  while (workerFileList.length > 0 && freeMappingWorkers.length > 0) {
    const fileInfo = workerFileList.pop();
    const mappingWorker = freeMappingWorkers.pop();
    mappingWorker.postMessage({
      request: 'apply',
      fileInfo: fileInfo,
      mappingOptions: mappingOptions,
    });
    busyStateByWorker[mappingWorker] = true;
  }

  if ((mappingResultList.length-1) % 100 == 0) {
    console.log(`Finished mapping ${mappingResultList.length} files`);
  }
}

async function collectMappingOptions(organizeOptions) {

    //
    // first, get the folder mappings
    //
    mappingOptions.folderMappings = organizeOptions.filePathPattern;

    //
    // then, get the field mappings from the csv file
    //
    // assumes all fields are not repeated across rows
    const csvFile = await organizeOptions.fieldMapping.getFile();
    const csvText = await csvFile.text();
    const rows = csvText.trim().split("\n");
    const headers = rows.slice(0,1)[0].split(",");
    const fieldMappings = {
        headers: headers,
        rowValues : {},
        rowIndexByFieldValue : {},
    };
    headers.forEach((header) => {
        fieldMappings.rowIndexByFieldValue[header] = {};
    });
    rows.slice(1).forEach( (row, rowIndex) => {
        fieldMappings.rowValues[rowIndex] = row.split(",");
        fieldMappings.rowValues[rowIndex].forEach( (fieldValue, columnIndex) => {
            fieldMappings.rowIndexByFieldValue[headers[columnIndex]][fieldValue] = rowIndex;
        });
    });
    mappingOptions.fieldMappings = fieldMappings;

    //
    // then, get the mapping functions
    //
    const functionsFile = await organizeOptions.mappingFunctions.getFile();
    mappingOptions.mappingFunctions = await functionsFile.text();
}

async function apply(organizeOptions) {
  fileListWorker.postMessage({ request: "scan", directoryHandle: organizeOptions.inputDirectory });
  await collectMappingOptions(organizeOptions); // sets global
  dispatchMappingJobs();
}

export { apply };
