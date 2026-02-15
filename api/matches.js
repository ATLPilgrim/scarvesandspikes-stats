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
    
    // Debug: return first 3 games with team names so we can see the format
    const sample = data.slice(0, 3).map(g => ({
      home: g.home_team_name,
      away: g.away_team_name,
      date: g.date_time_utc
    }));
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    
    return response.status(200).json({
      total_games: data.length,
      sample_teams: sample,
      all_home_teams: [...new Set(data.map(g => g.home_team_name))].sort()
    });
    
  } catch (error) {
    return response.status(500).json({ 
      error: error.message
    });
  }
}
