# [0.4.0](https://github.com/bebbi/dicom-curate/compare/v0.3.0...v0.4.0) (2025-07-27)


### Features

* default outputFilePathComponents are not relying original instance UIDs ([a2fc7cf](https://github.com/bebbi/dicom-curate/commit/a2fc7cf2c3e6a8a121be00396bb6e88390516e14))
* parser exposes the protectUid function to protect instance uids ([32efaa6](https://github.com/bebbi/dicom-curate/commit/32efaa6fe4bc1992ea039ac19f7a9c347931603f))
* scan directory worker passes the sequence number of the file to process within the directory ([4e65a45](https://github.com/bebbi/dicom-curate/commit/4e65a45e5569b7ae9c66d6f53584cfda0d142d55))

# [0.3.0](https://github.com/bebbi/dicom-curate/compare/v0.2.0...v0.3.0) (2025-07-16)


### Features

* `curateMany` returns a promise that resolves when all is done ([0d97606](https://github.com/bebbi/dicom-curate/commit/0d9760673649d2addce8c1bdab5ab85e8ea2d690))
* `onProgress` is called when job is done with a response of `done` and the `mapResultsList` ([a343261](https://github.com/bebbi/dicom-curate/commit/a343261f63eb41f8c0601969a50296332d730891))

# [0.2.0](https://github.com/bebbi/dicom-curate/compare/v0.1.2...v0.2.0) (2025-07-03)


### Features

* add UMD build output using Rollup ([6fdaeb5](https://github.com/bebbi/dicom-curate/commit/6fdaeb542a122ca8bc28b43ef54ca28e04ca675e))

## [0.1.2](https://github.com/bebbi/dicom-curate/compare/v0.1.1...v0.1.2) (2025-06-07)


### Bug Fixes

* add build step to npm publish ([7e624be](https://github.com/bebbi/dicom-curate/commit/7e624be5efd1bfc797c6e25b15291bf133b3a081))

## [0.1.1](https://github.com/bebbi/dicom-curate/compare/v0.1.0...v0.1.1) (2025-06-07)


### Bug Fixes

* add debug log ([0894383](https://github.com/bebbi/dicom-curate/commit/08943833e90369805ba513e9a4fa7138a0cab90c))
* do release workflow as a registered app circumvents branch protection ([ac4cbe7](https://github.com/bebbi/dicom-curate/commit/ac4cbe7c2b99a1e6949616c43185f7aab36a3199))
* permissions in action, assign identity ([047ba67](https://github.com/bebbi/dicom-curate/commit/047ba67eda2cbfafcf2a8e0e8d055f6dfb7e5574))
