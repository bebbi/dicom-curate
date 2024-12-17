# dcm-organize

Organize and de-identify DICOM header values and file hierarchies based on a provided configuration object.

## Why

This provides an open configuration language and a ready-to-use library for modifying DICOM headers for the purpose of de-identification and organization.

The library is toolkit-agnostic which means it provides the functionality to modify decoded DICOM headers. It does not include functionality to decode DICOM data.

## Usage

```
[newHeader, targetFilepath] = dcmOrganize(header, config)
```

## config

A function of current header values and file path
