// Serverless function to fetch opponent team per-game analytics from ASA API
// Same structure as match-details.js but for a specific opponent team
//
// Supports ?season= and ?team_id= parameters (both required)
// Returns player xpass, goals-added, and goalkeeper data keyed by game_id

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const teamId = req.query.team_id;
    const season = req.query.season;

    if (!teamId || !season) {
      return res.status(400).json({ error: 'team_id and season parameters are required' });
    }

    // Fetch all endpoints in parallel
    const [xpassRes, goalsAddedRes, gkRes, gkGaRes, players1Res, players2Res, players3Res, players4Res] = await Promise.all([
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/xpass?team_id=${teamId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/goals-added?team_id=${teamId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/xgoals?team_id=${teamId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/goals-added?team_id=${teamId}&season_name=${season}&split_by_games=true`),
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

    // Shape goals-added data
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

    // Build GK goals-added lookup
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

    res.status(200).json({
      season: season,
      teamId: teamId,
      games: games
    });

  } catch (error) {
    console.error('Error fetching opponent details:', error);
    res.status(500).json({ error: 'Failed to fetch opponent details', details: error.message });
  }
}
