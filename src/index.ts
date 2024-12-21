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
