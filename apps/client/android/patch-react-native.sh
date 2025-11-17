#!/bin/bash
# Script to patch React Native graphicsConversions.h file in Gradle cache
# This fixes the std::format C++20 compatibility issue with Android NDK

USER_HOME="$HOME"
FILE_PATH="${USER_HOME}/.gradle/caches/8.14.3/transforms/71b76531728f3a9bc715d06df4c2f009/transformed/react-android-0.81.4-debug/prefab/modules/reactnative/include/react/renderer/core/graphicsConversions.h"

if [ ! -f "$FILE_PATH" ]; then
    # Try to find the file
    FILE_PATH=$(find "${USER_HOME}/.gradle/caches" -name "graphicsConversions.h" -path "*/react-android*" -path "*/prefab/modules/reactnative/include/react/renderer/core/*" 2>/dev/null | head -1)
fi

if [ -f "$FILE_PATH" ]; then
    echo "🔧 Patching file: $FILE_PATH"
    
    # Check if already patched
    if grep -q 'std::to_string(dimension.value) + "%"' "$FILE_PATH"; then
        echo "ℹ️  File already patched"
    elif grep -q 'std::format("{}%", dimension.value)' "$FILE_PATH"; then
        # Patch the file
        sed -i '' 's/return std::format("{}%", dimension.value);/return std::to_string(dimension.value) + "%";/g' "$FILE_PATH"
        echo "✅ Patched successfully"
        
        # Verify
        if grep -q 'std::to_string(dimension.value) + "%"' "$FILE_PATH"; then
            echo "✅ Verification: Patch confirmed"
        else
            echo "❌ Verification failed"
            exit 1
        fi
    else
        echo "⚠️  File doesn't contain expected pattern"
        exit 1
    fi
else
    echo "⚠️  File not found: $FILE_PATH"
    echo "   The file will be patched when the prefab is extracted during build"
    exit 0
fi

