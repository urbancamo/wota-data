# WOTA ADIF - Setup Guide

## Project Structure

This is a full-stack Vue.js + Node.js/Express application for WOTA (Wainwrights on the Air) ADIF Import/Export functionality.

### Tech Stack
- **Frontend**: Vue 3 + TypeScript + Vite + Vant UI
- **Backend**: Node.js + Express + TypeScript
- **Database**:
  - WOTA Spotter Database (MySQL with Prisma ORM)
  - CMS Database (MySQL with mysql2 driver)
- **Testing**: Vitest

## Initial Setup

### 1. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and update both database URLs with your MySQL connection details:

```env
# WOTA Spotter Database (used by Prisma)
WOTA_DATABASE_URL="mysql://username:password@localhost:3306/wota"

# CMS Database (main WOTA website database)
CMS_DATABASE_URL="mysql://username:password@localhost:3306/wota_cms"

PORT=3001
```

### 2. Database Setup

**WOTA Spotter Database:**
Follow the instructions in `db/README.md` to:
1. Create the MySQL database
2. Run the SQL scripts to create tables
3. Set up the database user

**CMS Database:**
Ensure you have access to the CMS database with the correct credentials in your `.env` file

Then generate the Prisma client:

```bash
npx prisma generate
```

### 3. Install Dependencies

Dependencies should already be installed. If not:

```bash
npm install
```

### 4. Development

Run the frontend development server:

```bash
npm run dev
```

Run the backend API server (in a separate terminal):

```bash
npm run api
```

The frontend will be available at http://localhost:5173 (or the port Vite assigns)
The API will be available at http://localhost:3001

### 5. Building for Production

```bash
npm run build
```

## Project Structure

```
wota-adif/
├── src/                    # Frontend Vue application
│   ├── App.vue            # Main app component with navigation
│   ├── main.ts            # Vue app entry point
│   └── components/        # Vue components (to be created)
├── server/                # Backend API
│   ├── api.ts            # Express API server
│   └── db.ts             # Database connections (Prisma + CMS)
├── prisma/               # Database schema
│   └── schema.prisma     # Prisma schema definition (WOTA DB)
├── db/                   # Database SQL scripts
└── dist/                 # Production build output
```

## Available Scripts

- `npm run dev` - Start Vite development server
- `npm run api` - Start Express API server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests with Vitest

## API Endpoints

### WOTA Spotter Database (Prisma)
- `GET /api/health` - Health check
- `GET /api/spots` - Get recent spots (last 50)
- `GET /api/summits` - Get all summits
- `GET /api/alerts` - Get recent alerts (last 50)

### CMS Database (MySQL2)
- `GET /api/cms/test` - Test CMS database connection

## Next Steps

1. Create `.env` file with your database connection
2. Set up the MySQL database using the scripts in `db/`
3. Generate Prisma client: `npx prisma generate`
4. Start developing your Vue components in `src/components/`
5. Add more API endpoints in `server/api.ts` as needed

## Cleanup

The nested `wota-adif/wota-adif/` folder can be safely deleted - it was the Vue scaffold that's been integrated into the root. It's already added to `.gitignore`.