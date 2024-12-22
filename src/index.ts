import * as dcmjs from "dcmjs"


const a: string = `hello wide world`;

function getLog() {
    return dcmjs.log.currentLevel;
}

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

async function apply(organizeOptions) {
    console.log(organizeOptions);

    //
    // first, get the field mappings from the csv file
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
        fieldMappings.rowValues[rowIndex].forEach( (fieldValue, columnIndex) {
            fieldMappings.rowIndexByFieldValue[headers[columnIndex]][fieldValue] = rowIndex;
        });
    });

    console.log("fieldMappings");
    console.log(fieldMappings);

    //
    // second, get the mapping functions
    //
    const functionsFile = await organizeOptions.mappingFunctions.getFile();
    const functionsText = await functionsFile.text();

    console.log(functionsText);

    //
    // Then, scan through the files from the input directory and save them to the output
    //
    dcmjs.log.level = dcmjs.log.levels.ERROR;
    const fileEntryList = await scanDirectory(organizeOptions.inputDirectory);
    fileEntryList.forEach(async (fileEntry, index) => {
        const file = await fileEntry.fileHandle.getFile();
        const fileArrayBuffer = await file.arrayBuffer();

        const dicomData = dcmjs.data.DicomMessage.readFile(fileArrayBuffer);
        const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
        naturalData["PatientAge"] = "021Y";
        dicomData.dict = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(naturalData);
        const modifiedArrayBuffer = dicomData.write();

        const fileName = `file-${index}.dcm`;
        console.log(organizeOptions.outputDirectory);
        console.log(fileName);
        const fileHandle = await organizeOptions.outputDirectory.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(modifiedArrayBuffer);
        await writable.close();
    });

}


export { getLog, apply };

export default a
