// Test endpoint to check basic players data structure from ASA API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Fetch all players (to see what metadata is available)
    const response = await fetch(
      `https://app.americansocceranalysis.com/api/v1/mls/players`
    );
    const data = await response.json();
    
    // Filter for a few Atlanta players we know
    const atlantaPlayers = data.filter(p => 
      p.player_name && (
        p.player_name.includes('Martinez') || 
        p.player_name.includes('Almada') ||
        p.player_name.includes('Lennon')
      )
    );
    
    // Return sample and field names
    res.status(200).json({
      totalPlayers: data.length,
      fields: data[0] ? Object.keys(data[0]) : [],
      sampleAtlantaPlayers: atlantaPlayers.slice(0, 10),
      genericSample: data.slice(0, 3)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
