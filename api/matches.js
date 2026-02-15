export default async function handler(request, response) {
  const apiUrl = 'https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?season_name=2024';
  
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ScarvesAndSpikes/1.0'
      }
    });
    
    const data = await res.json();
    
    // Return the first game's complete structure so we can see all field names
    response.setHeader('Access-Control-Allow-Origin', '*');
    
    return response.status(200).json({
      total_games: data.length,
      first_game_fields: Object.keys(data[0] || {}),
      first_game_full: data[0]
    });
    
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
