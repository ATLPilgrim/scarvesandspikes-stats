// Test endpoint to check player xgoals data structure from ASA API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const atlantaId = 'KAqBN0Vqbg';
    
    // Fetch player xgoals with split_by_games
    const response = await fetch(
      `https://app.americansocceranalysis.com/api/v1/mls/players/xgoals?team_id=${atlantaId}&season_name=2024&split_by_games=true`
    );
    const data = await response.json();
    
    // Return sample and field names
    res.status(200).json({
      totalRecords: data.length,
      fields: data[0] ? Object.keys(data[0]) : [],
      sample: data.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
