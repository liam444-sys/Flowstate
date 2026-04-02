export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Geen tekst' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Je bent een ADHD-coach voor een jonge Belgische solopreneur. Analyseer zijn gedachtestroom zonder oordeel.

Gedachtestroom: "${text}"

Geef ALLEEN geldig JSON terug, zonder markdown of uitleg:
{
  "tasks": [
    {
      "text": "werkwoord + object, max 8 woorden",
      "energy": "high|medium|low",
      "urgencyScore": 3,
      "importanceScore": 4,
      "duration": 30,
      "breakdown": ["concrete stap 1", "concrete stap 2"]
    }
  ],
  "ideas": [
    {
      "text": "idee",
      "subcategory": "dynamisch label",
      "potential": "high|medium|low",
      "importance": "high|medium|low"
    }
  ],
  "worries": [{ "text": "zorg" }],
  "noise": [{ "text": "ruis" }]
}

Regels:
- urgencyScore: integer 1-5. 5 = moet vandaag/morgen. 3 = deze week. 1 = geen haast.
- importanceScore: integer 1-5. 5 = directe impact op doelen/inkomen. 1 = nice to have.
- Minimale waarde voor beide scores is altijd 1.
- TASKS: altijd werkwoord + object, max 8 woorden, uitvoerbaar en concreet.
- Abstracte of complexe taken (leren, onderzoeken, uitwerken, zoeken naar best practices): geef een breakdown van 3-5 concrete substappen van max 15 min elk.
- energy: high = schrijven/plannen/calls/denkwerk. low = lezen/organiseren/routine. medium = rest.
- duration in minuten: 15, 30, 45, 60, 90.
- IDEAS subcategory: bepaal dynamisch, specifiek (bv. "Startup idee", "Workflow optimalisatie", "Automatisering", "Content strategie", "Tool idee", "Business model").
- WORRIES: erkennen, nooit breakdown of actie.
- Max 5 items per categorie.
- Splits gecombineerde gedachten op.`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: 'AI fout' });

    const raw = data.content.map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    const norm = (arr, def) => (arr || []).map(i =>
      typeof i === 'string' ? { text: i, ...def } : { ...def, ...i }
    );

    return res.status(200).json({
      tasks: norm(parsed.tasks, { energy: 'medium', urgencyScore: 2, importanceScore: 2, duration: 30, breakdown: [] }),
      ideas: norm(parsed.ideas, { subcategory: 'Overig', potential: 'medium', importance: 'medium' }),
      worries: norm(parsed.worries, {}),
      noise: norm(parsed.noise, {})
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server fout', detail: e.message });
  }
}
