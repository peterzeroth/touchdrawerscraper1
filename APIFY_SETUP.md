# Apify Console Entry Point Configuration

This guide explains how to set up different entry points for your two Apify actors using the same repository.

## Option 1: Using Apify Console Actor Settings (Recommended)

### For Discoverer Actor:
1. Go to [Apify Console](https://console.apify.com/)
2. Navigate to your **Discoverer** actor
3. Go to **Settings** → **Source code**
4. Look for **Start command** or **Entry point** field
5. Set it to: `node src/main-discover.js`
6. Save the changes

### For Scraper Actor:
1. Go to [Apify Console](https://console.apify.com/)
2. Navigate to your **Scraper** actor
3. Go to **Settings** → **Source code**
4. Look for **Start command** or **Entry point** field
5. Set it to: `node src/main-scraper.js`
6. Save the changes

## Option 2: Using Environment Variables in Apify Console

### For Discoverer Actor:
1. Go to **Settings** → **Environment variables**
2. Add environment variable:
   - **Key**: `APIFY_ACTOR_MODE`
   - **Value**: `discover`
3. Update `src/main.js` to check this variable

### For Scraper Actor:
1. Go to **Settings** → **Environment variables**
2. Add environment variable:
   - **Key**: `APIFY_ACTOR_MODE`
   - **Value**: `scraper`

## Option 3: Using Different package.json start Scripts

You can modify the `start` script in `package.json` directly:

- **For Discoverer**: Change `"start": "node src/main-discover.js"`
- **For Scraper**: Change `"start": "node src/main-scraper.js"`

However, this requires maintaining separate package.json files or switching them per actor.

## Option 4: Using apify.json Configuration

Apify actors can read from `apify.json`. You could:
1. Create `apify-discover.json` and `apify-scraper.json`
2. Point each actor to the appropriate config file
3. Configure the start command in each config (if supported)

## Current Setup

Your repository currently has:
- ✅ `src/main-discover.js` - Entry point for Discoverer
- ✅ `src/main-scraper.js` - Entry point for Scraper
- ✅ `src/main.js` - Router entry point (auto-detects)

## Recommended Approach

**Use Option 1** (Apify Console Settings) because:
- ✅ Clean and simple
- ✅ No code changes needed
- ✅ Each actor can have different settings
- ✅ Easy to change without rebuilding

## Verification

After setting up:
1. Test the Discoverer actor with `INPUT-discover.json` format
2. Test the Scraper actor with `INPUT-scraper.json` format
3. Check the actor logs to confirm the correct entry point is being used

## Troubleshooting

If the entry point isn't working:
1. Check the actor logs for startup errors
2. Verify the file path is correct (should start from repo root)
3. Ensure the file exists in your GitHub repository
4. Make sure you've pushed the changes to GitHub
5. Rebuild the actor after making changes

