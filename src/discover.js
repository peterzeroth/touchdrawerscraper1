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
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Try to wait for search results to appear - look for common patterns
    try {
        // Wait for any of these selectors to appear (search results container or result links)
        await Promise.race([
            page.waitForSelector('#search-results', { timeout: 5000 }).catch(() => null),
            page.waitForSelector('.search-results', { timeout: 5000 }).catch(() => null),
            page.waitForSelector('a[href*="/competitions/team/"]', { timeout: 5000 }).catch(() => null),
            page.waitForSelector('a[href*="/competitions/"][href*="/"]', { timeout: 5000 }).catch(() => null),
        ]);
        await page.waitForTimeout(1000); // Give a bit more time for dynamic content
    } catch (e) {
        console.log('No specific search results selector found, continuing with general search...');
    }
    
    // Look for search results - improved filtering
    const results = await page.evaluate((searchTerm) => {
        // Try to find the search results container
        // Common patterns: #search-results, .search-results, .results, etc.
        const searchContainers = document.querySelectorAll('#search-results, .search-results, .results, [class*="search-result"], [class*="result-list"]');
        
        let resultElements = [];
        
        // If we found a search container, look within it
        if (searchContainers.length > 0) {
            searchContainers.forEach(container => {
                const links = container.querySelectorAll('a[href*="/competitions/"]');
                resultElements.push(...Array.from(links));
            });
        } else {
            // Fallback: find all competition links on the page
            resultElements = Array.from(document.querySelectorAll('a[href*="/competitions/"]'));
        }
        
        const teamOptions = [];
        const seenUrls = new Set();
        
        resultElements.forEach(link => {
            if (!link || !link.href) return;
            
            const href = link.href.toLowerCase();
            const text = link.textContent?.trim() || '';
            
            // Filter out navigation links and generic pages
            // Exclude: just /competitions/, /competitions/search, navigation links
            const excludePatterns = [
                '/competitions/$',
                '/competitions/search',
                '/competitions#',
                'javascript:',
                '#'
            ];
            
            const shouldExclude = excludePatterns.some(pattern => {
                if (pattern.endsWith('$')) {
                    return href.endsWith(pattern.slice(0, -1));
                }
                return href.includes(pattern);
            });
            
            if (shouldExclude) {
                return;
            }
            
            // Only include links that look like team/competition pages
            // They should have a path like /competitions/[something]/ or /competitions/team/
            const urlPath = new URL(link.href).pathname;
            const pathParts = urlPath.split('/').filter(p => p);
            
            // Should have more than just "competitions" in the path
            // e.g., /competitions/team/123 or /competitions/123/ or /competitions/comp-name
            if (pathParts.length < 2 || pathParts[0] !== 'competitions') {
                return;
            }
            
            // Skip if we've already seen this URL
            if (seenUrls.has(link.href)) {
                return;
            }
            
            // Make URL absolute if needed
            const absoluteUrl = link.href.startsWith('http') 
                ? link.href 
                : `https://touchfootball.com.au${link.href}`;
            
            // Get a better name - look for text in the link or nearby elements
            let teamName = text;
            if (!teamName || teamName.length < 2) {
                // Try to find name in parent elements
                const parent = link.closest('div, li, article, section, tr, td');
                if (parent) {
                    teamName = parent.textContent?.trim() || '';
                }
            }
            
            // Clean up the name (remove extra whitespace, newlines)
            teamName = teamName.replace(/\s+/g, ' ').trim();
            
            if (teamName && teamName.length > 0 && !teamName.toLowerCase().includes('competitions')) {
                seenUrls.add(link.href);
                teamOptions.push({
                    name: teamName,
                    url: absoluteUrl
                });
            }
        });
        
        return teamOptions;
    }, teamName.toLowerCase());
    
    console.log(`Found ${results.length} team options`);
    
    if (results.length > 0) {
        // Log all found options
        results.forEach((result, index) => {
            console.log(`Option ${index + 1}: ${result.name} - ${result.url}`);
        });
        
        // Store team options
        await Actor.pushData({
            type: 'team-options',
            options: results,
            selectedIndex: selectedTeamIndex
        });
        
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
    
    // Save the result
    await Actor.pushData({
        type: 'drawer-url',
        found: drawerInfo.found,
        url: drawerInfo.url,
        linkText: drawerInfo.linkText,
        teamPageUrl: page.url(),
        timestamp: new Date().toISOString()
    });
    
    if (drawerInfo.found) {
        console.log(`✓ Successfully found drawer URL: ${drawerInfo.url}`);
        console.log(`Link text: ${drawerInfo.linkText}`);
    } else {
        console.log('✗ No drawer link found on team page');
        console.log(`Team page URL: ${page.url()}`);
    }
}

await crawler.run();

await Actor.exit();
