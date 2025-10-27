import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

await Actor.init();

// Get input configuration
const input = await Actor.getInput();
const { startUrl, teamName, selectedTeamIndex } = input;

if (!startUrl || !teamName) {
    throw new Error('Please provide both startUrl and teamName in the input');
}

console.log(`Starting scraper for team: ${teamName}`);
console.log(`Search URL: ${startUrl}`);

const requestQueue = await Actor.openRequestQueue();

// Build the search URL with the team name
const searchTerm = encodeURIComponent(teamName.toLowerCase());
const searchUrl = `${startUrl}${searchTerm}`;

console.log(`Built search URL: ${searchUrl}`);

// Add the search request with the search URL
await requestQueue.addRequest({
    url: searchUrl,
    uniqueKey: `search-${teamName}`,
    userData: {
        stage: 'search',
        teamName: teamName,
        selectedTeamIndex: selectedTeamIndex,
    },
});

const crawler = new PlaywrightCrawler({
    requestQueue,
    
    async requestHandler({ request, page }) {
        const { stage, teamName, selectedTeamIndex } = request.userData;

        console.log(`Processing stage: ${stage}`);

        if (stage === 'search') {
            await handleSearch(page, teamName, selectedTeamIndex);
        } else if (stage === 'team-selection') {
            await handleTeamSelection(page);
        } else if (stage === 'scrape-draw') {
            await handleDrawScraping(page);
        }
    },
    
    async errorHandler({ request }) {
        console.error(`Request ${request.url} failed multiple times.`);
    },
});

async function handleSearch(page, teamName, selectedTeamIndex) {
    console.log(`Searching for team: ${teamName}`);
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for dynamic content to load
    await page.waitForTimeout(3000);
    
    // Look for search results - try multiple selectors for Touch Football Australia
    const results = await page.evaluate(() => {
        const resultElements = document.querySelectorAll('a[href*="/team/"], a[href*="/competitions/"], .result-item, .search-result, div[class*="result"]');
        const teamOptions = [];
        
        resultElements.forEach(element => {
            const link = element.tagName === 'A' ? element : element.querySelector('a');
            if (link && link.href) {
                const text = element.textContent?.trim() || link.textContent?.trim();
                if (text && text.length > 0) {
                    teamOptions.push({
                        name: text,
                        url: link.href
                    });
                }
            }
        });
        
        // Remove duplicates based on URL
        const uniqueResults = [];
        const seenUrls = new Set();
        teamOptions.forEach(option => {
            if (!seenUrls.has(option.url)) {
                seenUrls.add(option.url);
                uniqueResults.push(option);
            }
        });
        
        return uniqueResults;
    });
    
    console.log(`Found ${results.length} team options`);
    
    if (results.length > 0) {
        // Log all found options
        results.forEach((result, index) => {
            console.log(`Option ${index + 1}: ${result.name} - ${result.url}`);
        });
        
        // Store team options for user selection
        await Actor.pushData({
            type: 'team-options',
            options: results,
            instructions: 'Review the team options above and provide the selectedTeamIndex (0-based) in your input to proceed with team selection'
        });
        
        // Determine which team to select
        let teamToSelect;
        if (selectedTeamIndex !== undefined && selectedTeamIndex !== null) {
            // User provided a specific index
            if (selectedTeamIndex >= 0 && selectedTeamIndex < results.length) {
                teamToSelect = results[selectedTeamIndex];
                console.log(`Using provided team index ${selectedTeamIndex}: ${teamToSelect.name}`);
            } else {
                console.log(`Invalid team index ${selectedTeamIndex}. Defaulting to first option.`);
                teamToSelect = results[0];
            }
        } else {
            // No selection provided, default to first option
            teamToSelect = results[0];
            console.log(`No team selection provided. Defaulting to first option: ${teamToSelect.name}`);
            console.log(`To select a different team, provide 'selectedTeamIndex' in your input (0 for first, 1 for second, etc.)`);
        }
        
        // Proceed with the selected team
        await requestQueue.addRequest({
            url: teamToSelect.url,
            uniqueKey: `team-${Date.now()}`,
            userData: {
                stage: 'team-selection',
            },
        });
    } else {
        console.log('No search results found. May need to inspect the page structure.');
        // Save page content for debugging
        await Actor.pushData({
            type: 'error',
            message: 'No search results found',
            pageUrl: page.url(),
            note: 'Check the HTML structure of the search results page'
        });
    }
}

async function handleTeamSelection(page) {
    console.log(`On team page: ${page.url()}`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for "Draw" or similar links on the team page
    const drawLink = await page.evaluate(() => {
        // Look for links containing "draw", "squad", "roster", or similar
        const links = Array.from(document.querySelectorAll('a'));
        const drawLink = links.find(link => {
            const href = link.href?.toLowerCase();
            const text = link.textContent?.toLowerCase();
            return (href && (href.includes('draw') || href.includes('squad') || href.includes('roster'))) ||
                   (text && (text.includes('draw') || text.includes('squad') || text.includes('roster')));
        });
        return drawLink ? drawLink.href : null;
    });
    
    if (drawLink) {
        console.log(`Found draw link: ${drawLink}`);
        await requestQueue.addRequest({
            url: drawLink,
            uniqueKey: `draw-${Date.now()}`,
            userData: {
                stage: 'scrape-draw',
            },
        });
    } else {
        // If no draw link found, try scraping the current page
        console.log('No specific draw link found, scraping current page');
        await handleDrawScraping(page);
    }
}

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
            teamUrl: page.url(),
            scrapedAt: new Date().toISOString(),
        });
    } else {
        // Save page content for debugging
        console.log('No players found. Saving page structure for debugging.');
        const pageHtml = await page.evaluate(() => document.body.innerHTML);
        
        await Actor.pushData({
            type: 'roster',
            message: 'No player data found',
            pageUrl: page.url(),
            note: 'The page structure may need custom selectors',
            pageHtmlSample: pageHtml.substring(0, 2000) // First 2000 chars for debugging
        });
    }
}

await crawler.run();

await Actor.exit();
