// Vercel Serverless Function - Dynamic Sitemap
// Generates XML sitemap with all opponent pages for SEO

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // Cache for 24 hours

  try {
    const atlantaId = 'KAqBN0Vqbg';
    const baseUrl = 'https://scarvesandspikes-stats.vercel.app';
    
    // Fetch all teams Atlanta has played
    const seasons = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
    
    const [teamsRes, ...seasonResponses] = await Promise.all([
      fetch('https://app.americansocceranalysis.com/api/v1/mls/teams'),
      ...seasons.map(season => 
        fetch(`https://app.americansocceranalysis.com/api/v1/mls/games?team_id=${atlantaId}&season_name=${season}`)
      )
    ]);

    const teams = await teamsRes.json();
    const teamMap = {};
    teams.forEach(t => { teamMap[t.team_id] = t.team_name; });

    // Collect all unique opponents
    const opponentIds = new Set();
    for (const response of seasonResponses) {
      const games = await response.json();
      games.forEach(game => {
        const oppId = game.home_team_id === atlantaId ? game.away_team_id : game.home_team_id;
        opponentIds.add(oppId);
      });
    }

    // Normalize opponent name to URL slug
    const normalizeOpponent = (name) => {
      return name.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^fc-/, '')
        .replace(/-fc$/, '')
        .replace(/-sc$/, '')
        .replace(/^real-/, '')
        .replace(/-cf$/, '');
    };

    // Build opponent list
    const opponents = Array.from(opponentIds)
      .map(id => ({
        name: teamMap[id] || 'Unknown',
        slug: normalizeOpponent(teamMap[id] || 'unknown')
      }))
      .filter(o => o.name !== 'Unknown')
      .sort((a, b) => a.name.localeCompare(b.name));

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
${opponents.map(o => `  <url>
    <loc>${baseUrl}/opponent.html?team=${o.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;

    return res.status(200).send(xml);

  } catch (error) {
    console.error('Sitemap error:', error);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate sitemap</error>');
  }
}
