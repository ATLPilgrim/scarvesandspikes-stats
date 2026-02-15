// Serverless function to fetch Atlanta United match data from ASA API
// Uses TWO endpoints:
//   /mls/games - accurate final scores (includes own goals)
//   /mls/games/xgoals - xG analytics data
// Joins them by game_id for complete match information

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600'); // Cache for 1 hour

  try {
    const atlantaId = 'KAqBN0Vqbg';
    
    // Build season list dynamically (Atlanta joined MLS in 2017)
    const currentYear = new Date().getFullYear();
    const seasons = [];
    for (let year = 2017; year <= currentYear; year++) {
      seasons.push(year);
    }

    // Fetch teams for name lookup
    const teamsRes = await fetch('https://app.americansocceranalysis.com/api/v1/mls/teams');
    const teams = await teamsRes.json();
    
    // Build team lookup map
    const teamMap = {};
    teams.forEach(team => {
      teamMap[team.team_id] = {
        name: team.team_name,
        abbreviation: team.team_abbreviation
      };
    });

    // Fetch stadia for stadium name lookup
    const stadiaRes = await fetch('https://app.americansocceranalysis.com/api/v1/mls/stadia');
    const stadia = await stadiaRes.json();
    
    // Build stadium lookup map
    const stadiumMap = {};
    stadia.forEach(stadium => {
      stadiumMap[stadium.stadium_id] = stadium.stadium_name;
    });

    // Fetch managers for manager name lookup
    const managersRes = await fetch('https://app.americansocceranalysis.com/api/v1/mls/managers');
    const managers = await managersRes.json();
    
    // Build manager lookup map
    const managerMap = {};
    managers.forEach(manager => {
      managerMap[manager.manager_id] = manager.manager_name;
    });

    // Fetch referees for referee name lookup
    const refereesRes = await fetch('https://app.americansocceranalysis.com/api/v1/mls/referees');
    const referees = await refereesRes.json();
    
    // Build referee lookup map
    const refereeMap = {};
    referees.forEach(referee => {
      refereeMap[referee.referee_id] = referee.referee_name;
    });

    // Fetch data from both endpoints for each season
    const allGames = [];
    const allXgoals = [];

    for (const season of seasons) {
      // Fetch actual match results (accurate scores)
      const gamesRes = await fetch(
        `https://app.americansocceranalysis.com/api/v1/mls/games?season_name=${season}`
      );
      const games = await gamesRes.json();
      
      // Filter for Atlanta United games
      const atlantaGames = games.filter(g => 
        g.home_team_id === atlantaId || g.away_team_id === atlantaId
      );
      allGames.push(...atlantaGames);

      // Fetch xG data
      const xgoalsRes = await fetch(
        `https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?season_name=${season}`
      );
      const xgoals = await xgoalsRes.json();
      
      // Filter for Atlanta United games
      const atlantaXgoals = xgoals.filter(g => 
        g.home_team_id === atlantaId || g.away_team_id === atlantaId
      );
      allXgoals.push(...atlantaXgoals);
    }

    // Build xgoals lookup map by game_id
    const xgoalsMap = {};
    allXgoals.forEach(xg => {
      xgoalsMap[xg.game_id] = xg;
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
      // Robbed: Won xG battle significantly but didn't get expected result
      // Smash and grab: Won despite losing xG battle
      let xgVerdict = null;
      const xgDiff = (atlXg || 0) - (oppXg || 0);
      if (result === 'L' && xgDiff > 0.5) {
        xgVerdict = 'robbed';
      } else if (result === 'W' && xgDiff < -0.5) {
        xgVerdict = 'smash-and-grab';
      }

      return {
        // Match identification
        gameId: game.game_id,
        date: game.date_time_utc,
        season: game.season_name,
        matchday: game.matchday,
        
        // Teams
        isHome: isHome,
        opponent: opponent.name,
        opponentAbbr: opponent.abbreviation,
        
        // ACTUAL score (from /games endpoint - includes own goals)
        atlScore: atlScore,
        oppScore: oppScore,
        result: result,
        
        // xG analytics (from /games/xgoals endpoint)
        atlXg: atlXg ? parseFloat(atlXg.toFixed(2)) : null,
        oppXg: oppXg ? parseFloat(oppXg.toFixed(2)) : null,
        xgDiff: atlXg && oppXg ? parseFloat((atlXg - oppXg).toFixed(2)) : null,
        atlXpoints: atlXpoints ? parseFloat(atlXpoints.toFixed(2)) : null,
        xgVerdict: xgVerdict,
        
        // Match details
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
        status: game.status
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
      smashAndGrabs: enrichedMatches.filter(m => m.xgVerdict === 'smash-and-grab').length,
      avgAttendance: Math.round(
        enrichedMatches.filter(m => m.attendance).reduce((sum, m) => sum + m.attendance, 0) /
        enrichedMatches.filter(m => m.attendance).length
      )
    };

    res.status(200).json({
      summary: summary,
      matches: enrichedMatches
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch match data', details: error.message });
  }
}
