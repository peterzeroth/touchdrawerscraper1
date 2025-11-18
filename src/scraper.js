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
        // Silently handle errors - they're often just timeouts during page load
        console.log(`Request ${request.url} encountered issues but continuing...`);
    },
});

async function handleDrawScraping(page) {
    console.log(`Scraping match data from: ${page.url()}`);
    
    // Wait for the matches list to appear
    await page.waitForSelector('ul.l-grid', { timeout: 30000 });
    await page.waitForTimeout(500);
    
    // Extract match data from the draw page
    const matches = await page.evaluate(() => {
        const matchElements = document.querySelectorAll('ul.l-grid > li');
        const matchesData = [];
        
        matchElements.forEach(matchEl => {
            // Extract date (first line)
            const dateEl = matchEl.querySelector('.match-header__title');
            const date = dateEl ? dateEl.textContent.trim().split('\n')[0].trim() : '';
            
            // Extract datetime attribute and kick-off time
            const timeEl = matchEl.querySelector('time');
            const dateTime = timeEl ? timeEl.getAttribute('datetime') : '';
            const kickOffTime = timeEl ? timeEl.textContent.trim() : '';
            
            // Extract round
            const roundEl = matchEl.querySelector('.match-header__title span');
            const round = roundEl ? roundEl.textContent.trim() : '';
            
            // Extract home team
            const homeTeamEl = matchEl.querySelector('.match-team__name--home');
            const homeTeam = homeTeamEl ? homeTeamEl.textContent.trim() : '';
            
            // Extract away team
            const awayTeamEl = matchEl.querySelector('.match-team__name--away');
            const awayTeam = awayTeamEl ? awayTeamEl.textContent.trim() : '';
            
            // Extract venue
            const venueEl = matchEl.querySelector('.match-cta__link');
            const venue = venueEl ? venueEl.textContent.trim() : '';
            
            // Extract match URL
            const matchLink = matchEl.querySelector('a[href*="/Competitions/Match/"]');
            const matchUrl = matchLink ? matchLink.href : '';
            
            // Extract match URL relative path
            const matchUrlRelative = matchLink ? matchLink.getAttribute('href') : '';
            
            // Check if game is completed (has "Full Time" or similar status)
            const statusLozenge = matchEl.querySelector('.match__lozenge');
            let gameStatus = '';
            let isCompleted = false;
            
            if (statusLozenge) {
                gameStatus = statusLozenge.textContent.trim();
                // Check if game is completed (Full Time, Final, etc.)
                const statusText = gameStatus.toLowerCase();
                isCompleted = statusText.includes('full time') || 
                             statusText.includes('final') || 
                             statusText.includes('complete') ||
                             statusText.includes('finished');
            }
            
            // Extract scores if game is completed
            let homeScore = null;
            let awayScore = null;
            
            if (isCompleted) {
                // Extract home team score
                const homeScoreEl = matchEl.querySelector('.match-team__score--home');
                if (homeScoreEl) {
                    // Get the text content, but exclude the "Scored" and "points" text
                    const scoreText = homeScoreEl.textContent.trim();
                    // Extract just the number (remove "Scored", "points", and whitespace)
                    const scoreMatch = scoreText.match(/\d+/);
                    if (scoreMatch) {
                        homeScore = parseInt(scoreMatch[0], 10);
                    }
                }
                
                // Extract away team score
                const awayScoreEl = matchEl.querySelector('.match-team__score--away');
                if (awayScoreEl) {
                    const scoreText = awayScoreEl.textContent.trim();
                    const scoreMatch = scoreText.match(/\d+/);
                    if (scoreMatch) {
                        awayScore = parseInt(scoreMatch[0], 10);
                    }
                }
            }
            
            if (homeTeam && awayTeam) {
                matchesData.push({
                    date: date,
                    round: round,
                    kickOffTime: kickOffTime,
                    dateTime: dateTime,
                    homeTeam: homeTeam,
                    awayTeam: awayTeam,
                    venue: venue,
                    matchUrl: matchUrl,
                    matchUrlRelative: matchUrlRelative,
                    gameStatus: gameStatus,
                    isCompleted: isCompleted,
                    homeScore: homeScore,
                    awayScore: awayScore
                });
            }
        });
        
        return matchesData;
    });
    
    console.log(`Found ${matches.length} matches`);
    
    if (matches.length > 0) {
        // Output each match as a separate data item
        for (const match of matches) {
            await Actor.pushData({
                type: 'match',
                date: match.date,
                round: match.round,
                kickOffTime: match.kickOffTime,
                dateTime: match.dateTime,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                venue: match.venue,
                matchUrl: match.matchUrl,
                matchUrlRelative: match.matchUrlRelative,
                gameStatus: match.gameStatus,
                isCompleted: match.isCompleted,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                scrapedFrom: page.url()
            });
        }
        console.log(`✓ Successfully scraped ${matches.length} matches`);
    } else {
        console.log('✗ No match data found');
        await Actor.pushData({
            type: 'error',
            message: 'No match data found',
            drawerUrl: page.url()
        });
    }
}

await crawler.run();

await Actor.exit();
