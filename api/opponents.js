// Serverless function to return all opponents Atlanta United has faced
// with aggregate W-D-L records for the opponent index page
//
// No parameters required. Returns all opponents sorted alphabetically.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const atlantaId = 'KAqBN0Vqbg';
    const seasons = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];

    // Fetch teams + all season games in parallel
    const [teamsRes, ...seasonResponses] = await Promise.all([
      fetch('https://app.americansocceranalysis.com/api/v1/mls/teams'),
      ...seasons.map(season =>
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/games?team_id=${atlantaId}&season_name=${season}`)
      )
    ]);

    const teams = await teamsRes.json();
    const teamMap = {};
    teams.forEach(t => {
      teamMap[t.team_id] = { name: t.team_name, abbr: t.team_abbreviation };
    });

    // Collect all matches
    const allMatches = [];
    for (const response of seasonResponses) {
      const games = await response.json();
      games.forEach(game => {
        const isHome = game.home_team_id === atlantaId;
        const oppId = isHome ? game.away_team_id : game.home_team_id;
        const oppInfo = teamMap[oppId] || { name: 'Unknown', abbr: 'UNK' };
        const atlScore = isHome ? game.home_score : game.away_score;
        const oppScore = isHome ? game.away_score : game.home_score;

        let result = 'D';
        if (atlScore > oppScore) result = 'W';
        else if (atlScore < oppScore) result = 'L';

        allMatches.push({
          opponent: oppInfo.name,
          opponentId: oppId,
          result: result,
          date: game.date_time_utc
        });
      });
    }

    // Normalize opponent name to URL slug
    const normalizeOpponent = (name) => {
      return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^fc-/, '')
        .replace(/-fc$/, '')
        .replace(/-sc$/, '')
        .replace(/^real-/, '')
        .replace(/-cf$/, '');
    };

    // Group by opponent and compute records
    const opponentMap = {};
    allMatches.forEach(m => {
      if (m.opponent === 'Unknown') return;
      if (!opponentMap[m.opponent]) {
        opponentMap[m.opponent] = { wins: 0, draws: 0, losses: 0, total: 0, lastPlayed: null };
      }
      const opp = opponentMap[m.opponent];
      opp.total++;
      if (m.result === 'W') opp.wins++;
      else if (m.result === 'D') opp.draws++;
      else opp.losses++;
      if (!opp.lastPlayed || m.date > opp.lastPlayed) opp.lastPlayed = m.date;
    });

    const opponents = Object.keys(opponentMap)
      .sort()
      .map(name => ({
        name: name,
        slug: normalizeOpponent(name),
        wins: opponentMap[name].wins,
        draws: opponentMap[name].draws,
        losses: opponentMap[name].losses,
        total: opponentMap[name].total,
        lastPlayed: opponentMap[name].lastPlayed ? opponentMap[name].lastPlayed.split('T')[0] : null
      }));

    res.status(200).json({ opponents });

  } catch (error) {
    console.error('Error fetching opponents data:', error);
    res.status(500).json({ error: 'Failed to fetch opponents data', details: error.message });
  }
}
