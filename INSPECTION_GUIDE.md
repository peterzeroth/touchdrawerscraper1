# How to Find the Right Selectors

## Steps to Inspect Touch Football Australia

1. **Go to the search URL**: https://touchfootball.com.au/competitions/search/?searchTerm=adf+warriors

2. **Open browser developer tools**:
   - Press `F12` or right-click → "Inspect"

3. **Inspect the search results**:
   - Look for links to teams in the results
   - Right-click on a team link and select "Inspect"

4. **Note the HTML structure**:
   - Look for classes, IDs, or data attributes
   - Common patterns:
     - `<a href="...">Team Name</a>`
     - `<div class="team-link">...</div>`
     - `<tr><td>Team Name</td></tr>`

5. **Find the unique identifiers**:
   - Look for CSS classes like: `.team-name`, `.result-item`, etc.
   - Look for HTML structure like: `article`, `div`, `li`, etc.
   - Look for data attributes like: `data-team-id`, etc.

## What We're Looking For

### In Search Results
- **Team links**: Links that go to team pages
- **Team names**: The text that identifies each team
- **Container elements**: The wrapper that contains each result

### In Team Pages
- **Drawer/Squad link**: Link to the drawer/squad page
- **Team information**: Team name, competition, etc.

### In Drawer Pages
- **Player tables**: Tables containing player data
- **Player rows**: Individual player entries
- **Player information**: Name, position, jersey number

## Example Selectors to Try

### For Team Links
```javascript
// Try these selectors one by one:
'a[href*="/team/"]'
'a[href*="/competitions/"]'
'.result-link'
'.team-name a'
'div.search-result a'
```

### For Drawer Links
```javascript
// Try these selectors:
'a[href*="draw"]'
'a[href*="squad"]'
'a[href*="roster"]'
```

### For Players
```javascript
// Try these selectors:
'table tr'  // Table rows
'.player-row'
'[data-player]'
```

## Share Your Findings

After inspecting, share:
1. What you see in the HTML
2. The CSS classes/IDs you found
3. Screenshots if helpful

Then we can update the scraper with the correct selectors!
