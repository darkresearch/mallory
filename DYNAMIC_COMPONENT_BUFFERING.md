# Dynamic Component Buffering Fix

## Summary

Fixed the issue where partial component code (`{{component: "Name", props: {...`) was visible during streaming. Now the component syntax is hidden until complete, then renders cleanly.

## What Changed

**StreamdownRN** (the rendering library) now buffers incomplete component syntax during streaming. The changes were made in the `streamdown-rn` package, not in Mallory code.

## Changes in This Repo

Updated `apps/client/package.json` to use the local version of streamdown-rn with component buffering:

```json
"streamdown-rn": "file:../../../streamdown-rn"
```

## Testing

Start the web app and test with a prompt that triggers citations:

```bash
bun run web
```

Example test prompts:
- "Search for the latest news about Bitcoin"
- "What's the current price of Ethereum and cite your source"

You should see:
- ✅ Clean text streaming without any `{{component:` syntax visible
- ✅ Citation components appear smoothly once complete
- ✅ No weird partial code snippets

## Reverting (if needed)

If you need to revert to the published version:

```json
"streamdown-rn": "0.1.4-beta.3"
```

Then run: `bun install`

## Next Steps

Once tested and confirmed working:
1. The streamdown-rn changes can be published as a new version
2. Update this package.json to use the published version instead of file path
3. Commit and deploy

## Technical Details

See `streamdown-rn/COMPONENT_BUFFERING.md` for full technical documentation of the changes.

