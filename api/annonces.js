export default async function handler(req, res) {
  // Autoriser les requêtes depuis n'importe quelle origine (pour Notion embed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID  = process.env.NOTION_DATABASE_ID;

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 100 }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message });
    }

    // Transformer les données Notion en format simplifié
    const annonces = data.results.map(page => {
      const p = page.properties;
      const get = (name, type) => {
        const prop = p[name];
        if (!prop) return null;
        switch (type) {
          case 'number':    return prop.number ?? null;
          case 'title':     return prop.title?.map(t => t.plain_text).join('') || '';
          case 'rich_text': return prop.rich_text?.map(t => t.plain_text).join('') || '';
          case 'select':    return prop.select?.name || null;
          case 'url':       return prop.url || null;
        }
      };

      const prix        = get('Prix', 'number') || 0;
      const loyer       = get('Loyer estimé', 'number') || 0;
      const travaux     = get('Travaux estimés', 'number') || 0;
      const chargesCopro= get('Charges copro', 'number') || 0;
      const taxeFonciere= get('Taxe foncière', 'number') || 0;

      return {
        id:          page.id,
        titre:       get('Titre', 'title') || 'Sans titre',
        prix,
        loyer,
        travaux,
        chargesCopro,
        taxeFonciere,
        secteur:     get('Secteur', 'select') || '',
        dpe:         get('DPE', 'select') || '?',
        ville:       get('Ville', 'rich_text') || '',
        statut:      get('Statut', 'select') || '',
        lien:        get('Lien', 'url') || '',
        commentaires:get('Commentaires', 'rich_text') || '',
        surface:     get('Surface', 'number') || 0,
        rentaBrute:  prix > 0 ? (loyer * 12 / prix * 100) : 0,
      };
    });

    res.status(200).json(annonces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
