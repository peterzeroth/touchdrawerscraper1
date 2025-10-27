# TouchDraw Discoverer

**Scraper 1 of 2**: Discovers the drawer URL for Touch Football teams.

## Purpose

This scraper:
1. Searches for a team on Touch Football Australia
2. Lists all matching team options
3. Selects the specified team
4. Finds the drawer/squad/roster link on the team page
5. Returns the drawer URL

## Output

### Success
```json
{
  "type": "drawer-url",
  "found": true,
  "url": "https://touchfootball.com.au/.../draw",
  "linkText": "Draw",
  "teamPageUrl": "https://...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### No Drawer Found
```json
{
  "type": "drawer-url",
  "found": false,
  "url": null,
  "linkText": null,
  "teamPageUrl": "https://...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Next Steps

After running this scraper:
1. Check the output for the `drawer-url` type
2. If `found: true`, use the `url` field in Scraper 2
3. If `found: false`, the team may not have a public drawer

## Running on Apify

1. Create a new actor in Apify
2. Upload this code
3. Use the same input format as the main scraper
4. Run it to get the drawer URL
5. Copy the drawer URL to use in Scraper 2
