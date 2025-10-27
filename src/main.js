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
        } else if (stage === 'team-selection') {
            await handleTeamSelection(page);
        }
    },
    
    async errorHandler({ request }) {
        // Silently handle errors - they're often just timeouts during page load
        console.log(`Request ${request.url} encountered issues but continuing...`);
    },
});

async function handleSearch(page, teamName, selectedTeamIndex) {
    console.log(`Searching for team: ${teamName}`);
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Look for search results - updated for Touch Football Australia structure
    const results = await page.evaluate(() => {
        const teamOptions = [];
        
        // Find all links within the search results grid
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            const links = searchResults.querySelectorAll('a[href*="/Competitions/"]');
            
            links.forEach(link => {
                // Extract team name from the <dl> element with class u-spacing-mb-xx-small
                const dlElement = link.querySelector('dl.u-spacing-mb-xx-small');
                // Extract competition name from the <p> element with class club-card-content__club
                const competitionElement = link.querySelector('p.club-card-content__club');
                const teamName = dlElement ? dlElement.textContent.trim() : null;
                const competitionName = competitionElement ? competitionElement.textContent.trim() : '';
                
                if (teamName && link.href) {
                    // Make the URL absolute
                    const absoluteUrl = link.href.startsWith('http') 
                        ? link.href 
                        : `https://touchfootball.com.au${link.href}`;
                    
                    teamOptions.push({
                        name: teamName,
                        url: absoluteUrl,
                        competition: competitionName
                    });
                }
            });
        }
        
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
        
        // Store each team option as a separate data item
        for (const result of results) {
            await Actor.pushData({
                type: 'team-option',
                name: result.name,
                url: result.url,
                competition: result.competition,
                index: results.indexOf(result)
            });
        }
        
        // Determine which team to select
        let teamToSelect;
        if (selectedTeamIndex !== undefined && selectedTeamIndex !== null) {
            if (selectedTeamIndex >= 0 && selectedTeamIndex < results.length) {
                teamToSelect = results[selectedTeamIndex];
                console.log(`Using provided team index ${selectedTeamIndex}: ${teamToSelect.name}`);
            } else {
                console.log(`Invalid team index ${selectedTeamIndex}. Defaulting to first option.`);
                teamToSelect = results[0];
            }
        } else {
            teamToSelect = results[0];
            console.log(`No team selection provided. Defaulting to first option: ${teamToSelect.name}`);
        }
        
        // Proceed to the team page
        await requestQueue.addRequest({
            url: teamToSelect.url,
            uniqueKey: `team-${Date.now()}`,
            userData: {
                stage: 'team-selection',
            },
        });
    } else {
        console.log('No search results found.');
        await Actor.pushData({
            type: 'error',
            message: 'No search results found',
            pageUrl: page.url(),
            teamName: teamName
        });
    }
}

async function handleTeamSelection(page) {
    console.log(`On team page: ${page.url()}`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for "Draw" or similar links on the team page
    const drawerInfo = await page.evaluate(() => {
        // Look for links containing "draw", "squad", "roster", or similar
        const links = Array.from(document.querySelectorAll('a'));
        const drawerLink = links.find(link => {
            const href = link.href?.toLowerCase();
            const text = link.textContent?.toLowerCase();
            return (href && (href.includes('draw') || href.includes('squad') || href.includes('roster'))) ||
                   (text && (text.includes('draw') || text.includes('squad') || text.includes('roster')));
        });
        
        if (drawerLink) {
            return {
                found: true,
                url: drawerLink.href,
                linkText: drawerLink.textContent?.trim()
            };
        }
        
        return {
            found: false,
            url: null,
            linkText: null
        };
    });
    
    // Log drawer info but don't output it - you'll handle that in the second scraper
    if (drawerInfo.found) {
        console.log(`✓ Found drawer URL: ${drawerInfo.url}`);
        console.log(`This URL can be used as input for the second scraper`);
    } else {
        console.log('✗ No drawer link found on team page');
        console.log(`Team page URL: ${page.url()}`);
    }
}

await crawler.run();

await Actor.exit();
