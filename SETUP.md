# Setup Guide for TouchDraw Scrapers

This repository contains two Apify scrapers:
1. **Discoverer** (`discover.js`) - Discovers drawer URLs for Touch Football teams
2. **Scraper** (`scraper.js`) - Scrapes match data from drawer pages

## Repository Structure

- Single repository: `touchdrawerscraper2`
- Both scrapers share the same codebase
- Each Apify actor uses a different entry point

## Entry Points

The repository provides multiple entry points:

1. **`src/main.js`** - Router entry point (auto-detects which scraper to run based on input)
2. **`src/main-discover.js`** - Direct entry point for Discoverer
3. **`src/main-scraper.js`** - Direct entry point for Scraper

## Apify Actor Configuration

### Option 1: Using Router (Default)
- **Entry Point**: `src/main.js`
- Automatically detects which scraper to run based on input:
  - If `drawerUrl` is provided → runs scraper
  - If `startUrl` and `teamName` are provided → runs discoverer
- Use in `package.json`: `"start": "node src/main.js"`

### Option 2: Direct Entry Points (Recommended for separate actors)
- **Discoverer Actor**:
  - Entry Point: `src/main-discover.js`
  - Use in `package.json`: `"start": "node src/main-discover.js"`
  - Or set via Apify environment variable

- **Scraper Actor**:
  - Entry Point: `src/main-scraper.js`
  - Use in `package.json`: `"start": "node src/main-scraper.js"`
  - Or set via Apify environment variable

## Setting Up Apify Actors

### For Discoverer Actor:
1. Create/update Apify actor pointing to this repository
2. In the actor settings, set the start script to use `src/main-discover.js`
3. Or modify `package.json` start script to: `"start": "node src/main-discover.js"`

### For Scraper Actor:
1. Create/update Apify actor pointing to this repository
2. In the actor settings, set the start script to use `src/main-scraper.js`
3. Or modify `package.json` start script to: `"start": "node src/main-scraper.js"`

## Input Formats

### Discoverer Input (`INPUT-discover.json`):
```json
{
  "startUrl": "https://touchfootball.com.au/search?q=",
  "teamName": "Team Name",
  "selectedTeamIndex": 0
}
```

### Scraper Input (`INPUT-scraper.json`):
```json
{
  "drawerUrl": "https://touchfootball.com.au/competitions/.../draw"
}
```

## Benefits of This Setup

✅ Single repository - no code duplication  
✅ Easy maintenance - update once, works for both actors  
✅ Clear separation - each actor has its own entry point  
✅ Flexible - can use router or direct entry points  

## Future Improvements

- Consider using subdirectories if the scrapers diverge significantly
- Could add shared utilities in `src/utils/` if needed
