// Vercel Serverless Function - Player Index API
// Aggregates all Atlanta United players across seasons with career totals
// Uses /mls/players for name lookup and /mls/players/xgoals for stats

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

  try {
    const atlantaId = 'KAqBN0Vqbg';
    const seasons = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

    // Fetch player name lookups (paginated) and per-season xgoals in parallel
    const [p1Res, p2Res, p3Res, p4Res, ...xgoalsResponses] = await Promise.all([
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=0'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=1000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=2000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=3000'),
      ...seasons.map(season =>
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/xgoals?team_id=${atlantaId}&season_name=${season}`)
      )
    ]);

    const [p1, p2, p3, p4] = await Promise.all([
      p1Res.json(), p2Res.json(), p3Res.json(), p4Res.json()
    ]);
    const allPlayers = [...p1, ...p2, ...p3, ...p4];

    // Build player name lookup
    const playerMap = {};
    allPlayers.forEach(p => {
      playerMap[p.player_id] = p.player_name;
    });

    // Parse all xgoals season data
    const allXgoals = [];
    for (let i = 0; i < xgoalsResponses.length; i++) {
      const data = await xgoalsResponses[i].json();
      data.forEach(record => {
        record._season = parseInt(seasons[i]);
      });
      allXgoals.push(...data);
    }

    // Group by player_id and aggregate career totals
    const playerStats = {};
    allXgoals.forEach(record => {
      const pid = record.player_id;
      if (!playerStats[pid]) {
        playerStats[pid] = {
          id: pid,
          name: playerMap[pid] || 'Unknown',
          seasons: new Set(),
          appearances: 0,
          goals: 0,
          assists: 0,
          minutes: 0,
          xgoals: 0,
          xassists: 0,
          position: record.general_position,
          _lastSeason: 0
        };
      }

      const ps = playerStats[pid];
      ps.seasons.add(record._season);
      ps.appearances += record.games_played || 0;
      ps.goals += record.goals || 0;
      ps.assists += record.primary_assists || 0;
      ps.minutes += record.minutes_played || 0;
      ps.xgoals += record.xgoals || 0;
      ps.xassists += record.xassists || 0;

      // Keep most recent season's position
      if (record._season > ps._lastSeason) {
        ps._lastSeason = record._season;
        ps.position = record.general_position;
      }
    });

    // Format season ranges (e.g., "2017-2019, 2022")
    function formatSeasonRange(seasonsSet) {
      const sorted = Array.from(seasonsSet).sort((a, b) => a - b);
      if (sorted.length === 0) return '';
      const ranges = [];
      let start = sorted[0];
      let end = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
          end = sorted[i];
        } else {
          ranges.push(start === end ? `${start}` : `${start}-${end}`);
          start = sorted[i];
          end = sorted[i];
        }
      }
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      return ranges.join(', ');
    }

    // Generate slugs with collision detection
    function generateSlug(name) {
      return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }

    const slugCounts = {};
    const players = Object.values(playerStats)
      .filter(p => p.name !== 'Unknown')
      .sort((a, b) => b.appearances - a.appearances)
      .map(p => {
        let baseSlug = generateSlug(p.name);
        if (!slugCounts[baseSlug]) {
          slugCounts[baseSlug] = 1;
        } else {
          slugCounts[baseSlug]++;
          baseSlug = `${baseSlug}-${slugCounts[baseSlug]}`;
        }

        return {
          id: p.id,
          name: p.name,
          slug: baseSlug,
          position: p.position,
          seasons: Array.from(p.seasons).sort((a, b) => a - b),
          seasonsRange: formatSeasonRange(p.seasons),
          appearances: p.appearances,
          goals: p.goals,
          assists: p.assists,
          minutes: p.minutes,
          xgoals: parseFloat(p.xgoals.toFixed(2)),
          xassists: parseFloat(p.xassists.toFixed(2))
        };
      });

    return res.status(200).json({
      players,
      totalCount: players.length
    });

  } catch (error) {
    console.error('Error fetching player data:', error);
    return res.status(500).json({ error: 'Failed to fetch player data', details: error.message });
  }
}
