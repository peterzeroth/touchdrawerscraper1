import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

await Actor.init();

// Get input configuration
const input = await Actor.getInput();
const { startUrl, teamName, selectedTeamIndex } = input;

if (!startUrl || !teamName) {
    throw new Error('Please provide both startUrl and teamName in the input');
}

console.log(`Starting discovery for team: ${teamName}`);
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
        }
        // Note: team-selection stage removed - not needed as we get all info from search results
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

async function handleSearch(page, teamName, selectedTeamIndex) {
    console.log(`Searching for team: ${teamName}`);
    
    // Wait for the page to load - use domcontentloaded first for faster initial load
    try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (e) {
        console.log('Page load timeout, continuing...');
    }
    
    // Wait for search results grid to appear (the l-grid__cell containers)
    // This is more reliable than waiting for networkidle
    try {
        await page.waitForSelector('.l-grid__cell a[href*="/Competitions/Competition/"]', { timeout: 15000 });
        console.log('Search results grid found');
    } catch (e) {
        console.log('Waiting for search results...');
        // Try alternative selectors
        try {
            await page.waitForSelector('a[href*="/Competitions/Competition/"]', { timeout: 5000 });
            console.log('Found alternative search results structure');
        } catch (e2) {
            console.log('No search results found with expected structure');
        }
    }
    
    // Give a bit more time for dynamic content to fully load (reduced from 2s)
    await page.waitForTimeout(500);
    
    // Look for search results - targeting the specific HTML structure
    const results = await page.evaluate((searchTerm) => {
        // Find all result cards (they're in div.l-grid__cell with links)
        const resultCards = document.querySelectorAll('.l-grid__cell a[href*="/Competitions/Competition/"]');
        
        const teamOptions = [];
        const seenUrls = new Set();
        
        resultCards.forEach(link => {
            if (!link || !link.href) return;
            
            // Skip if we've already seen this URL
            if (seenUrls.has(link.href)) {
                return;
            }
            
            // Make URL absolute if needed
            const absoluteUrl = link.href.startsWith('http') 
                ? link.href 
                : `https://touchfootball.com.au${link.href}`;
            
            // Extract team name from <dl class="u-spacing-mb-xx-small"> inside the link
            // This is the team name element
            const teamNameElement = link.querySelector('dl.u-spacing-mb-xx-small');
            let teamName = '';
            
            if (teamNameElement) {
                teamName = teamNameElement.textContent?.trim() || '';
            }
            
            // Fallback: try to find team name in the link's text content
            if (!teamName || teamName.length < 1) {
                // Look for the result type lozenge and get text after it
                const lozenge = link.querySelector('.o-lozenge');
                if (lozenge) {
                    const allText = link.textContent || '';
                    const lozengeText = lozenge.textContent || '';
                    const afterLozenge = allText.replace(lozengeText, '').trim();
                    // Split by newlines and get first non-empty line (should be team name)
                    const lines = afterLozenge.split('\n').map(l => l.trim()).filter(l => l);
                    teamName = lines[0] || '';
                } else {
                    teamName = link.textContent?.trim() || '';
                }
            }
            
            // Extract competition name from <p class="club-card-content__club">
            const competitionElement = link.querySelector('.club-card-content__club');
            let competitionName = '';
            
            if (competitionElement) {
                competitionName = competitionElement.textContent?.trim() || '';
            }
            
            // Extract result type (Team, Competition, etc.)
            const resultTypeElement = link.querySelector('.o-lozenge');
            let resultType = '';
            
            if (resultTypeElement) {
                resultType = resultTypeElement.textContent?.trim() || '';
            }
            
            // Clean up team name (remove extra whitespace, newlines)
            teamName = teamName.replace(/\s+/g, ' ').trim();
            
            // Only include if we have a valid team name and it's a "Team" result type
            if (teamName && teamName.length > 0) {
                // Filter: prefer "Team" results, but include others too if no team filter
                if (resultType && resultType.toLowerCase() !== 'team') {
                    console.log(`Skipping non-team result: ${resultType} - ${teamName}`);
                    // You could skip non-team results here if needed
                    // return;
                }
                
                seenUrls.add(link.href);
                teamOptions.push({
                    name: teamName,
                    url: absoluteUrl,
                    competition: competitionName,
                    resultType: resultType
                });
            }
        });
        
        // Limit to first 20 results to avoid overwhelming output
        return teamOptions.slice(0, 20);
    }, teamName.toLowerCase());
    
    console.log(`Found ${results.length} team options (limited to 20)`);
    
    if (results.length > 0) {
        // Log all found options
        results.forEach((result, index) => {
            const compInfo = result.competition ? ` (${result.competition})` : '';
            const typeInfo = result.resultType ? ` [${result.resultType}]` : '';
            console.log(`Option ${index + 1}: ${result.name}${compInfo}${typeInfo} - ${result.url}`);
        });
        
        // Store team options
        await Actor.pushData({
            type: 'team-options',
            options: results,
            selectedIndex: selectedTeamIndex
        });
        
        // Log which team would be selected (for informational purposes)
        let teamToSelect;
        if (selectedTeamIndex !== undefined && selectedTeamIndex !== null) {
            if (selectedTeamIndex >= 0 && selectedTeamIndex < results.length) {
                teamToSelect = results[selectedTeamIndex];
                console.log(`Selected team (index ${selectedTeamIndex}): ${teamToSelect.name}`);
            } else {
                console.log(`Invalid team index ${selectedTeamIndex}. Would default to first option.`);
                teamToSelect = results[0];
            }
        } else {
            teamToSelect = results[0];
            console.log(`No team selection provided. Would default to first option: ${teamToSelect.name}`);
        }
        
        console.log(`✓ Discovery complete. Found ${results.length} team options.`);
        // No need to navigate to team page - we have all the info we need from search results
    } else {
        console.log('No search results found.');
        // Debug: log the page HTML to help diagnose
        const pageContent = await page.content();
        console.log('Page URL:', page.url());
        console.log('Page title:', await page.title());
        
        await Actor.pushData({
            type: 'error',
            message: 'No search results found',
            pageUrl: page.url(),
            teamName: teamName
        });
    }
}

await crawler.run();

await Actor.exit();
