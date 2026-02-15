export default async function handler(request, response) {
  const apiUrl = 'https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?season_name=2024';
  
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ScarvesAndSpikes/1.0'
      }
    });
    
    const text = await res.text();
    
    if (!res.ok) {
      return response.status(500).json({ 
        error: `API returned ${res.status}`,
        details: text.substring(0, 500)
      });
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return response.status(500).json({ 
        error: 'Failed to parse JSON',
        details: text.substring(0, 500)
      });
    }
    
    // Filter for Atlanta United
    const atlMatches = data.filter(game => 
      game.home_team_name?.includes('Atlanta') || 
      game.away_team_name?.includes('Atlanta')
    );
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 's-maxage=3600');
    
    return response.status(200).json(atlMatches);
    
  } catch (error) {
    return response.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}
