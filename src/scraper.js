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
    console.log(`Scraping match data from: ${page.url()}`);
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
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
                    matchUrlRelative: matchUrlRelative
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
