import { sampleBatchCurationSpecification } from './sampleBatchCurationSpecification'
import type { TCurationSpecification } from '../types'

/*
 * Sample of a 2-pass curation specification.
 * First pass: collect the mapping input from the listing
 * Second pass: load the mapping output from the CSV file
 */
export function sample2PassCurationSpecification(): TCurationSpecification {
  const batchSpec = sampleBatchCurationSpecification()
  const identifiers = batchSpec.identifiers
  return {
    ...batchSpec,
    additionalData: {
      // type listing is to collect the mapping input in a first pass.
      type: 'listing',
      // function if firstPass
      collect: (parser) => {
        const lookups = {
          PatNamePatId: ['PatientName', 'PatientID']
            .map(parser.getDicom)
            .join('='),
          PatNameSeriesDesc: ['PatientName', 'PatientID', 'SeriesDescription']
            .map(parser.getDicom)
            .join('='),
        }
        return {
          lookups,
          info: [
            // [label, value]
            ['Patient Name', parser.getDicom('PatientName')],
            ['Patient ID', parser.getDicom('PatientID')],
            ['Study Date', parser.getDicom('StudyDate')],
            ['Study Description', parser.getDicom('StudyDescription')],
            ['Series Date', parser.getDicom('SeriesDate')],
            ['Series Description', parser.getDicom('SeriesDescription')],
            ['Modality', parser.getDicom('Modality')],
          ],
          // This will imply a CSV with headers:
          // PatNamePatId | PatNameSeriesDesc | CenterSubjectId | Timepoint | Comment
          // [lookup header, format, lookup value]
          collect: [
            ['CenterSubjectId', identifiers.centerSubjectId, 'PatNamePatId'],
            ['Timepoint', identifiers.timepointNames, 'PatNameSeriesDesc'],
            ['Comment', /.*/, 'PatNameSeriesDesc'],
          ],
        }
      },
      // type: 'load',
      // collect: {
      //   CURR_ID: identifiers.centerSubjectId,
      //   StudyDescription: identifiers.timepointNames,
      //   MAPPED_ID: /BLIND_\d+/,
      // },
      // With this, can refer to mappings as parser.getMapping('blindedId')
      mapping: {
        // csv situation
        blindedId: {
          value: (parser) => parser.getDicom('PatientID'),
          lookup: (row) => row['CURR_ID'],
          replace: (row) => row['MAPPED_ID'],
        },
        // firstPass situation
        centerSubjectId: {
          value: (parser) =>
            ['PatientName', 'PatientID'].map(parser.getDicom).join('='),
          // TODO: could rely on lookup and not need the combined field or field name
          lookup: (row) => row['PatNamePatId'],
          replace: (row) => row['CenterSubjectId'],
        },
      },
    },
  }
}
