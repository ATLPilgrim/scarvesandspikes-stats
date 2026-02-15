export default async function handler(request, response) {
  try {
    // Build season list dynamically: 2017 through current year
    const currentYear = new Date().getFullYear();
    const seasons = [];
    for (let year = 2017; year <= currentYear; year++) {
      seasons.push(year);
    }
    const seasonParam = seasons.join(',');
    
    const gamesUrl = `https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?season_name=${seasonParam}`;
    
    const gamesRes = await fetch(gamesUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ScarvesAndSpikes/1.0' }
    });
    
    const games = await gamesRes.json();
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    
    return response.status(200).json({
      url_called: gamesUrl,
      total_games_returned: games.length,
      seasons_requested: seasons,
      sample_dates: games.slice(0, 3).map(g => g.date_time_utc),
      oldest_date: games.length > 0 ? games[games.length - 1].date_time_utc : null
    });
    
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
