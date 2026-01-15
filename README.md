# wota-data
WOTA Facility for Importing/Exporting to ADIF Format and interacting with activation and chase data

## Setup

After cloning the repository, run the following commands:

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your database credentials and other settings

# Generate Prisma client
npx prisma generate

# Build the transport (required - dist/ is gitignored)
npm run build:transport
```

## Development

### Running the Application

**Normal mode:**
```bash
npm run start
```

This will start both the API server and the frontend development server.

**Stub mode (Database operations logged, not executed):**
```bash
npm run start:stub
```

Or to run just the API in stub mode:
```bash
npm run api:stub
```

### Database Stub Mode

The application includes a database stub mode for testing and development. When enabled, all Prisma database operations are intercepted and logged to the console instead of being executed against the actual database.

**How to enable:**
- Use the `--stub-db` or `--dry-run` flag when starting the API server
- Use the npm scripts: `npm run api:stub` or `npm run start:stub`

**What it does:**
- Intercepts all Prisma operations (create, findMany, update, delete, etc.)
- Logs each operation with model name, operation type, and arguments
- Returns mock data matching the expected response structure
- Prevents any actual database modifications

**Use cases:**
- Testing import/export functionality without affecting the database
- Debugging API endpoints and data flow
- Development when database is unavailable
- Verifying what database operations would occur without executing them

**Example output:**
```
🔧 STUB MODE ENABLED - Database operations will be logged instead of executed

📝 DATABASE OPERATION (STUBBED):
   Model: activatorLog
   Operation: create
   Arguments: {
     "data": {
       "activatedby": "M0ABC",
       "wotaid": 123,
       ...
     }
   }
```
