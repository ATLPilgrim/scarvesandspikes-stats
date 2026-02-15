export default async function handler(request, response) {
  try {
    // Build season list: 2017 through current year
    const currentYear = new Date().getFullYear();
    const seasons = [];
    for (let year = 2017; year <= currentYear; year++) {
      seasons.push(year);
    }
    
    // Fetch teams first
    const teamsRes = await fetch('https://app.americansocceranalysis.com/api/v1/mls/teams', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ScarvesAndSpikes/1.0' }
    });
    const teams = await teamsRes.json();
    
    // Create team lookup map
    const teamMap = {};
    teams.forEach(t => {
      teamMap[t.team_id] = t;
    });
    
    // Atlanta's team ID
    const atlantaId = 'KAqBN0Vqbg';
    
    // Fetch each season separately to avoid the 1000 record limit
    const allGames = [];
    
    for (const season of seasons) {
      const gamesRes = await fetch(
        `https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?season_name=${season}`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'ScarvesAndSpikes/1.0' } }
      );
      const games = await gamesRes.json();
      
      // Filter for Atlanta and add to collection
      const atlantaGames = games.filter(g => 
        g.home_team_id === atlantaId || g.away_team_id === atlantaId
      );
      allGames.push(...atlantaGames);
    }
    
    // Enrich with team names and format
    const enrichedGames = allGames
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
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 's-maxage=3600');
    
    return response.status(200).json(enrichedGames);
    
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
