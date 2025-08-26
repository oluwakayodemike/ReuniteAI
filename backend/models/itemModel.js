import { connect } from '@tidbcloud/serverless';
import fetch from 'node-fetch';
import https from 'https';

const SIMILARITY_THRESHOLD = 0.25;

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const connection = connect({
  url: process.env.TIDB_CONNECTION_URL,
  fetch: (url, init) => fetch(url, { ...init, agent }),
});

export const createItem = async (itemData) => {
  try {
    const { status, description, university, location, latitude, longitude, item_date, embedding, image_url, verification_question, verification_answer } = itemData;

    const lat = latitude || null;
    const lgt = longitude || null;
    const embeddingData = JSON.stringify(embedding);

    const sql = `INSERT INTO items (status, description, university, location, latitude, longitude, item_date, embedding, image_url, verification_question, verification_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

    const params = [
      status, 
      description, 
      university, 
      location, 
      lat, 
      lgt, 
      item_date, 
      embeddingData,
      image_url,
      verification_question || null, 
      verification_answer || null
    ];

    await connection.execute(sql, params);
    console.log("item saved succesfully");
  } catch (err) {
    console.log("Error inserting data to TiDB")
    throw err;
  }
};

// similarity search logic:
export const findSimilarItems = async (embedding, description) => {
  const embeddingData = JSON.stringify(embedding);

  const textSearchQuery = `
    SELECT id 
    FROM items 
    WHERE status = 'found' AND fts_match_word(?, description);
  `;

  const textMatches = await connection.execute(textSearchQuery, [description]);

  if (!textMatches || textMatches.length === 0) {
    console.log("No text matches found.");
    return [];
  }
  const candidateIDs = textMatches.map(row => row.id);
  console.log(`fts matching IDs: [${candidateIDs.join(', ')}]`);

  // run vector search ONLY on the pre-filtered candidate IDs
  const placeholders = candidateIDs.map(() => '?').join(',');
  const vectorSearchQuery = `
    SELECT
      id,
      description,
      location,
      item_date,
      image_url,
      vec_cosine_distance(embedding, ?) AS distance
    FROM items
    WHERE id IN (${placeholders})
    ORDER BY distance
    LIMIT 5;
  `;

  const vectorMatches = await connection.execute(vectorSearchQuery, [embeddingData, ...candidateIDs]);

  // filtering final results by similarity threshold
  const rankedMatches = vectorMatches
    .filter(item => item.distance < SIMILARITY_THRESHOLD);

  return rankedMatches;
};