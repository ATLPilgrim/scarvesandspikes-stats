// Vercel Serverless Function - Dynamic Sitemap
// Generates XML sitemap with all opponent and player pages for SEO

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400'); // Cache for 24 hours

  try {
    const atlantaId = 'KAqBN0Vqbg';
    const baseUrl = 'https://stats.scarvesandspikes.com';

    // Fetch all teams Atlanta has played
    const seasons = Array.from({ length: new Date().getFullYear() - 2016 }, (_, i) => String(2017 + i));

    const [teamsRes, p1Res, p2Res, p3Res, p4Res, ...seasonResponses] = await Promise.all([
      fetch('https://app.americansocceranalysis.com/api/v1/mls/teams'),
      // Player name lookups (paginated)
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=0'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=1000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=2000'),
      fetch('https://app.americansocceranalysis.com/api/v1/mls/players?offset=3000'),
      // Game data per season (for opponents)
      ...seasons.map(season =>
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/games?team_id=${atlantaId}&season_name=${season}`)
      ),
    ]);

    // Fetch player xgoals per season (for player slugs)
    const xgoalsResponses = await Promise.all(
      seasons.map(season =>
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/players/xgoals?team_id=${atlantaId}&season_name=${season}`)
      )
    );

    const teams = await teamsRes.json();
    const teamMap = {};
    teams.forEach(t => { teamMap[t.team_id] = t.team_name; });

    // Build player name lookup
    const [p1, p2, p3, p4] = await Promise.all([
      p1Res.json(), p2Res.json(), p3Res.json(), p4Res.json()
    ]);
    const allPlayerData = [...p1, ...p2, ...p3, ...p4];
    const playerMap = {};
    allPlayerData.forEach(p => { playerMap[p.player_id] = p.player_name; });

    // Collect all unique opponents
    const opponentIds = new Set();
    for (const response of seasonResponses) {
      const games = await response.json();
      games.forEach(game => {
        const oppId = game.home_team_id === atlantaId ? game.away_team_id : game.home_team_id;
        opponentIds.add(oppId);
      });
    }

    // Collect all unique Atlanta player IDs
    const playerIds = new Set();
    for (const response of xgoalsResponses) {
      const records = await response.json();
      records.forEach(r => { playerIds.add(r.player_id); });
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

    // Player slug normalization (must match players.js)
    const normalizePlayerName = (name) => {
      return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    };

    // Build opponent list
    const opponents = Array.from(opponentIds)
      .map(id => ({
        name: teamMap[id] || 'Unknown',
        slug: normalizeOpponent(teamMap[id] || 'unknown')
      }))
      .filter(o => o.name !== 'Unknown')
      .sort((a, b) => a.name.localeCompare(b.name));

    // Build player list with collision-safe slugs
    const slugCounts = {};
    const players = Array.from(playerIds)
      .map(id => playerMap[id])
      .filter(name => name && name !== 'Unknown')
      .sort()
      .map(name => {
        let baseSlug = normalizePlayerName(name);
        if (!slugCounts[baseSlug]) {
          slugCounts[baseSlug] = 1;
        } else {
          slugCounts[baseSlug]++;
          baseSlug = `${baseSlug}-${slugCounts[baseSlug]}`;
        }
        return { name, slug: baseSlug };
      });

    // Generate sitemap XML
    const today = new Date().toISOString().split('T')[0];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/goalkeeper.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/players.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/opponent.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/history.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/league.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
${opponents.map(o => `  <url>
    <loc>${baseUrl}/opponent.html?team=${o.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
${players.map(p => `  <url>
    <loc>${baseUrl}/player.html?id=${p.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;

    return res.status(200).send(xml);

  } catch (error) {
    console.error('Sitemap error:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate sitemap</error>');
  }
}
