export default async function handler(request, response) {
  try {
    // Fetch teams and games in parallel
    const [teamsRes, gamesRes] = await Promise.all([
      fetch('https://app.americansocceranalysis.com/api/v1/mls/teams', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'ScarvesAndSpikes/1.0' }
      }),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?season_name=2024', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'ScarvesAndSpikes/1.0' }
      })
    ]);
    
    const teams = await teamsRes.json();
    const games = await gamesRes.json();
    
    // Create team lookup map
    const teamMap = {};
    teams.forEach(t => {
      teamMap[t.team_id] = t;
    });
    
    // Atlanta's team ID
    const atlantaId = 'KAqBN0Vqbg';
    
    // Filter for Atlanta games and enrich with team names
    const atlantaGames = games
      .filter(g => g.home_team_id === atlantaId || g.away_team_id === atlantaId)
      .map(g => ({
        game_id: g.game_id,
        date: g.date_time_utc,
        home_team: teamMap[g.home_team_id]?.team_name || g.home_team_id,
        home_abbrev: teamMap[g.home_team_id]?.team_abbreviation || '',
        away_team: teamMap[g.away_team_id]?.team_name || g.away_team_id,
        away_abbrev: teamMap[g.away_team_id]?.team_abbreviation || '',
        home_goals: g.home_goals,
        away_goals: g.away_goals,
        home_xg: g.home_team_xgoals,
        away_xg: g.away_team_xgoals
      }));
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 's-maxage=3600');
    
    return response.status(200).json(atlantaGames);
    
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
