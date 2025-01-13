import * as dcmjs from "dcmjs";
import * as mapdefaults from "./mapdefaults.js";
import * as uuid from "uuid";

// value defined here:
// https://www.rfc-editor.org/rfc/rfc9562#name-uuid-version-5
const oidNamespace = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";
const uuidBasedUIDPrefix = "2.25.";

self.addEventListener("message", (event) => {
  switch (event.data.request) {
    case 'apply':
      try {
        applyMappings(event.data.fileInfo, event.data.mappingOptions).then( (mapResults) => {
          self.postMessage({
            response: "finished",
            mapResults: mapResults,
          });
        });
      } catch (error) {
        self.postMessage({response: "error", error});
        throw new Error("ERROR");
      }
      break;
    default:
      console.error(`Unknown request ${event.data.request}`);
  }
});

// See https://github.com/bebbi/dcm-organize/issues/7
function uidToV5BasedUID(uid) {
  const hashedUID = uuid.v5(uid, oidNamespace);
  const hashedUIDBytes = uuid.parse(hashedUID);
  let mappedUID = uuidBasedUIDPrefix;
  for (const byte of hashedUIDBytes) {
    mappedUID += String(byte).padStart(3, '0');
  }
  return mappedUID;
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

async function applyMappings(fileInfo, mappingOptions) {

    const mapResults = {};

    //
    // First, read the dicom instance data from the file handle
    //
    const file = await fileInfo.fileHandle.getFile();
    const fileArrayBuffer = await file.arrayBuffer();
    // TODO: capture validation data in object and save as part of results object
    dcmjs.log.setLevel(dcmjs.log.levels.ERROR);
    dcmjs.log.getLogger("validation.dcmjs").setLevel(dcmjs.log.levels.SILENT);
    const dicomData = dcmjs.data.DicomMessage.readFile(fileArrayBuffer);

    //
    // Then, remove private tags
    // TODO: add option for `allowlist` of private tags
    for (let hexTag in dicomData.dict) {
        if (Number(hexTag[3] % 2) == 1) {
            delete dicomData.dict[hexTag];
        }
    }

    // Make make the naturalized data so parser code operates on with tags not hex
    const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    mapResults.sourceInstanceUID = naturalData.SOPInstanceUID;

    //
    // Then, do the actually header mapping
    //

    // create a parser object to be used in the mappingFunctions
    const parser = {
        getFilePathComp: (component) => {
            const pathComponents = mappingOptions.folderMappings.split("/");
            const componentIndex = pathComponents.indexOf(component);
            const filePathComponents = fileInfo.path.split("/");
            return(filePathComponents[componentIndex]);
        },
        getMapping: (value, fromColumn, toColumn) => {
            const rowIndex = mappingOptions.fieldMappings.rowIndexByFieldValue[fromColumn][value];
            const columnIndex = mappingOptions.fieldMappings.headers.indexOf(toColumn);
            return mappingOptions.fieldMappings.rowValues[rowIndex][columnIndex];
        },
        getDicom: (tagName) => {
            return(naturalData[tagName]);
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

    // run the mapping functions that set the following two variables
    let dicom = {};
    let filePath = [];
    eval(mappingOptions.mappingFunctions);
    mapResults.filePath = filePath.join("/");

    // collect the tag mappings before assigning them into dicomData
    mapResults.tagMappings = {};
    for (let tag in dicom) {
        mapResults.tagMappings[tag] = dicom[tag]();
    }
    for (let tag in mapResults.tagMappings) {
        naturalData[tag] = mapResults.tagMappings[tag];
    }

    // Now apply the standard mappings
    const nameMap = dcmjs.data.DicomMetaDictionary.nameMap;
    // Recursive function to handle sequences (naturalData is a top-level data)
    function mapTagsInData (data) {
        for (let tag of Object.keys(data)) {
            if (/_.*/.test(tag)) {
                continue; // ignore tags marked internal with leading underscore
            }
            if (tag in nameMap) { // means it's a known tag
                let vr = nameMap[tag].vr;
                if (vr == "SQ") {
                    for (let subdata of Object.values(data[tag])) {
                        mapTagsInData(subdata);
                    }
                } else {
                  if (vr == "UI") {
                      if (mapdefaults.instanceUIDs.indexOf(tag) != -1) { // UIDs that need to be mapped
                          const uid = data[tag];
                          const mappedUID = uidToV5BasedUID(uid);
                          data[tag] = mappedUID;
                          mapResults.tagMappings[tag] = mappedUID;
                      }
                  } else {
                      // other tags are handled according to mapdefaults rules
                      if (tag in mapdefaults.tagNamesToEmpty) {
                          delete data[tag];
                      } else {
                          if (! tag in mapdefaults.tagNamesToAlwaysKeep) {
                              console.error(`instance contains tag ${tag} that is not defined in mapdefaults.  Deleting it.`);
                              delete data[tag];
                          }
                      }
                  }
               }
            } else {
                // TODO: this should go in the validation log
                console.error(`instance contains non-private tag ${tag} that is not in dictionary.  Deleting it.`);
                delete data[tag];
            }
        }
    }
    mapTagsInData(naturalData);

    // Finally, write the results
    const dirPath = mapResults.filePath.split("/").slice(0,-1).join("/");
    const fileName = mapResults.filePath.split("/").slice(-1);
    dicomData.dict = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(naturalData);
    const modifiedArrayBuffer = dicomData.write();
    const subDirctoryHandle = await createNestedDirectories(mappingOptions.outputDirectory, dirPath);
    if (subDirctoryHandle == false) {
        console.error(`Cannot create directory for ${dirPath}`);
    } else {
        const fileHandle = await subDirctoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(modifiedArrayBuffer);
        await writable.close();
    }

    return mapResults;
}
