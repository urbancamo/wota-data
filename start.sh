#!/bin/bash

# WOTA Data - Start Script
# Starts both the API server and Vite dev server

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting WOTA Data servers...${NC}"

# Create .pids directory if it doesn't exist
mkdir -p .pids

# Start API server in background
echo -e "${YELLOW}Starting API server...${NC}"
npm run api > .pids/api.log 2>&1 &
API_PID=$!
echo $API_PID > .pids/api.pid
echo -e "${GREEN}API server started (PID: $API_PID)${NC}"

# Wait a moment for API to initialize
sleep 2

# Start Vite dev server in background
echo -e "${YELLOW}Starting Vite dev server...${NC}"
npm run dev > .pids/dev.log 2>&1 &
DEV_PID=$!
echo $DEV_PID > .pids/dev.pid
echo -e "${GREEN}Vite dev server started (PID: $DEV_PID)${NC}"

echo ""
echo -e "${GREEN}✓ Both servers started successfully!${NC}"
echo ""
echo "API Server:  http://localhost:3003"
echo "Frontend:    http://localhost:3002/data/"
echo ""
echo "Logs:"
echo "  API: tail -f .pids/api.log"
echo "  Dev: tail -f .pids/dev.log"
echo ""
echo "To stop servers: ./stop.sh"