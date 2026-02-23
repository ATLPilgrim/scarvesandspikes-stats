// Vercel Serverless Function - Opponent History API
// Returns all Atlanta United matches against a specific opponent

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // Cache for 4 hours (fetches all seasons; data changes ~2x/week during season)
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=14400');

  const { opponent } = req.query;
  
  if (!opponent) {
    return res.status(400).json({ error: 'Opponent parameter required' });
  }

  try {
    const atlantaId = 'KAqBN0Vqbg';
    const seasons = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    
    // Fetch reference data
    const [teamsRes, stadiaRes, managersRes, refereesRes] = await Promise.all([
      fetch('https://app.americansocceranalysis.com/api/v1/mls/teams'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/stadia'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/managers'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/referees')
    ]);

    const [teams, stadia, managers, referees] = await Promise.all([
      teamsRes.json(),
      stadiaRes.json(),
      managersRes.json(),
      refereesRes.json()
    ]);

    // Build lookup maps
    const teamMap = {};
    teams.forEach(t => {
      teamMap[t.team_id] = { name: t.team_name, abbr: t.team_abbreviation };
    });

    const stadiumMap = {};
    stadia.forEach(s => { stadiumMap[s.stadium_id] = s.stadium_name; });

    const managerMap = {};
    managers.forEach(m => { managerMap[m.manager_id] = m.manager_name; });

    const refereeMap = {};
    referees.forEach(r => { refereeMap[r.referee_id] = r.referee_name; });

    // Fetch all seasons in parallel
    const seasonPromises = seasons.map(async (season) => {
      const [gamesRes, xgoalsRes] = await Promise.all([
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/games?team_id=${atlantaId}&season_name=${season}`),
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?team_id=${atlantaId}&season_name=${season}`)
      ]);

      const [games, xgoals] = await Promise.all([
        gamesRes.json(),
        xgoalsRes.json()
      ]);

      // Build xgoals lookup by game_id
      const xgoalsMap = {};
      xgoals.forEach(g => { xgoalsMap[g.game_id] = g; });

      return games.map(game => {
        const xgData = xgoalsMap[game.game_id] || {};
        const isHome = game.home_team_id === atlantaId;
        const oppId = isHome ? game.away_team_id : game.home_team_id;
        const oppInfo = teamMap[oppId] || { name: 'Unknown', abbr: 'UNK' };

        const atlScore = isHome ? game.home_score : game.away_score;
        const oppScore = isHome ? game.away_score : game.home_score;

        const atlXgRaw = isHome ? xgData.home_team_xgoals : xgData.away_team_xgoals;
        const oppXgRaw = isHome ? xgData.away_team_xgoals : xgData.home_team_xgoals;
        const atlXg = atlXgRaw ? parseFloat(atlXgRaw.toFixed(2)) : null;
        const oppXg = oppXgRaw ? parseFloat(oppXgRaw.toFixed(2)) : null;

        let result = 'D';
        if (atlScore > oppScore) result = 'W';
        else if (atlScore < oppScore) result = 'L';

        const xgDiff = (atlXg !== null && oppXg !== null)
          ? parseFloat((atlXg - oppXg).toFixed(2))
          : null;

        let xgVerdict = null;
        if (xgDiff !== null) {
          if (result === 'L' && xgDiff >= 0.5) xgVerdict = 'robbed';
          else if (result === 'W' && xgDiff <= -0.5) xgVerdict = 'smash-and-grab';
        }

        return {
          gameId: game.game_id,
          date: game.date_time_utc,
          season: season,
          matchday: game.matchday,
          isHome,
          isPlayoff: game.knockout_game,
          opponent: oppInfo.name,
          opponentAbbr: oppInfo.abbr,
          opponentId: oppId,
          atlScore,
          oppScore,
          atlXg,
          oppXg,
          xgDiff,
          result,
          xgVerdict,
          attendance: game.attendance,
          stadium: stadiumMap[game.stadium_id] || null,
          atlManager: managerMap[isHome ? game.home_manager_id : game.away_manager_id] || null,
          oppManager: managerMap[isHome ? game.away_manager_id : game.home_manager_id] || null,
          referee: refereeMap[game.referee_id] || null,
          expandedMinutes: game.expanded_minutes
        };
      });
    });

    const allSeasonMatches = await Promise.all(seasonPromises);
    let allMatches = allSeasonMatches.flat();

    // Normalize opponent name for matching
    const normalizeOpponent = (name) => {
      return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents (é → e)
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^fc-/, '')
        .replace(/-fc$/, '')
        .replace(/-sc$/, '')
        .replace(/^real-/, '')
        .replace(/-cf$/, '');
    };

    const requestedSlug = normalizeOpponent(decodeURIComponent(opponent));

    // Find matching opponent
    const matchingMatches = allMatches.filter(m => {
      const matchSlug = normalizeOpponent(m.opponent);
      return matchSlug === requestedSlug || 
             matchSlug.includes(requestedSlug) || 
             requestedSlug.includes(matchSlug);
    });

    if (matchingMatches.length === 0) {
      // Return list of available opponents
      const availableOpponents = [...new Set(allMatches.map(m => m.opponent))].sort();
      return res.status(404).json({ 
        error: 'Opponent not found',
        requestedSlug,
        availableOpponents: availableOpponents.map(o => ({
          name: o,
          slug: normalizeOpponent(o)
        }))
      });
    }

    // Sort by date descending
    matchingMatches.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate aggregate stats
    const opponentName = matchingMatches[0].opponent;
    const opponentAbbr = matchingMatches[0].opponentAbbr;
    
    const stats = {
      totalMatches: matchingMatches.length,
      wins: matchingMatches.filter(m => m.result === 'W').length,
      draws: matchingMatches.filter(m => m.result === 'D').length,
      losses: matchingMatches.filter(m => m.result === 'L').length,
      goalsFor: matchingMatches.reduce((sum, m) => sum + (m.atlScore || 0), 0),
      goalsAgainst: matchingMatches.reduce((sum, m) => sum + (m.oppScore || 0), 0),
      xgFor: parseFloat(matchingMatches.reduce((sum, m) => sum + (m.atlXg || 0), 0).toFixed(2)),
      xgAgainst: parseFloat(matchingMatches.reduce((sum, m) => sum + (m.oppXg || 0), 0).toFixed(2)),
      homeWins: matchingMatches.filter(m => m.isHome && m.result === 'W').length,
      homeDraws: matchingMatches.filter(m => m.isHome && m.result === 'D').length,
      homeLosses: matchingMatches.filter(m => m.isHome && m.result === 'L').length,
      awayWins: matchingMatches.filter(m => !m.isHome && m.result === 'W').length,
      awayDraws: matchingMatches.filter(m => !m.isHome && m.result === 'D').length,
      awayLosses: matchingMatches.filter(m => !m.isHome && m.result === 'L').length,
      robberies: matchingMatches.filter(m => m.xgVerdict === 'robbed').length,
      smashAndGrabs: matchingMatches.filter(m => m.xgVerdict === 'smash-and-grab').length,
      biggestWin: null,
      biggestLoss: null,
      currentStreak: null
    };

    // Find biggest win and loss
    const wins = matchingMatches.filter(m => m.result === 'W');
    const losses = matchingMatches.filter(m => m.result === 'L');
    
    if (wins.length > 0) {
      const biggestWin = wins.reduce((best, m) => {
        const margin = m.atlScore - m.oppScore;
        const bestMargin = best.atlScore - best.oppScore;
        return margin > bestMargin ? m : best;
      });
      stats.biggestWin = {
        score: `${biggestWin.atlScore}-${biggestWin.oppScore}`,
        date: biggestWin.date,
        venue: biggestWin.isHome ? 'Home' : 'Away'
      };
    }

    if (losses.length > 0) {
      const biggestLoss = losses.reduce((worst, m) => {
        const margin = m.oppScore - m.atlScore;
        const worstMargin = worst.oppScore - worst.atlScore;
        return margin > worstMargin ? m : worst;
      });
      stats.biggestLoss = {
        score: `${biggestLoss.atlScore}-${biggestLoss.oppScore}`,
        date: biggestLoss.date,
        venue: biggestLoss.isHome ? 'Home' : 'Away'
      };
    }

    // Calculate current streak
    let streak = { type: matchingMatches[0]?.result, count: 0 };
    for (const match of matchingMatches) {
      if (match.result === streak.type) {
        streak.count++;
      } else {
        break;
      }
    }
    stats.currentStreak = streak;

    // Get list of all opponents for navigation
    const allOpponents = [...new Set(allMatches.map(m => m.opponent))].sort().map(o => ({
      name: o,
      slug: normalizeOpponent(o)
    }));

    return res.status(200).json({
      opponent: opponentName,
      opponentAbbr,
      slug: normalizeOpponent(opponentName),
      stats,
      matches: matchingMatches,
      allOpponents
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to fetch opponent data' });
  }
}
