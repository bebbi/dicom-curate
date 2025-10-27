# [0.10.0](https://github.com/bebbi/dicom-curate/compare/v0.9.0...v0.10.0) (2025-10-27)

### Features

- handle worker files in UMD build ([43bcf28](https://github.com/bebbi/dicom-curate/commit/43bcf2862eb9605d01101d6855a64b25c49ac073))
- node.js environment support ([9c39240](https://github.com/bebbi/dicom-curate/commit/9c3924009b89fb7011832b93f5adb6269e4fe3c0))

# [0.9.0](https://github.com/bebbi/dicom-curate/compare/v0.8.5...v0.9.0) (2025-10-23)

### Features

- reset scanAnomalies for all input types ([baf945c](https://github.com/bebbi/dicom-curate/commit/baf945c79d19b7b46d6ac7c2bbdaa06ba1ae0246))

## [0.8.5](https://github.com/bebbi/dicom-curate/compare/v0.8.4...v0.8.5) (2025-10-21)

### Bug Fixes

- remove also the remaining caching ([6a9076b](https://github.com/bebbi/dicom-curate/commit/6a9076b6c671ead46dad86896f2c2df5e786eff0))
- remove uid cache due to issues with multiple workers ([d1f1a2e](https://github.com/bebbi/dicom-curate/commit/d1f1a2e70fb4761b1b54657e4d6e2c9c07bbc596))
- remove unique file name check/cache ([0e06103](https://github.com/bebbi/dicom-curate/commit/0e06103bf49b9e4b1af561dcfeaccc6fb103ffca))

## [0.8.4](https://github.com/bebbi/dicom-curate/compare/v0.8.3...v0.8.4) (2025-10-21)

### Bug Fixes

- update release and ci pipelines to include typecheck and lint steps ([ab20cd6](https://github.com/bebbi/dicom-curate/commit/ab20cd61673727f554439d5f8b9e5867ff80d60a))

## [0.8.3](https://github.com/bebbi/dicom-curate/compare/v0.8.2...v0.8.3) (2025-10-20)

### Bug Fixes

- prevent global state mutation in composeSpecs causing stack overflow ([ae8f909](https://github.com/bebbi/dicom-curate/commit/ae8f909488daf248cafef7fe95f3250bd038217a))
- resolve CD linting errors in composeSpecs tests ([819824d](https://github.com/bebbi/dicom-curate/commit/819824d341c8f0e200ff4a4b88017e332339a5d1))

## [0.8.2](https://github.com/bebbi/dicom-curate/compare/v0.8.1...v0.8.2) (2025-09-17)

### Bug Fixes

- add missing conditionals in collectMappings to safely call getMappings ([15bde4f](https://github.com/bebbi/dicom-curate/commit/15bde4f880edb064d34c71a1472f052b00b9f571))

## [0.8.1](https://github.com/bebbi/dicom-curate/compare/v0.8.0...v0.8.1) (2025-09-16)

### Bug Fixes

- fix sample composite spec hostProps context availability ([b537a34](https://github.com/bebbi/dicom-curate/commit/b537a34a3af6c70eb1d082192daa6ea6dcff01fb))

# [0.8.0](https://github.com/bebbi/dicom-curate/compare/v0.7.1...v0.8.0) (2025-09-16)

### Bug Fixes

- exclude RegExp objects from deep merging ([49729f7](https://github.com/bebbi/dicom-curate/commit/49729f7e4048491af6abea79a538893aea7025fa))
- handle empty cleanDescriptorsExceptions arrays for backwards compatibility ([ac943cd](https://github.com/bebbi/dicom-curate/commit/ac943cdd2e0fb2282b9a339d202f1b26d1e0fcf3))
- preserve composeSpecs arrays before spread operation ([412d9b3](https://github.com/bebbi/dicom-curate/commit/412d9b3bc43506e718b0e248101ceac0fd8743a4))

### Features

- add composite spec draft ([1fc5f16](https://github.com/bebbi/dicom-curate/commit/1fc5f1623e44318ed54f3f585daf9d33c477926c))
- add explicit reset support to cleanDescriptorsExceptions ([d751048](https://github.com/bebbi/dicom-curate/commit/d751048ddbeb0fd030f87f0f94cc9c8e7f6774ff))
- export composeSpecs and SpecPart type ([7fb5664](https://github.com/bebbi/dicom-curate/commit/7fb566423896c8c882d9067ded7c06c443be1241))

### Reverts

- Revert "fix: handle empty cleanDescriptorsExceptions arrays for backwards compatibility" ([dad53e2](https://github.com/bebbi/dicom-curate/commit/dad53e2d1f6b141f01d0c37d02ad0d7d7ec966c3))

## [0.7.1](https://github.com/bebbi/dicom-curate/compare/v0.7.0...v0.7.1) (2025-09-09)

### Bug Fixes

- add missing conditional ([dd09a01](https://github.com/bebbi/dicom-curate/commit/dd09a01cb4cb76838a34324ec85b1473bd4df521))
- resolve warning around missing case statement braces ([88b0910](https://github.com/bebbi/dicom-curate/commit/88b091082f188d45167db89948ea67ad4502dbc4))

# [0.7.0](https://github.com/bebbi/dicom-curate/compare/v0.6.1...v0.7.0) (2025-09-02)

### Bug Fixes

- correct wrongly spelled DICOM names (e.g. 'PatientsWeight' is corrected to 'PatientWeight') ([fb4e6a4](https://github.com/bebbi/dicom-curate/commit/fb4e6a4ac0fd185b7cc921bd855295037da7ace7))

### Features

- simplify TCurationSpecification ([40602ec](https://github.com/bebbi/dicom-curate/commit/40602ecd5e2d4c53e26b16c08d66b6cb0acc83a9))

## [0.6.1](https://github.com/bebbi/dicom-curate/compare/v0.6.0...v0.6.1) (2025-09-02)

### Bug Fixes

- add correct block scope for case statements ([cebdd9e](https://github.com/bebbi/dicom-curate/commit/cebdd9ef8c91c2b425187458ff36beb0630d7f12))

# [0.6.0](https://github.com/bebbi/dicom-curate/compare/v0.5.1...v0.6.0) (2025-09-01)

### Features

- handle DICOM files with VR length violations ([d0a23fd](https://github.com/bebbi/dicom-curate/commit/d0a23fd707fe9a9aa1a846d99d458d415085c777))

## [0.5.1](https://github.com/bebbi/dicom-curate/compare/v0.5.0...v0.5.1) (2025-08-29)

### Bug Fixes

- add no-verify to internal (CI) semantic-release commits ([6cd4887](https://github.com/bebbi/dicom-curate/commit/6cd4887eef27629fba608a0afba7fab95f4fe027))
- disable husky in release pipeline ([f1403b4](https://github.com/bebbi/dicom-curate/commit/f1403b4cad4d6f1b7279968ed0c1bcee4b140e26))
- get semantic-release going again ([be190d7](https://github.com/bebbi/dicom-curate/commit/be190d7e17396e1a4891333151485961edac717c))
- make esbuild (ESM) output equivalent with bebbiscript versions ([af98589](https://github.com/bebbi/dicom-curate/commit/af985892538ee01c9dc4518b5d40abf571a2e549))

# [0.5.0](https://github.com/bebbi/dicom-curate/compare/v0.4.1...v0.5.0) (2025-08-21)

### Features

- add file-exclusions to anomalies array in mapresults ([8ac59d6](https://github.com/bebbi/dicom-curate/commit/8ac59d601c05ca93a0bc2cd208e8d9030deae788))
- implement file-exclusion logic into scanDirectoryWorker and specifications ([b9a3552](https://github.com/bebbi/dicom-curate/commit/b9a3552a158a1b931a4b0b42b5af3952415e3f55))

## [0.4.1](https://github.com/bebbi/dicom-curate/compare/v0.4.0...v0.4.1) (2025-08-13)

### Bug Fixes

- handle nested private tags and temporal offsets with leading/trailing whitespace ([1783214](https://github.com/bebbi/dicom-curate/commit/178321492963dd0eaa6165fc0a882c188576415d))

# [0.4.0](https://github.com/bebbi/dicom-curate/compare/v0.3.0...v0.4.0) (2025-07-27)

### Features

- default outputFilePathComponents are not relying original instance UIDs ([a2fc7cf](https://github.com/bebbi/dicom-curate/commit/a2fc7cf2c3e6a8a121be00396bb6e88390516e14))
- parser exposes the protectUid function to protect instance uids ([32efaa6](https://github.com/bebbi/dicom-curate/commit/32efaa6fe4bc1992ea039ac19f7a9c347931603f))
- scan directory worker passes the sequence number of the file to process within the directory ([4e65a45](https://github.com/bebbi/dicom-curate/commit/4e65a45e5569b7ae9c66d6f53584cfda0d142d55))

# [0.3.0](https://github.com/bebbi/dicom-curate/compare/v0.2.0...v0.3.0) (2025-07-16)

### Features

- `curateMany` returns a promise that resolves when all is done ([0d97606](https://github.com/bebbi/dicom-curate/commit/0d9760673649d2addce8c1bdab5ab85e8ea2d690))
- `onProgress` is called when job is done with a response of `done` and the `mapResultsList` ([a343261](https://github.com/bebbi/dicom-curate/commit/a343261f63eb41f8c0601969a50296332d730891))

# [0.2.0](https://github.com/bebbi/dicom-curate/compare/v0.1.2...v0.2.0) (2025-07-03)

### Features

- add UMD build output using Rollup ([6fdaeb5](https://github.com/bebbi/dicom-curate/commit/6fdaeb542a122ca8bc28b43ef54ca28e04ca675e))

## [0.1.2](https://github.com/bebbi/dicom-curate/compare/v0.1.1...v0.1.2) (2025-06-07)

### Bug Fixes

- add build step to npm publish ([7e624be](https://github.com/bebbi/dicom-curate/commit/7e624be5efd1bfc797c6e25b15291bf133b3a081))

## [0.1.1](https://github.com/bebbi/dicom-curate/compare/v0.1.0...v0.1.1) (2025-06-07)

### Bug Fixes

- add debug log ([0894383](https://github.com/bebbi/dicom-curate/commit/08943833e90369805ba513e9a4fa7138a0cab90c))
- do release workflow as a registered app circumvents branch protection ([ac4cbe7](https://github.com/bebbi/dicom-curate/commit/ac4cbe7c2b99a1e6949616c43185f7aab36a3199))
- permissions in action, assign identity ([047ba67](https://github.com/bebbi/dicom-curate/commit/047ba67eda2cbfafcf2a8e0e8d055f6dfb7e5574))
