#!/bin/bash

# WOTA Data - Stop Script
# Stops both the API server and Vite dev server

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping WOTA Data servers...${NC}"

# Function to stop a process
stop_process() {
  local name=$1
  local pid_file=$2

  if [ -f "$pid_file" ]; then
    PID=$(cat "$pid_file")
    if ps -p $PID > /dev/null 2>&1; then
      echo -e "${YELLOW}Stopping $name (PID: $PID)...${NC}"
      kill $PID

      # Wait up to 5 seconds for graceful shutdown
      for i in {1..5}; do
        if ! ps -p $PID > /dev/null 2>&1; then
          echo -e "${GREEN}✓ $name stopped${NC}"
          rm "$pid_file"
          return 0
        fi
        sleep 1
      done

      # Force kill if still running
      if ps -p $PID > /dev/null 2>&1; then
        echo -e "${RED}Force killing $name...${NC}"
        kill -9 $PID
        rm "$pid_file"
      fi
    else
      echo -e "${YELLOW}$name (PID: $PID) is not running${NC}"
      rm "$pid_file"
    fi
  else
    echo -e "${YELLOW}No PID file found for $name${NC}"
  fi
}

# Stop API server
stop_process "API server" ".pids/api.pid"

# Stop Vite dev server
stop_process "Vite dev server" ".pids/dev.pid"

# Also kill any processes on the ports (backup cleanup)
echo -e "${YELLOW}Cleaning up any processes on ports 3001 and 5173...${NC}"
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}✓ All servers stopped${NC}"