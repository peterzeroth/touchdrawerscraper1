import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

await Actor.init();

// Get input configuration
const input = await Actor.getInput();
const { drawerUrl } = input;

if (!drawerUrl) {
    throw new Error('Please provide drawerUrl in the input');
}

console.log(`Starting scraper for drawer URL: ${drawerUrl}`);

const requestQueue = await Actor.openRequestQueue();

// Add the drawer URL request
await requestQueue.addRequest({
    url: drawerUrl,
    uniqueKey: 'drawer-scrape',
    userData: {
        stage: 'scrape-draw',
    },
});

const crawler = new PlaywrightCrawler({
    requestQueue,
    
    async requestHandler({ request, page }) {
        const { stage } = request.userData;

        console.log(`Processing stage: ${stage}`);

        if (stage === 'scrape-draw') {
            await handleDrawScraping(page);
        }
    },
    
    async errorHandler({ request }) {
        console.error(`Request ${request.url} failed multiple times.`);
        await Actor.pushData({
            type: 'error',
            message: 'Request failed multiple times',
            url: request.url
        });
    },
});

async function handleDrawScraping(page) {
    console.log(`Scraping player data from: ${page.url()}`);
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Extract player data - customize based on actual page structure
    const playerData = await page.evaluate(() => {
        const players = [];
        
        // Try multiple selectors for player information
        // First, try to find player rows in tables
        const tableRows = document.querySelectorAll('tr, .player-row, .player-item');
        
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td, .player-name, .player-position, .number');
            if (cells.length > 0) {
                const name = row.querySelector('.player-name, .name, td:first-child')?.textContent?.trim();
                if (name && name.length > 0 && name !== 'Name' && name !== 'Player') {
                    players.push({
                        name: name,
                        position: row.querySelector('.position, .pos')?.textContent?.trim() || 'Unknown',
                        jerseyNumber: row.querySelector('.number, .jersey')?.textContent?.trim() || 'Unknown'
                    });
                }
            }
        });
        
        // If no players found in tables, try other structures
        if (players.length === 0) {
            const playerElements = document.querySelectorAll('.player, [data-player], div[class*="player"]');
            playerElements.forEach(element => {
                const name = element.querySelector('.name, .player-name, strong, b')?.textContent?.trim();
                if (name && name.length > 0) {
                    players.push({
                        name: name,
                        position: 'Unknown',
                        jerseyNumber: 'Unknown'
                    });
                }
            });
        }
        
        return players;
    });
    
    console.log(`Found ${playerData.length} players`);
    
    if (playerData.length > 0) {
        await Actor.pushData({
            type: 'roster',
            players: playerData,
            drawerUrl: page.url(),
            scrapedAt: new Date().toISOString(),
        });
        console.log(`✓ Successfully scraped ${playerData.length} players`);
    } else {
        // Save page content for debugging
        console.log('No players found. Saving page structure for debugging.');
        const pageHtml = await page.evaluate(() => document.body.innerHTML);
        
        await Actor.pushData({
            type: 'roster',
            message: 'No player data found',
            drawerUrl: page.url(),
            note: 'The page structure may need custom selectors',
            pageHtmlSample: pageHtml.substring(0, 2000) // First 2000 chars for debugging
        });
        console.log('✗ No player data found');
    }
}

await crawler.run();

await Actor.exit();
