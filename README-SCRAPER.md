# TouchDraw Scraper

**Scraper 2 of 2**: Scrapes player roster data from Touch Football team drawer pages.

## Purpose

This scraper:
1. Takes a drawer URL as input
2. Navigates to the drawer/roster page
3. Extracts player data
4. Returns JSON with all players

## Input

```json
{
  "drawerUrl": "https://touchfootball.com.au/competitions/.../draw"
}
```

- `drawerUrl`: The full URL to the team's drawer/squad/roster page (obtained from Scraper 1)

## Output

### Success
```json
{
  "type": "roster",
  "players": [
    {
      "name": "Player Name",
      "position": "Forward",
      "jerseyNumber": "10"
    }
  ],
  "drawerUrl": "https://...",
  "scrapedAt": "2024-01-01T00:00:00.000Z"
}
```

### No Players Found
```json
{
  "type": "roster",
  "message": "No player data found",
  "drawerUrl": "https://...",
  "note": "The page structure may need custom selectors",
  "pageHtmlSample": "..."
}
```

## How to Use

1. Run Scraper 1 (Discoverer) to get the drawer URL
2. Copy the drawer URL from Scraper 1 output
3. Use that URL as input for this scraper
4. Get the player roster JSON

## Running on Apify

1. Create a new actor in Apify
2. Upload this code
3. Provide the drawer URL from Scraper 1
4. Run it to get the player roster
