export default async function handler(request, response) {
  try {
    const apiUrl = 'https://app.americansocceranalysis.com/api/v1/mls/games/xgoals?team_names=Atlanta%20United&season_name=2024';
    
    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }
    
    const data = await res.json();
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 's-maxage=3600');
    
    return response.status(200).json(data);
    
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
