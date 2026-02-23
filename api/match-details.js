// Serverless function to fetch per-match player analytics from ASA API
// Uses FOUR endpoints (all with split_by_games=true):
//   /mls/players/xpass - passing quality, touch share, directness
//   /mls/players/goals-added - g+ breakdown by action type per player
//   /mls/goalkeepers/xgoals - goalkeeper save performance vs xG
//   /mls/goalkeepers/goals-added - goalkeeper g+ by action type
//
// Supports ?season= parameter (required, rejects "all")
// Returns all games in one response, keyed by game_id

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  // Cache-Control set dynamically before response (see below)

  try {
    const atlantaId = 'KAqBN0Vqbg';
    const season = req.query.season;

    if (!season || season === 'all') {
      return res.status(400).json({ error: 'A specific season is required (e.g. ?season=2024)' });
    }

    // Fetch all 4 player endpoints + paginated player names in parallel
    const [xpassRes, goalsAddedRes, gkRes, gkGaRes, players1Res, players2Res, players3Res, players4Res] = await Promise.all([
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/xpass?team_id=${atlantaId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/goals-added?team_id=${atlantaId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/xgoals?team_id=${atlantaId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/goals-added?team_id=${atlantaId}&season_name=${season}&split_by_games=true`),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=0'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=1000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=2000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=3000')
    ]);

    const [xpassData, goalsAddedData, gkData, gkGaData, players1, players2, players3, players4] = await Promise.all([
      xpassRes.json(),
      goalsAddedRes.json(),
      gkRes.json(),
      gkGaRes.json(),
      players1Res.json(),
      players2Res.json(),
      players3Res.json(),
      players4Res.json()
    ]);

    // Build player name lookup
    const allPlayers = [...players1, ...players2, ...players3, ...players4];
    const playerMap = {};
    allPlayers.forEach(player => {
      playerMap[player.player_id] = player.player_name;
    });

    // Build games object keyed by game_id
    const games = {};

    function ensureGame(gameId) {
      if (!games[gameId]) {
        games[gameId] = { xpass: [], goalsAdded: [], goalkeeper: [] };
      }
    }

    // Shape xpass data
    xpassData.forEach(record => {
      ensureGame(record.game_id);
      games[record.game_id].xpass.push({
        name: playerMap[record.player_id] || 'Unknown',
        position: record.general_position,
        minutes: record.minutes_played,
        attemptedPasses: record.attempted_passes,
        passCompletion: record.pass_completion_percentage,
        xpassCompletion: record.xpass_completion_percentage,
        passesOverExpected: record.passes_completed_over_expected,
        avgVerticalDistance: record.avg_vertical_distance_yds,
        touchShare: record.share_team_touches
      });
    });

    // Shape goals-added data (nested data[] array per record)
    goalsAddedData.forEach(record => {
      ensureGame(record.game_id);
      const actions = {};
      if (record.data && record.data.length > 0) {
        record.data.forEach(entry => {
          if (entry.action_type) {
            actions[entry.action_type] = {
              goalsAdded: entry.goals_added_raw != null ? parseFloat(entry.goals_added_raw.toFixed(4)) : 0,
              aboveAvg: entry.goals_added_above_avg != null ? parseFloat(entry.goals_added_above_avg.toFixed(4)) : 0
            };
          }
        });
      }
      games[record.game_id].goalsAdded.push({
        name: playerMap[record.player_id] || 'Unknown',
        position: record.general_position,
        minutes: record.minutes_played,
        actions: actions
      });
    });

    // Build GK goals-added lookup keyed by game_id + "_" + player_id
    const gkGoalsAddedMap = {};
    gkGaData.forEach(record => {
      const key = record.game_id + '_' + record.player_id;
      const actions = {};
      if (record.data && record.data.length > 0) {
        record.data.forEach(entry => {
          if (entry.action_type) {
            actions[entry.action_type] = {
              goalsAdded: entry.goals_added_raw != null ? parseFloat(entry.goals_added_raw.toFixed(4)) : 0,
              aboveAvg: entry.goals_added_above_avg != null ? parseFloat(entry.goals_added_above_avg.toFixed(4)) : 0
            };
          }
        });
      }
      gkGoalsAddedMap[key] = actions;
    });

    // Shape goalkeeper data
    gkData.forEach(record => {
      ensureGame(record.game_id);
      const gaKey = record.game_id + '_' + record.player_id;
      games[record.game_id].goalkeeper.push({
        name: playerMap[record.player_id] || 'Unknown',
        shotsFaced: record.shots_faced,
        saves: record.saves,
        goalsConceded: record.goals_conceded,
        xgoalsFaced: record.xgoals_gk_faced != null ? parseFloat(record.xgoals_gk_faced.toFixed(2)) : null,
        goalsMinusXgoals: record.goals_minus_xgoals_gk != null ? parseFloat(record.goals_minus_xgoals_gk.toFixed(2)) : null,
        goalsAdded: gkGoalsAddedMap[gaKey] || null
      });
    });

    // Dynamic cache TTL based on season
    const currentYear = new Date().getFullYear();
    const isHistorical = parseInt(season) < currentYear;
    if (!isHistorical && Object.keys(games).length === 0) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    } else if (isHistorical) {
      res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=604800');
    } else {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
    }

    res.status(200).json({
      season: season,
      games: games
    });

  } catch (error) {
    console.error('Error fetching match details:', error);
    res.status(500).json({ error: 'Failed to fetch match details', details: error.message });
  }
}
