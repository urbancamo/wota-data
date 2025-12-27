# Test Fixtures

This directory contains test data files used for testing the WOTA Data application.

## Structure

```
tests/fixtures/
└── adif/          - Test ADIF files for import testing
```

## ADIF Test Files

Place ADIF test files in the `adif/` subdirectory. These files are used to test:

- ADIF parsing functionality
- WOTA reference extraction
- SOTA to WOTA conversion
- Import validation
- Edge cases and error handling

### Suggested Test Files

- **sample-wota.adi** - Valid ADIF with WOTA references
- **sample-sota.adi** - Valid ADIF with SOTA references (G/LD-xxx)
- **mixed-references.adi** - ADIF with both WOTA and SOTA references
- **missing-references.adi** - ADIF records without summit references
- **invalid-format.adi** - Malformed ADIF for error handling tests

## Usage in Tests

Reference test files in your tests using relative paths:

```typescript
import { readFile } from 'fs/promises'
import { parseAdifFile } from '../src/services/adifService'

const adifContent = await readFile('tests/fixtures/adif/sample-wota.adi', 'utf-8')
```
