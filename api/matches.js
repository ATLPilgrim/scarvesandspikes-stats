export default async function handler(request, response) {
  try {
    // First get teams to find Atlanta's ID
    const teamsRes = await fetch('https://app.americansocceranalysis.com/api/v1/mls/teams', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ScarvesAndSpikes/1.0' }
    });
    const teams = await teamsRes.json();
    
    // Find Atlanta
    const atlanta = teams.find(t => 
      t.team_name?.toLowerCase().includes('atlanta') ||
      t.team_abbreviation?.toLowerCase() === 'atl'
    );
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    
    return response.status(200).json({
      total_teams: teams.length,
      sample_team: teams[0],
      atlanta: atlanta
    });
    
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
