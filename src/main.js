import { Actor } from 'apify';

// Initialize Actor to read input and determine which mode to run
await Actor.init();

// Get input to determine which mode to run
const input = await Actor.getInput();
const { mode, drawerUrl, startUrl, teamName } = input;

// Determine mode: if drawerUrl exists, it's scraper mode; if startUrl/teamName exists, it's discover mode
// Or explicitly set via 'mode' parameter
let runMode = mode;

if (!runMode) {
    if (drawerUrl) {
        runMode = 'scraper';
        console.log('✓ Auto-detected: Scraper mode (drawerUrl provided)');
    } else if (startUrl && teamName) {
        runMode = 'discover';
        console.log('✓ Auto-detected: Discoverer mode (startUrl and teamName provided)');
    } else {
        await Actor.exit();
        throw new Error('Please provide either:\n' +
            '- For discoverer: startUrl and teamName\n' +
            '- For scraper: drawerUrl\n' +
            '- Or explicitly set mode: "discover" or "scraper"');
    }
}

console.log(`🚀 Starting in ${runMode} mode...`);

// Import and run the appropriate scraper
// Note: discover.js and scraper.js will call Actor.init() again (which is safe - it's idempotent)
// and they handle their own Actor.exit() at the end
try {
    if (runMode === 'scraper') {
        await import('./scraper.js');
    } else if (runMode === 'discover') {
        await import('./discover.js');
    } else {
        await Actor.exit();
        throw new Error(`Unknown mode: ${runMode}. Must be "discover" or "scraper"`);
    }
} catch (error) {
    console.error(`❌ Error running ${runMode}:`, error);
    // The imported scripts handle their own Actor.exit(), but if error happened before import,
    // we need to clean up
    try {
        await Actor.exit();
    } catch (exitError) {
        // Exit might already be called, that's fine
    }
    throw error;
}

// Note: Actor.exit() is already called in discover.js and scraper.js
// So we don't need to call it here