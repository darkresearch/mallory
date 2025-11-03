#!/bin/bash

# Storage API Migration Script
# Automates the migration from secureStorage to storage.persistent/storage.session

echo "🔄 Starting storage API migration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="apps/client"

echo "${YELLOW}Step 1: Finding all secureStorage usage...${NC}"
echo ""

# Find all files using secureStorage
FILES=$(grep -rl "secureStorage\." "$BASE_DIR" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test.")

echo "Found usage in these files:"
echo "$FILES" | while read file; do
  echo "  - $file"
done
echo ""

echo "${YELLOW}Step 2: Performing replacements...${NC}"
echo ""

for file in $FILES; do
  echo "Processing: $file"
  
  # Check if file contains SESSION_STORAGE_KEYS
  if grep -q "SESSION_STORAGE_KEYS\." "$file"; then
    echo "  → Replacing secureStorage with storage.session for SESSION_STORAGE_KEYS"
    
    # Replace for getItem
    sed -i '' 's/secureStorage\.getItem(SESSION_STORAGE_KEYS\./storage.session.getItem(SESSION_STORAGE_KEYS./g' "$file"
    
    # Replace for setItem
    sed -i '' 's/secureStorage\.setItem(SESSION_STORAGE_KEYS\./storage.session.setItem(SESSION_STORAGE_KEYS./g' "$file"
    
    # Replace for removeItem
    sed -i '' 's/secureStorage\.removeItem(SESSION_STORAGE_KEYS\./storage.session.removeItem(SESSION_STORAGE_KEYS./g' "$file"
  fi
  
  # Check if file contains SECURE_STORAGE_KEYS
  if grep -q "SECURE_STORAGE_KEYS\." "$file"; then
    echo "  → Replacing secureStorage with storage.persistent for SECURE_STORAGE_KEYS"
    
    # Replace for getItem
    sed -i '' 's/secureStorage\.getItem(SECURE_STORAGE_KEYS\./storage.persistent.getItem(SECURE_STORAGE_KEYS./g' "$file"
    
    # Replace for setItem
    sed -i '' 's/secureStorage\.setItem(SECURE_STORAGE_KEYS\./storage.persistent.setItem(SECURE_STORAGE_KEYS./g' "$file"
    
    # Replace for removeItem
    sed -i '' 's/secureStorage\.removeItem(SECURE_STORAGE_KEYS\./storage.persistent.removeItem(SECURE_STORAGE_KEYS./g' "$file"
  fi
  
  # Update imports
  if grep -q "import.*secureStorage.*from" "$file"; then
    echo "  → Updating import statement"
    sed -i '' 's/import { secureStorage/import { storage/g' "$file"
    sed -i '' 's/, secureStorage,/, storage,/g' "$file"
    sed -i '' 's/, secureStorage /, storage /g' "$file"
  fi
  
  echo ""
done

echo "${GREEN}✅ Migration complete!${NC}"
echo ""
echo "${YELLOW}Next steps:${NC}"
echo "1. Review the changes with: git diff"
echo "2. Run linter: bun run lint"
echo "3. Run tests: bun test"
echo "4. Test manually on both web and mobile"
echo ""
echo "If everything looks good:"
echo "  git add ."
echo "  git commit -m 'refactor: migrate to explicit storage.persistent/storage.session API'"

