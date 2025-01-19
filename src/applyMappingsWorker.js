import * as dcmjs from "dcmjs";
import * as mapdefaults from "./mapdefaults.js";
import * as uuid from "uuid";
import {get as _get, set as _set, unset as _unset, cloneDeep as _cloneDeep} from "lodash";

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

function collectMappings(fileInfo, dicomData, mappingOptions) {

    // Returns [naturalData, mapResults]
    // sourceInstanceUID : original UID for this dicomData
    // filePath : assembled string of path components
    // mappings are object of the form:
    // key:
    //   "path" : string compatible with lodash get/set
    // value list elements:
    //   "originalValue" : value from the dicomData
    //   "mapOperation" : one of "replace", "delete"
    //   "mappedValue" : replacement for "replace" operation
    // "anomalies" : a list of text strings describing any unexpected contents of the data
    const mapResults = {
        sourceInstanceUID : undefined,
        filePath : "",
        mappings : {},
        anomalies : [],
    };

    //
    // collect private tags and mark them for delete
    // TODO: put this in recursive function to find nested private tags
    // TODO: add option for `allowlist` of private tags taken from 3.15E and TCIA table
    for (let hexTag in dicomData.dict) {
        if (Number(hexTag[3] % 2) == 1) {
            mapResults.mappings["x"+hexTag] = [String(dicomData.dict[hexTag].Value), "delete", undefined];
        }
    }

    // Make make the naturalized data so parser code operates on with tags not hex
    const naturalData = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    mapResults.sourceInstanceUID = naturalData.SOPInstanceUID;

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
            if (tagName in dcmjs.data.DicomMetaDictionary.dictionary) { // if in hex like "(0008,0100)"
                tagName = dcmjs.data.DicomMetaDictionary.dictionary[tagName].name;
            }
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
    // - Note the mappingFunctions return a dictionary called 'dicom' of functions to call
    //   for each tag they want to map
    for (let tagPath in dicom) {
        mapResults.mappings[tagPath] = [_get(naturalData, tagPath), "replace", dicom[tagPath]()];
    }

    // Now collect the standard mappings with a
    // recursive function to handle sequences (naturalData is a top-level instance of data).
    // Calls modify mapResults in the outer function scope.
    const nameMap = dcmjs.data.DicomMetaDictionary.nameMap;
    function collectMappingsInData (data, path="") {
        for (let tag in data) {
            if (/_.*/.test(tag)) {
                continue; // ignore tags marked internal with leading underscore
            }
            const tagPath = path+tag;
            if (tag in nameMap) { // means it's a known tag
                let vr = nameMap[tag].vr;
                if (vr == "SQ") {
                    let subDataIndex = 0;
                    for (let subData of Object.values(data[tag])) {
                        let subPath = `${path}${tag}[${subDataIndex}].`;
                        collectMappingsInData(subData, subPath);
                        subDataIndex += 1;
                    }
                } else {
                  if (vr == "UI") {
                      if (mapdefaults.instanceUIDs.indexOf(tag) != -1) { // UIDs that need to be mapped
                          const uid = data[tag];
                          const mappedUID = uidToV5BasedUID(uid);
                          mapResults.mappings[tagPath] = [uid, "replace", mappedUID];
                      }
                  } else {
                      // other tags are handled according to mapdefaults rules
                      if (tag in mapdefaults.tagNamesToEmpty) {
                          mapResults.mappings[tagPath] = [data[tag], "delete", undefined];
                      } else {
                          if (! tag in mapdefaults.tagNamesToAlwaysKeep) {
                              mapResults.anomalies.push(`instance contains tag ${tag} that is not defined in mapdefaults.  Marking it for deletion.`);
                              mapResults.mappings[tagPath] = [data[tag], "delete", undefined];
                          }
                      }
                  }
               }
            } else {
                mapResults.anomalies.push(`instance contains non-private tag ${tag} that is not in dictionary.  Marking it for deletion.`);
                mapResults.mappings[tagPath] = [data[tag], "delete", undefined];
            }
        }
    }
    collectMappingsInData(naturalData);

    return [naturalData, mapResults];
}

async function applyMappings(fileInfo, mappingOptions) {

    //
    // First, read the dicom instance data from the file handle
    //
    const file = await fileInfo.fileHandle.getFile();
    const fileArrayBuffer = await file.arrayBuffer();
    // TODO: capture validation data in object and save as part of results object
    dcmjs.log.setLevel(dcmjs.log.levels.ERROR);
    dcmjs.log.getLogger("validation.dcmjs").setLevel(dcmjs.log.levels.SILENT);
    let dicomData;
    try {
      dicomData = dcmjs.data.DicomMessage.readFile(fileArrayBuffer);
    } catch(error) {
      const mapResults = {
        anomalies : [`Could not parse ${fileInfo.name} as dicom data`)]
      };
      return mapResults;
    }

    //
    // then collect the mappings and apply them to the data
    //
    const [naturalData, mapResults] = collectMappings(fileInfo, dicomData, mappingOptions);
    for (let tagPath in mapResults.mappings) {
        const [_, operation, mappedValue] = mapResults.mappings[tagPath];
        switch (operation) {
          case "delete":
            _unset(naturalData, tagPath);
          break;
          case "replace":
            _set(naturalData, tagPath, mappedValue);
          break;
          default:
            console.error(`Bad operation ${operation} in mappings`);
        }
    }

// TODO: apply mappings to metaheader information
// TODO: doublecheck logic for private tags in sequences (check dictionary version)


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

    const clonedMapResults = _cloneDeep(mapResults);
    return clonedMapResults;
}
