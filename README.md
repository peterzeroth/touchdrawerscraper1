# TouchDraw Scraper

**Scraper 2 of 2**: Scrapes match data (games, times, dates, teams, venues) from Touch Football team drawer pages.

## Purpose

This scraper:
1. Takes a drawer URL as input
2. Navigates to the drawer page
3. Extracts match data (games, times, dates, teams, venues)
4. Returns JSON with all matches

## Input

```json
{
  "drawerUrl": "https://touchfootball.com.au/competitions/.../draw"
}
```

- `drawerUrl`: The full URL to the team's drawer page (obtained from Scraper 1)

## Output

### Success
```json
{
  "type": "match",
  "date": "Round 1",
  "round": "Round 1",
  "kickOffTime": "6:00 PM",
  "dateTime": "2024-01-01T18:00:00",
  "homeTeam": "Team A",
  "awayTeam": "Team B",
  "venue": "Field 1",
  "matchUrl": "https://touchfootball.com.au/competitions/.../match/123",
  "matchUrlRelative": "/competitions/.../match/123",
  "scrapedFrom": "https://..."
}
```

### No Matches Found
```json
{
  "type": "error",
  "message": "No match data found",
  "drawerUrl": "https://..."
}
```

## How to Use

1. Run Scraper 1 (Discoverer) to get the drawer URL
2. Copy the drawer URL from Scraper 1 output
3. Use that URL as input for this scraper
4. Get the match/game data JSON

## Running on Apify

1. Create a new actor in Apify
2. Upload this code
3. Provide the drawer URL from Scraper 1
4. Run it to get the match data from the drawer
