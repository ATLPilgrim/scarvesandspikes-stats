// Serverless function to fetch Atlanta United season-level insights from ASA API
// Uses TWO endpoints:
//   /mls/teams/xgoals - luck metric (points vs xPoints)
//   /mls/teams/goals-added - g+ breakdown by action type
//
// Supports ?season= parameter (required, rejects "all")

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

    // Fetch team xgoals and goals-added in parallel
    const [xgoalsRes, goalsAddedRes] = await Promise.all([
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/teams/xgoals?team_id=${atlantaId}&season_name=${season}`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/teams/goals-added?team_id=${atlantaId}&season_name=${season}`)
    ]);

    const [xgoalsData, goalsAddedData] = await Promise.all([
      xgoalsRes.json(),
      goalsAddedRes.json()
    ]);

    // Extract xgoals record (array with one entry for the team/season)
    const xg = xgoalsData && xgoalsData.length > 0 ? xgoalsData[0] : null;

    // Build luck value: actual points minus expected points
    let luckValue = null;
    let context = null;
    if (xg) {
      luckValue = xg.points != null && xg.xpoints != null
        ? parseFloat((xg.points - xg.xpoints).toFixed(2))
        : null;
      context = {
        games_played: xg.count_games || null,
        goals_for: xg.goals_for || null,
        goals_against: xg.goals_against || null,
        points: xg.points || null,
        xpoints: xg.xpoints != null ? parseFloat(xg.xpoints.toFixed(1)) : null,
        xgoals_for: xg.xgoals_for != null ? parseFloat(xg.xgoals_for.toFixed(1)) : null,
        xgoals_against: xg.xgoals_against != null ? parseFloat(xg.xgoals_against.toFixed(1)) : null
      };
    }

    // Build radar data from goals-added (nested: [{team_id, data: [{action_type, ...}]}])
    const radarData = {};
    const teamGa = goalsAddedData && goalsAddedData.length > 0 ? goalsAddedData[0] : null;
    if (teamGa && teamGa.data && teamGa.data.length > 0) {
      teamGa.data.forEach(entry => {
        const action = entry.action_type;
        if (action) {
          radarData[action] = {
            goals_added_for: entry.goals_added_for != null ? parseFloat(entry.goals_added_for.toFixed(2)) : 0,
            goals_added_against: entry.goals_added_against != null ? parseFloat(entry.goals_added_against.toFixed(2)) : 0,
            num_actions_for: entry.num_actions_for || null
          };
        }
      });
    }

    // Dynamic cache TTL based on season
    const currentYear = new Date().getFullYear();
    const isHistorical = parseInt(season) < currentYear;
    if (!isHistorical && xg === null && Object.keys(radarData).length === 0) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    } else if (isHistorical) {
      res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=604800');
    } else {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
    }

    res.status(200).json({
      season: season,
      luckValue: luckValue,
      radarData: radarData,
      context: context
    });

  } catch (error) {
    console.error('Error fetching insights data:', error);
    res.status(500).json({ error: 'Failed to fetch insights data', details: error.message });
  }
}
