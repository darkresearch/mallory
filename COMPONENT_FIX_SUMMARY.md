# Component Extra `}` Bug Fix

## Problem

The dynamic UI component generation was leaving an extra `}` at the end of components. This occurred when the AI generated component syntax with **4 closing braces** instead of the correct **3 closing braces**.

### Correct Syntax
```
{{component: "InlineCitation", props: {"text": "", "sources": [...]}}}}
                                       ^                         ^^^
                                       1                         234
```
- 1 closing brace for the props object
- 2 closing braces for the component wrapper
- **Total: 3 closing braces**

### Bug
When AI generated 4 closing braces (`}}}}`), the parser only captured the first 3, leaving one `}` in the rendered text.

## Root Causes

### 1. Incomplete Component Detection (`parseIncomplete.ts`)

**Location:** `/Users/osprey/repos/dark/streamdown-rn/src/core/parseIncomplete.ts:146`

**Original Code:**
```typescript
if (braceCount === 0 && nextChar === '}') {
  foundClosing = true;
  break;
}
```

**Problem:** This checked for `braceCount === 0`, which would require **4 closing braces** to mark a component as complete during streaming.

**Fix:**
```typescript
// When braceCount hits 1, we're at the first } of the final }}
if (braceCount === 1 && nextChar === '}') {
  foundClosing = true;
  break;
}
```

### 2. Extra Closing Braces Not Captured (`componentInjector.ts`)

**Location:** `/Users/osprey/repos/dark/streamdown-rn/src/core/componentInjector.ts:94-107`

**Original Code:**
```typescript
const fullMatch = markdown.substring(match.index, afterPropsIndex + 2);
```

**Problem:** Only captured exactly 3 closing braces, leaving extra braces in the text.

**Fix:**
```typescript
// Check for extra closing braces (common AI error: }}}} instead of }}})
let endIndex = afterPropsIndex + 2;
let extraBraces = 0;
while (markdown[endIndex] === '}') {
  extraBraces++;
  endIndex++;
}

if (extraBraces > 0) {
  console.warn(`Component '${componentName}' has ${extraBraces} extra closing brace(s). Including in match to prevent rendering issues.`);
}

const fullMatch = markdown.substring(match.index, endIndex);
```

## Testing

Created comprehensive tests showing the fix handles:
- ✅ Correct syntax (3 closing braces)
- ✅ Incorrect syntax (4 closing braces) - now captures all 4
- ✅ Multiple extra braces (5+ closing braces)  
- ✅ Inline usage with correct and incorrect syntax

## Changes Made

### streamdown-rn Repository
1. **Fixed `hideIncompleteComponents` function** in `src/core/parseIncomplete.ts`
   - Changed `braceCount === 0` to `braceCount === 1` (line 146)

2. **Fixed `extractComponents` function** in `src/core/componentInjector.ts`
   - Added logic to capture extra closing braces (lines 94-107)

3. **Built the package** with `bun run build`

### mallory Repository  
1. **Updated `apps/client/package.json`**
   - Changed from `"streamdown-rn": "0.1.4"` to `"streamdown-rn": "file:../../../streamdown-rn"`
   - Installed with `bun install`

## Result

The app now correctly handles component syntax with any number of closing braces:
- Correct syntax (3 braces) works as expected
- Extra braces (4+) are captured and removed, preventing the `}` from appearing in rendered text
- Streaming detection correctly identifies when components are complete

## Next Steps

To permanently fix this, you should:
1. Publish a new version of `streamdown-rn` to npm with these fixes
2. Update the AI prompts to emphasize the correct 3-brace syntax (though the fix handles errors gracefully)
3. Monitor logs for warnings about extra braces to identify if the AI continues generating incorrect syntax

