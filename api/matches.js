// Serverless function to fetch Atlanta United match data from ASA API
// Uses TWO endpoints:
//   /mls/games - accurate final scores (includes own goals)
//   /mls/games/xgoals - xG analytics data
// Joins them by game_id for complete match information
// 
// Supports ?season= parameter to load one season at a time for faster response

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600'); // Cache for 1 hour

  try {
    const atlantaId = 'KAqBN0Vqbg';
    
    // Get season from query param, default to current year
    const requestedSeason = req.query.season;
    const currentYear = new Date().getFullYear();
    
    // If "all" is requested, fetch all seasons; otherwise fetch just the requested one
    let seasons = [];
    if (requestedSeason === 'all') {
      for (let year = 2017; year <= currentYear; year++) {
        seasons.push(year);
      }
    } else {
      // If no season requested, use current year unless it's early in the year (before March)
      // when the new season hasn't started yet
      const defaultSeason = (new Date().getMonth() < 2) ? currentYear - 1 : currentYear;
      seasons = [requestedSeason || defaultSeason];
    }

    // Fetch lookup data in parallel for speed
    const [teamsRes, stadiaRes, managersRes, refereesRes, playersRes] = await Promise.all([
      fetch('https://app.americansocceranalysis.com/api/v1/mls/teams'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/stadia'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/managers'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/referees'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players')
    ]);

    const [teams, stadia, managers, referees, players] = await Promise.all([
      teamsRes.json(),
      stadiaRes.json(),
      managersRes.json(),
      refereesRes.json(),
      playersRes.json()
    ]);
    
    // Build lookup maps
    const teamMap = {};
    teams.forEach(team => {
      teamMap[team.team_id] = {
        name: team.team_name,
        abbreviation: team.team_abbreviation
      };
    });

    const stadiumMap = {};
    stadia.forEach(stadium => {
      stadiumMap[stadium.stadium_id] = stadium.stadium_name;
    });

    const managerMap = {};
    managers.forEach(manager => {
      managerMap[manager.manager_id] = manager.manager_name;
    });

    const refereeMap = {};
    referees.forEach(referee => {
      refereeMap[referee.referee_id] = referee.referee_name;
    });

    // Build player lookup map
    const playerMap = {};
    players.forEach(player => {
      playerMap[player.player_id] = player.player_name;
    });

    // Fetch game data for requested seasons in parallel
    const seasonPromises = seasons.map(async (season) => {
      const [gamesRes, xgoalsRes, playerXgoalsRes] = await Promise.all([
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/games?season_name=${season}`),
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?season_name=${season}`),
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/xgoals?team_id=${atlantaId}&season_name=${season}&split_by_games=true`)
      ]);
      
      const [games, xgoals, playerXgoals] = await Promise.all([
        gamesRes.json(),
        xgoalsRes.json(),
        playerXgoalsRes.json()
      ]);
      
      return { games, xgoals, playerXgoals };
    });

    const seasonData = await Promise.all(seasonPromises);

    // Combine all games and xgoals
    const allGames = [];
    const allXgoals = [];
    const allPlayerXgoals = [];
    
    seasonData.forEach(({ games, xgoals, playerXgoals }) => {
      const atlantaGames = games.filter(g => 
        g.home_team_id === atlantaId || g.away_team_id === atlantaId
      );
      allGames.push(...atlantaGames);
      
      const atlantaXgoals = xgoals.filter(g => 
        g.home_team_id === atlantaId || g.away_team_id === atlantaId
      );
      allXgoals.push(...atlantaXgoals);
      
      // Player xgoals already filtered by team_id in the API call
      allPlayerXgoals.push(...playerXgoals);
    });

    // Build xgoals lookup map by game_id
    const xgoalsMap = {};
    allXgoals.forEach(xg => {
      xgoalsMap[xg.game_id] = xg;
    });

    // Build player xgoals lookup map by game_id (array of players per game)
    const playerXgoalsMap = {};
    allPlayerXgoals.forEach(px => {
      if (!playerXgoalsMap[px.game_id]) {
        playerXgoalsMap[px.game_id] = [];
      }
      playerXgoalsMap[px.game_id].push({
        name: playerMap[px.player_id] || 'Unknown',
        position: px.general_position,
        minutes: px.minutes_played,
        shots: px.shots,
        shotsOnTarget: px.shots_on_target,
        goals: px.goals,
        xg: px.xgoals,
        xgDiff: px.goals_minus_xgoals,
        keyPasses: px.key_passes,
        assists: px.primary_assists,
        xa: px.xassists,
        xgPlusXa: px.xgoals_plus_xassists
      });
    });

    // Combine data and enrich with names
    const enrichedMatches = allGames.map(game => {
      const xgData = xgoalsMap[game.game_id] || {};
      const isHome = game.home_team_id === atlantaId;
      
      // Get opponent info
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      const opponent = teamMap[opponentId] || { name: 'Unknown', abbreviation: 'UNK' };
      
      // Calculate result from ACTUAL scores (not xG-based goals)
      const atlScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      
      let result;
      if (atlScore > oppScore) result = 'W';
      else if (atlScore < oppScore) result = 'L';
      else result = 'D';

      // Get xG values
      const atlXg = isHome ? xgData.home_team_xgoals : xgData.away_team_xgoals;
      const oppXg = isHome ? xgData.away_team_xgoals : xgData.home_team_xgoals;
      
      // Get xPoints
      const atlXpoints = isHome ? xgData.home_xpoints : xgData.away_xpoints;
      
      // Determine if Atlanta was robbed or got a smash-and-grab
      let xgVerdict = null;
      const xgDiff = (atlXg || 0) - (oppXg || 0);
      if (result === 'L' && xgDiff > 0.5) {
        xgVerdict = 'robbed';
      } else if (result === 'W' && xgDiff < -0.5) {
        xgVerdict = 'smash-and-grab';
      }

      return {
        gameId: game.game_id,
        date: game.date_time_utc,
        season: game.season_name,
        matchday: game.matchday,
        isHome: isHome,
        opponent: opponent.name,
        opponentAbbr: opponent.abbreviation,
        atlScore: atlScore,
        oppScore: oppScore,
        result: result,
        atlXg: atlXg ? parseFloat(atlXg.toFixed(2)) : null,
        oppXg: oppXg ? parseFloat(oppXg.toFixed(2)) : null,
        xgDiff: atlXg && oppXg ? parseFloat((atlXg - oppXg).toFixed(2)) : null,
        atlXpoints: atlXpoints ? parseFloat(atlXpoints.toFixed(2)) : null,
        xgVerdict: xgVerdict,
        attendance: game.attendance,
        stadium: stadiumMap[game.stadium_id] || null,
        referee: refereeMap[game.referee_id] || null,
        atlManager: isHome 
          ? (managerMap[game.home_manager_id] || null)
          : (managerMap[game.away_manager_id] || null),
        oppManager: isHome
          ? (managerMap[game.away_manager_id] || null)
          : (managerMap[game.home_manager_id] || null),
        expandedMinutes: game.expanded_minutes,
        isPlayoff: game.knockout_game,
        status: game.status,
        
        // Player stats for this match (sorted by xG contribution)
        players: (playerXgoalsMap[game.game_id] || [])
          .filter(p => p.minutes > 0)
          .sort((a, b) => (b.xgPlusXa || 0) - (a.xgPlusXa || 0))
      };
    });

    // Sort by date descending (most recent first)
    enrichedMatches.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate summary stats
    const summary = {
      totalMatches: enrichedMatches.length,
      wins: enrichedMatches.filter(m => m.result === 'W').length,
      draws: enrichedMatches.filter(m => m.result === 'D').length,
      losses: enrichedMatches.filter(m => m.result === 'L').length,
      goalsFor: enrichedMatches.reduce((sum, m) => sum + (m.atlScore || 0), 0),
      goalsAgainst: enrichedMatches.reduce((sum, m) => sum + (m.oppScore || 0), 0),
      totalXgFor: parseFloat(enrichedMatches.reduce((sum, m) => sum + (m.atlXg || 0), 0).toFixed(2)),
      totalXgAgainst: parseFloat(enrichedMatches.reduce((sum, m) => sum + (m.oppXg || 0), 0).toFixed(2)),
      robberies: enrichedMatches.filter(m => m.xgVerdict === 'robbed').length,
      smashAndGrabs: enrichedMatches.filter(m => m.xgVerdict === 'smash-and-grab').length
    };

    // Build available seasons list
    const availableSeasons = [];
    for (let year = currentYear; year >= 2017; year--) {
      availableSeasons.push(year);
    }

    res.status(200).json({
      summary: summary,
      matches: enrichedMatches,
      availableSeasons: availableSeasons,
      loadedSeason: requestedSeason || ((new Date().getMonth() < 2) ? currentYear - 1 : currentYear)
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch match data', details: error.message });
  }
}
