// Serverless function to fetch Atlanta United goalkeeper analytics from ASA API
// Uses FOUR GK endpoints (aggregate + per-game for both xgoals and goals-added):
//   /mls/goalkeepers/xgoals - save performance, xG faced
//   /mls/goalkeepers/goals-added - g+ by GK action type (Claiming, Fielding, Handling, Passing, Shotstopping, Sweeping)
//
// Supports ?season= parameter (required, rejects "all")

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const atlantaId = 'KAqBN0Vqbg';
    const season = req.query.season;

    if (!season || season === 'all') {
      return res.status(400).json({ error: 'A specific season is required (e.g. ?season=2024)' });
    }

    // Fetch all endpoints in parallel
    const [
      xgoalsAggRes, goalsAddedAggRes,
      xgoalsGameRes, goalsAddedGameRes,
      gamesRes, teamsRes,
      players1Res, players2Res, players3Res, players4Res
    ] = await Promise.all([
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/xgoals?team_id=${atlantaId}&season_name=${season}`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/goals-added?team_id=${atlantaId}&season_name=${season}`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/xgoals?team_id=${atlantaId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/goals-added?team_id=${atlantaId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/games?team_id=${atlantaId}&season_name=${season}`),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/teams'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=0'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=1000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=2000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=3000')
    ]);

    const [
      xgoalsAgg, goalsAddedAgg,
      xgoalsGame, goalsAddedGame,
      gamesData, teamsData,
      players1, players2, players3, players4
    ] = await Promise.all([
      xgoalsAggRes.json(), goalsAddedAggRes.json(),
      xgoalsGameRes.json(), goalsAddedGameRes.json(),
      gamesRes.json(), teamsRes.json(),
      players1Res.json(), players2Res.json(), players3Res.json(), players4Res.json()
    ]);

    // Build team name lookup
    const teamMap = {};
    teamsData.forEach(t => { teamMap[t.team_id] = t.team_name; });

    // Build player name lookup
    const allPlayers = [...players1, ...players2, ...players3, ...players4];
    const playerMap = {};
    allPlayers.forEach(p => { playerMap[p.player_id] = p.player_name; });

    // Build game lookup (Atlanta games only)
    const gameMap = {};
    gamesData.forEach(game => {
      const isHome = game.home_team_id === atlantaId;
      const oppId = isHome ? game.away_team_id : game.home_team_id;
      gameMap[game.game_id] = {
        date: game.date_time_utc ? game.date_time_utc.split('T')[0] : null,
        opponent: teamMap[oppId] || 'Unknown',
        isHome: isHome,
        atlScore: isHome ? game.home_score : game.away_score,
        oppScore: isHome ? game.away_score : game.home_score
      };
    });

    // Build GK goals-added aggregate lookup keyed by player_id
    const gkGaAggMap = {};
    goalsAddedAgg.forEach(record => {
      const actions = {};
      if (record.data && record.data.length > 0) {
        record.data.forEach(entry => {
          if (entry.action_type) {
            actions[entry.action_type] = {
              raw: entry.goals_added_raw != null ? parseFloat(entry.goals_added_raw.toFixed(4)) : 0,
              aboveAvg: entry.goals_added_above_avg != null ? parseFloat(entry.goals_added_above_avg.toFixed(4)) : 0,
              count: entry.count_actions || 0
            };
          }
        });
      }
      gkGaAggMap[record.player_id] = actions;
    });

    // Build per-game GK goals-added lookup keyed by player_id -> game_id
    const gkGaGameMap = {};
    goalsAddedGame.forEach(record => {
      if (!gkGaGameMap[record.player_id]) gkGaGameMap[record.player_id] = {};
      const actions = {};
      if (record.data && record.data.length > 0) {
        record.data.forEach(entry => {
          if (entry.action_type) {
            actions[entry.action_type] = {
              raw: entry.goals_added_raw != null ? parseFloat(entry.goals_added_raw.toFixed(4)) : 0,
              aboveAvg: entry.goals_added_above_avg != null ? parseFloat(entry.goals_added_above_avg.toFixed(4)) : 0
            };
          }
        });
      }
      gkGaGameMap[record.player_id][record.game_id] = actions;
    });

    // Build per-game xgoals lookup keyed by player_id -> game_id
    const gkXgGameMap = {};
    xgoalsGame.forEach(record => {
      if (!gkXgGameMap[record.player_id]) gkXgGameMap[record.player_id] = {};
      gkXgGameMap[record.player_id][record.game_id] = {
        minutesPlayed: record.minutes_played || 0,
        shotsFaced: record.shots_faced || 0,
        saves: record.saves || 0,
        goalsConceded: record.goals_conceded || 0,
        xgoalsFaced: record.xgoals_gk_faced != null ? parseFloat(record.xgoals_gk_faced.toFixed(2)) : null,
        goalsMinusXgoals: record.goals_minus_xgoals_gk != null ? parseFloat(record.goals_minus_xgoals_gk.toFixed(2)) : null
      };
    });

    // Build goalkeeper array from aggregate xgoals data
    const goalkeepers = xgoalsAgg.map(record => {
      const playerId = record.player_id;
      const gaActions = gkGaAggMap[playerId] || {};

      // Calculate total goals added
      let totalGoalsAdded = 0;
      Object.values(gaActions).forEach(a => { totalGoalsAdded += a.raw; });

      // Build per-game array
      const playerGames = gkXgGameMap[playerId] || {};
      const playerGaGames = gkGaGameMap[playerId] || {};
      const games = Object.keys(playerGames).map(gameId => {
        const gameInfo = gameMap[gameId] || {};
        const gxg = playerGames[gameId];
        const gaGame = playerGaGames[gameId] || {};

        let gameGaTotal = 0;
        Object.values(gaGame).forEach(a => { gameGaTotal += a.raw; });

        const atlScore = gameInfo.atlScore;
        const oppScore = gameInfo.oppScore;
        let result = null;
        if (atlScore != null && oppScore != null) {
          result = atlScore > oppScore ? 'W' : atlScore < oppScore ? 'L' : 'D';
        }

        return {
          gameId: gameId,
          date: gameInfo.date || null,
          opponent: gameInfo.opponent || 'Unknown',
          isHome: gameInfo.isHome || false,
          atlScore: atlScore,
          oppScore: oppScore,
          result: result,
          minutesPlayed: gxg.minutesPlayed,
          shotsFaced: gxg.shotsFaced,
          saves: gxg.saves,
          goalsConceded: gxg.goalsConceded,
          xgoalsFaced: gxg.xgoalsFaced,
          goalsMinusXgoals: gxg.goalsMinusXgoals,
          goalsAdded: gaGame,
          goalsAddedTotal: parseFloat(gameGaTotal.toFixed(4))
        };
      });

      // Sort games by date descending
      games.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      return {
        name: playerMap[playerId] || 'Unknown',
        aggregate: {
          gamesPlayed: games.length,
          minutesPlayed: record.minutes_played || 0,
          shotsFaced: record.shots_faced || 0,
          saves: record.saves || 0,
          goalsConceded: record.goals_conceded || 0,
          savePercentage: record.shots_faced > 0 ? parseFloat(((record.saves / record.shots_faced) * 100).toFixed(1)) : 0,
          xgoalsFaced: record.xgoals_gk_faced != null ? parseFloat(record.xgoals_gk_faced.toFixed(2)) : null,
          goalsMinusXgoals: record.goals_minus_xgoals_gk != null ? parseFloat(record.goals_minus_xgoals_gk.toFixed(2)) : null,
          goalsDividedByXgoals: record.goals_divided_by_xgoals_gk != null ? parseFloat(record.goals_divided_by_xgoals_gk.toFixed(3)) : null,
          goalsAdded: gaActions,
          totalGoalsAdded: parseFloat(totalGoalsAdded.toFixed(4))
        },
        games: games
      };
    });

    // Sort by minutes played descending (primary starter first)
    goalkeepers.sort((a, b) => b.aggregate.minutesPlayed - a.aggregate.minutesPlayed);

    // Available seasons
    const availableSeasons = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

    res.status(200).json({
      season: season,
      goalkeepers: goalkeepers,
      availableSeasons: availableSeasons
    });

  } catch (error) {
    console.error('Error fetching goalkeeper data:', error);
    res.status(500).json({ error: 'Failed to fetch goalkeeper data', details: error.message });
  }
}
