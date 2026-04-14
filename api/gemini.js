export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = "AIzaSyACLR7KxwlwhQZ5urDgvn-5STILAGZPbs8";

  try {
    const fetchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await fetchResponse.json();
    res.status(fetchResponse.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
