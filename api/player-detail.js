// Vercel Serverless Function - Player Detail API
// Returns per-season analytics for an individual Atlanta United player
// Params: ?slug={slug}&season={year} (season optional, defaults to most recent)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  try {
    const { slug, season: requestedSeason } = req.query;

    if (!slug) {
      return res.status(400).json({ error: 'slug parameter is required' });
    }

    const atlantaId = 'KAqBN0Vqbg';
    const seasons = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

    // Phase 1: Slug resolution — replicate players.js logic exactly
    const [p1Res, p2Res, p3Res, p4Res, ...xgoalsResponses] = await Promise.all([
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=0'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=1000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=2000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=3000'),
      ...seasons.map(season =>
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/xgoals?team_id=${atlantaId}&season_name=${season}&split_by_games=true`)
      )
    ]);

    const [p1, p2, p3, p4] = await Promise.all([
      p1Res.json(), p2Res.json(), p3Res.json(), p4Res.json()
    ]);
    const allPlayers = [...p1, ...p2, ...p3, ...p4];

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
      ps.appearances += 1;
      ps.goals += record.goals || 0;
      ps.assists += record.primary_assists || 0;
      ps.minutes += record.minutes_played || 0;
      ps.xgoals += record.xgoals || 0;
      ps.xassists += record.xassists || 0;

      if (record._season > ps._lastSeason) {
        ps._lastSeason = record._season;
        ps.position = record.general_position;
      }
    });

    // Format season ranges
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

    // Generate slugs with collision detection — must match players.js exactly
    function generateSlug(name) {
      return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }

    const slugCounts = {};
    const sortedPlayers = Object.values(playerStats)
      .filter(p => p.name !== 'Unknown')
      .sort((a, b) => b.appearances - a.appearances);

    let matchedPlayer = null;
    for (const p of sortedPlayers) {
      let baseSlug = generateSlug(p.name);
      if (!slugCounts[baseSlug]) {
        slugCounts[baseSlug] = 1;
      } else {
        slugCounts[baseSlug]++;
        baseSlug = `${baseSlug}-${slugCounts[baseSlug]}`;
      }

      if (baseSlug === slug) {
        matchedPlayer = { ...p, slug: baseSlug };
        break;
      }
    }

    if (!matchedPlayer) {
      return res.status(404).json({ error: 'Player not found', slug });
    }

    const playerId = matchedPlayer.id;
    const isGK = matchedPlayer.position === 'GK';
    const availableSeasons = Array.from(matchedPlayer.seasons).sort((a, b) => b - a);
    const season = requestedSeason ? parseInt(requestedSeason) : availableSeasons[0];

    if (!matchedPlayer.seasons.has(season)) {
      return res.status(404).json({ error: 'No data for this player in the requested season', season });
    }

    // Phase 2: Season detail fetches
    const detailFetches = [
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/xgoals?player_id=${playerId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/goals-added?player_id=${playerId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/xpass?player_id=${playerId}&season_name=${season}&split_by_games=true`),
      fetch(`https://app.americansocceranalysis.com/api/v1/mls/games?team_id=${atlantaId}&season_name=${season}`),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/teams')
    ];

    if (isGK) {
      detailFetches.push(
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/xgoals?player_id=${playerId}&season_name=${season}&split_by_games=true`),
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/goalkeepers/goals-added?player_id=${playerId}&season_name=${season}&split_by_games=true`)
      );
    }

    const detailResponses = await Promise.all(detailFetches);
    const [xgoalsData, gaData, xpassData, gamesData, teamsData] = await Promise.all(
      detailResponses.slice(0, 5).map(r => r.json())
    );

    let gkXgoalsData = [], gkGaData = [];
    if (isGK) {
      [gkXgoalsData, gkGaData] = await Promise.all(
        detailResponses.slice(5).map(r => r.json())
      );
    }

    // Build team lookup
    const teamMap = {};
    teamsData.forEach(t => { teamMap[t.team_id] = t.team_name; });

    // Build game context lookup
    const gameMap = {};
    gamesData.forEach(game => {
      const isHome = game.home_team_id === atlantaId;
      const oppId = isHome ? game.away_team_id : game.home_team_id;
      gameMap[game.game_id] = {
        date: game.date_time_utc ? game.date_time_utc.split(' ')[0] : null,
        opponent: teamMap[oppId] || 'Unknown',
        isHome,
        atlScore: isHome ? game.home_score : game.away_score,
        oppScore: isHome ? game.away_score : game.home_score
      };
    });

    // Build per-game goals-added lookup
    const gaGameMap = {};
    gaData.forEach(record => {
      if (record.game_id) {
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
        gaGameMap[record.game_id] = actions;
      }
    });

    // Build per-game xpass lookup
    const xpassGameMap = {};
    xpassData.forEach(record => {
      if (record.game_id) {
        xpassGameMap[record.game_id] = {
          attemptedPasses: record.attempted_passes || 0,
          passCompletion: record.pass_completion_percentage != null ? parseFloat((record.pass_completion_percentage * 100).toFixed(1)) : null,
          xpassCompletion: record.pass_completion_percentage_expected != null ? parseFloat((record.pass_completion_percentage_expected * 100).toFixed(1)) : null,
          passesOverExpected: record.passes_completed_over_expected != null ? parseFloat(record.passes_completed_over_expected.toFixed(1)) : null,
          shareOfTeamPasses: record.share_team_touches != null ? parseFloat((record.share_team_touches * 100).toFixed(1)) : null
        };
      }
    });

    // Build GK per-game lookups if GK
    const gkXgGameMap = {};
    const gkGaGameMap = {};
    if (isGK) {
      gkXgoalsData.forEach(record => {
        if (record.game_id) {
          gkXgGameMap[record.game_id] = {
            shotsFaced: record.shots_faced || 0,
            saves: record.saves || 0,
            goalsConceded: record.goals_conceded || 0,
            xgoalsFaced: record.xgoals_gk_faced != null ? parseFloat(record.xgoals_gk_faced.toFixed(2)) : null,
            goalsMinusXgoals: record.goals_minus_xgoals_gk != null ? parseFloat(record.goals_minus_xgoals_gk.toFixed(2)) : null
          };
        }
      });
      gkGaData.forEach(record => {
        if (record.game_id) {
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
          gkGaGameMap[record.game_id] = actions;
        }
      });
    }

    // Aggregate season stats from per-game xgoals data
    let aggAppearances = 0, aggMinutes = 0, aggGoals = 0, aggXgoals = 0;
    let aggShots = 0, aggShotsOnTarget = 0, aggAssists = 0, aggXassists = 0, aggKeyPasses = 0;
    let aggAttemptedPasses = 0, aggPassCompNum = 0, aggPassCompDen = 0;
    let aggXpassCompNum = 0, aggXpassCompDen = 0, aggPassesOverExpected = 0, aggTouchShareSum = 0;

    // Goals-added aggregation
    const gaAgg = {};
    const gaTypes = isGK
      ? ['Claiming', 'Fielding', 'Handling', 'Passing', 'Shotstopping', 'Sweeping']
      : ['Dribbling', 'Fouling', 'Interrupting', 'Passing', 'Receiving', 'Shooting'];

    gaTypes.forEach(t => { gaAgg[t] = { raw: 0, aboveAvg: 0 }; });

    // GK aggregate stats
    let gkAggShotsFaced = 0, gkAggSaves = 0, gkAggGoalsConceded = 0;
    let gkAggXgoalsFaced = 0, gkHasXgoals = false;

    // Build games array
    const games = [];
    xgoalsData.forEach(record => {
      if (!record.game_id) return;

      const gameInfo = gameMap[record.game_id] || {};
      const gaGame = gaGameMap[record.game_id] || {};
      const xpassGame = xpassGameMap[record.game_id] || {};

      const minutes = record.minutes_played || 0;
      const goals = record.goals || 0;
      const xg = record.xgoals || 0;
      const shots = record.shots || 0;
      const shotsOnTarget = record.shots_on_target || 0;
      const assists = record.primary_assists || 0;
      const xa = record.xassists || 0;
      const keyPasses = record.key_passes || 0;

      aggAppearances++;
      aggMinutes += minutes;
      aggGoals += goals;
      aggXgoals += xg;
      aggShots += shots;
      aggShotsOnTarget += shotsOnTarget;
      aggAssists += assists;
      aggXassists += xa;
      aggKeyPasses += keyPasses;

      // Passing aggregation
      if (xpassGame.attemptedPasses) {
        aggAttemptedPasses += xpassGame.attemptedPasses;
      }
      if (xpassGame.passCompletion != null && xpassGame.attemptedPasses) {
        aggPassCompNum += (xpassGame.passCompletion / 100) * xpassGame.attemptedPasses;
        aggPassCompDen += xpassGame.attemptedPasses;
      }
      if (xpassGame.xpassCompletion != null && xpassGame.attemptedPasses) {
        aggXpassCompNum += (xpassGame.xpassCompletion / 100) * xpassGame.attemptedPasses;
        aggXpassCompDen += xpassGame.attemptedPasses;
      }
      if (xpassGame.passesOverExpected != null) {
        aggPassesOverExpected += xpassGame.passesOverExpected;
      }
      if (xpassGame.shareOfTeamPasses != null) {
        aggTouchShareSum += xpassGame.shareOfTeamPasses;
      }

      // Goals-added per game (only for outfield; GK uses separate endpoint)
      let gaTotal = 0;
      if (!isGK) {
        Object.entries(gaGame).forEach(([type, vals]) => {
          if (gaAgg[type]) {
            gaAgg[type].raw += vals.raw;
            gaAgg[type].aboveAvg += vals.aboveAvg;
          }
          gaTotal += vals.raw;
        });
      }

      const atlScore = gameInfo.atlScore;
      const oppScore = gameInfo.oppScore;
      let result = null;
      if (atlScore != null && oppScore != null) {
        result = atlScore > oppScore ? 'W' : atlScore < oppScore ? 'L' : 'D';
      }

      const gameEntry = {
        gameId: record.game_id,
        date: gameInfo.date || null,
        opponent: gameInfo.opponent || 'Unknown',
        isHome: gameInfo.isHome || false,
        atlScore,
        oppScore,
        result,
        minutes,
        goals,
        xgoals: parseFloat(xg.toFixed(2)),
        shots,
        shotsOnTarget,
        assists,
        xassists: parseFloat(xa.toFixed(2)),
        keyPasses,
        goalsAdded: gaGame,
        goalsAddedTotal: parseFloat(gaTotal.toFixed(4)),
        passing: xpassGame
      };

      // Add GK-specific game stats
      if (isGK) {
        const gkXg = gkXgGameMap[record.game_id] || {};
        const gkGa = gkGaGameMap[record.game_id] || {};

        gameEntry.gk = {
          shotsFaced: gkXg.shotsFaced || 0,
          saves: gkXg.saves || 0,
          goalsConceded: gkXg.goalsConceded || 0,
          xgoalsFaced: gkXg.xgoalsFaced,
          goalsMinusXgoals: gkXg.goalsMinusXgoals,
          goalsAdded: gkGa
        };

        let gkGaTotal = 0;
        Object.values(gkGa).forEach(a => { gkGaTotal += a.raw; });
        gameEntry.gk.goalsAddedTotal = parseFloat(gkGaTotal.toFixed(4));

        // GK season aggregates
        gkAggShotsFaced += gkXg.shotsFaced || 0;
        gkAggSaves += gkXg.saves || 0;
        gkAggGoalsConceded += gkXg.goalsConceded || 0;
        if (gkXg.xgoalsFaced != null) {
          gkAggXgoalsFaced += gkXg.xgoalsFaced;
          gkHasXgoals = true;
        }

        // GK goals-added aggregation (uses GK-specific types)
        Object.entries(gkGa).forEach(([type, vals]) => {
          if (gaAgg[type]) {
            gaAgg[type].raw += vals.raw;
            gaAgg[type].aboveAvg += vals.aboveAvg;
          }
        });
      }

      games.push(gameEntry);
    });

    // Sort games by date descending
    games.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Round goals-added aggregates
    Object.keys(gaAgg).forEach(key => {
      gaAgg[key].raw = parseFloat(gaAgg[key].raw.toFixed(4));
      gaAgg[key].aboveAvg = parseFloat(gaAgg[key].aboveAvg.toFixed(4));
    });

    let totalGoalsAdded = 0;
    Object.values(gaAgg).forEach(a => { totalGoalsAdded += a.raw; });

    // Build aggregate passing stats
    const aggPassing = {
      attemptedPasses: aggAttemptedPasses,
      passCompletion: aggPassCompDen > 0 ? parseFloat(((aggPassCompNum / aggPassCompDen) * 100).toFixed(1)) : null,
      xpassCompletion: aggXpassCompDen > 0 ? parseFloat(((aggXpassCompNum / aggXpassCompDen) * 100).toFixed(1)) : null,
      passesOverExpected: parseFloat(aggPassesOverExpected.toFixed(1)),
      avgTouchShare: aggAppearances > 0 ? parseFloat((aggTouchShareSum / aggAppearances).toFixed(1)) : null
    };

    const responseData = {
      player: {
        name: matchedPlayer.name,
        slug: matchedPlayer.slug,
        position: matchedPlayer.position,
        seasons: availableSeasons,
        seasonsRange: formatSeasonRange(matchedPlayer.seasons),
        career: {
          appearances: matchedPlayer.appearances,
          goals: matchedPlayer.goals,
          assists: matchedPlayer.assists,
          minutes: matchedPlayer.minutes,
          xgoals: parseFloat(matchedPlayer.xgoals.toFixed(2)),
          xassists: parseFloat(matchedPlayer.xassists.toFixed(2))
        }
      },
      season: season,
      availableSeasons,
      aggregate: {
        appearances: aggAppearances,
        minutes: aggMinutes,
        goals: aggGoals,
        xgoals: parseFloat(aggXgoals.toFixed(2)),
        goalsMinusXgoals: parseFloat((aggGoals - aggXgoals).toFixed(2)),
        shots: aggShots,
        shotsOnTarget: aggShotsOnTarget,
        assists: aggAssists,
        xassists: parseFloat(aggXassists.toFixed(2)),
        keyPasses: aggKeyPasses,
        passing: aggPassing,
        goalsAdded: gaAgg,
        totalGoalsAdded: parseFloat(totalGoalsAdded.toFixed(4))
      },
      games
    };

    // Add GK aggregate if applicable
    if (isGK) {
      responseData.aggregate.gk = {
        shotsFaced: gkAggShotsFaced,
        saves: gkAggSaves,
        goalsConceded: gkAggGoalsConceded,
        savePercentage: gkAggShotsFaced > 0 ? parseFloat(((gkAggSaves / gkAggShotsFaced) * 100).toFixed(1)) : 0,
        xgoalsFaced: gkHasXgoals ? parseFloat(gkAggXgoalsFaced.toFixed(2)) : null,
        goalsPrevented: gkHasXgoals ? parseFloat((gkAggGoalsConceded - gkAggXgoalsFaced).toFixed(2)) : null
      };
    }

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching player detail:', error);
    return res.status(500).json({ error: 'Failed to fetch player detail', details: error.message });
  }
}
