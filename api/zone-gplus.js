// Serverless function to fetch Atlanta United goals-added by pitch zone from ASA API
// Fetches /mls/teams/goals-added for each of 30 zones in parallel
//
// Supports ?season= parameter (required)
// Returns net g+ (for minus against) per zone and per action type

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const atlantaId = 'KAqBN0Vqbg';
    const season = req.query.season;

    if (!season) {
      return res.status(400).json({ error: 'season parameter is required (e.g. ?season=2024)' });
    }

    // Fetch all 30 zones in parallel
    const zonePromises = [];
    for (let z = 1; z <= 30; z++) {
      zonePromises.push(
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/teams/goals-added?team_id=${atlantaId}&season_name=${season}&zone=${z}`)
      );
    }

    const zoneResponses = await Promise.all(zonePromises);
    const zoneData = await Promise.all(zoneResponses.map(r => r.json()));

    // Shape zone data
    const zones = {};
    for (let z = 1; z <= 30; z++) {
      const data = zoneData[z - 1];

      if (!data || !Array.isArray(data) || data.length === 0 || !data[0].data) {
        zones[z] = null;
        continue;
      }

      const record = data[0];
      const actions = {};
      let totalFor = 0;
      let totalAgainst = 0;

      record.data.forEach(entry => {
        const gFor = entry.goals_added_for || 0;
        const gAgainst = entry.goals_added_against || 0;
        totalFor += gFor;
        totalAgainst += gAgainst;
        actions[entry.action_type] = {
          goalsAddedFor: parseFloat(gFor.toFixed(4)),
          goalsAddedAgainst: parseFloat(gAgainst.toFixed(4)),
          net: parseFloat((gFor - gAgainst).toFixed(4))
        };
      });

      zones[z] = {
        minutes: record.minutes || 0,
        totalFor: parseFloat(totalFor.toFixed(4)),
        totalAgainst: parseFloat(totalAgainst.toFixed(4)),
        net: parseFloat((totalFor - totalAgainst).toFixed(4)),
        actions: actions
      };
    }

    res.status(200).json({
      season: season,
      zones: zones
    });

  } catch (error) {
    console.error('Error fetching zone g+ data:', error);
    res.status(500).json({ error: 'Failed to fetch zone data', details: error.message });
  }
}
