import * as dcmjs from "dcmjs"

function getLog() {
    return dcmjs.log.currentLevel;
}

// TODO: this should be a stream so that large directory
// trees are not scanned all at once at the beginning
async function scanDirectory(dir) {
  const files = [];

  async function traverse(dir, prefix) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        files.push({
          path: prefix,
          name: entry.name,
          size: file.size,
          fileHandle: entry,
        });
      } else if (entry.kind === 'directory') {
        await traverse(entry, prefix + "/" + entry.name);
      }
    }
  }

  await traverse(dir, dir.name);
  return files;
}

async function createNestedDirectories(topLevelDirectoryHandle, path) {
  const pathSegments = path.split('/').filter(segment => segment !== '');

  let currentDirectoryHandle = topLevelDirectoryHandle;

  for (const segment of pathSegments) {
    try {
      // Attempt to get the directory handle without creating it
      const entry = await currentDirectoryHandle.getDirectoryHandle(segment, { create: false });
      currentDirectoryHandle = entry;
    } catch (error) {
      // If the error is specifically about the directory not existing, create it
      if (error.name === 'NotFoundError') {
        const entry = await currentDirectoryHandle.getDirectoryHandle(segment, { create: true });
        currentDirectoryHandle = entry;
      } else {
        // Handle other potential errors (e.g., name conflicts)
        return false; // Indicate failure
      }
    }
  }

  // Return the last directory handle
  return currentDirectoryHandle;
}

function applyMappings(dicomData, mappingOptions) {

    const mapResults = {
        dicomData: dicomData,
        filePath: "",
    };

    const parser = {
        getFilePathComp: (component) => {
            const pathComponents = mappingOptions.folderMappings.split("/");
            const componentIndex = pathComponents.indexOf(component);
            const filePathComponents = mappingOptions.fileEntry.path.split("/");
            return(filePathComponents[componentIndex]);
        },
        getMapping: (value, fromColumn, toColumn) => {
            const rowIndex = mappingOptions.fieldMappings.rowIndexByFieldValue[fromColumn][value];
            const columnIndex = mappingOptions.fieldMappings.headers.indexOf(toColumn);
            return mappingOptions.fieldMappings.rowValues[rowIndex][columnIndex];
        },
        getDicom: (tagName) => {
            return(dicomData[tagName]);
        },
        addDays: (dicomDateString, offsetDays) => {
            const year = Number(dicomDateString.slice(0,4));
            const monthIndex = Number(dicomDateString.slice(4,6)) - 1;
            const day = Number(dicomDateString.slice(6,8));
            const date = new Date(year, monthIndex, day);
            let time = date.getTime();
            const millisecondsPerDay = 1000 * 60 * 60 * 24;
            time += offsetDays * millisecondsPerDay;
            date.setTime(time);
            const yearString = date.getFullYear();
            const monthString = (date.getMonth()+1).toString().padStart(2,'0');
            const dayString = date.getDate().toString().padStart(2,'0');
            return yearString + monthString + dayString;
        },
    }

    let dicom = {};
    let filePath = [];
    eval(mappingOptions.mappingFunctions);

    // collect the key mappings before assigning them into dicomData
    const keyMappings = {};
    for (let key in dicom) {
        keyMappings[key] = dicom[key]();
    }
    for (let key in keyMappings) {
        mapResults.dicomData[key] = keyMappings[key];
    }

    mapResults.filePath = filePath.join("/");

    return mapResults;
}

async function apply(organizeOptions) {

    const mappingOptions = {};

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

    //
    // finally, scan through the files from the input directory and save them to the output
    //
    dcmjs.log.level = dcmjs.log.levels.ERROR;
    const fileEntryList = await scanDirectory(organizeOptions.inputDirectory);
    for (let fileEntry of fileEntryList) {

        mappingOptions.fileEntry = fileEntry;

        const file = await fileEntry.fileHandle.getFile();
        const fileArrayBuffer = await file.arrayBuffer();
        const dicomData = dcmjs.data.DicomMessage.readFile(fileArrayBuffer);
        const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);

        // do the actually header mapping
        const mapResults = applyMappings(naturalData, mappingOptions);
        const dirPath = mapResults.filePath.split("/").slice(0,-1).join("/");
        const fileName = mapResults.filePath.split("/").slice(-1);

        dicomData.dict = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(mapResults.dicomData);
        const modifiedArrayBuffer = dicomData.write();

        const subDirctoryHandle = await createNestedDirectories(organizeOptions.outputDirectory, dirPath);
        if (subDirctoryHandle == false) {
            console.error(`Cannot create directory for ${dirPath}`);
        } else {
            const fileHandle = await subDirctoryHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(modifiedArrayBuffer);
            await writable.close();
        }
    }

}


export { getLog, apply, createNestedDirectories };
