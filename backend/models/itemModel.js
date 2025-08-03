import { connect } from '@tidbcloud/serverless';
import fetch from 'node-fetch';
import https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const connection = connect({
  url: process.env.TIDB_CONNECTION_URL,
  fetch: (url, init) => fetch(url, { ...init, agent }),
});

export const createItem = async (itemData) => {
  try {
    const { status, description, university, location, latitude, longitude, item_date, embedding } = itemData;

    const lat = latitude || null;
    const lgt = longitude || null;
    const embeddingData = JSON.stringify(embedding);

    const sql = `INSERT INTO items (status, description, university, location, latitude, longitude, item_date, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

    const params = [
      status, 
      description, 
      university, 
      location, 
      lat, 
      lgt, 
      item_date, 
      embeddingData
    ];

    await connection.execute(sql, params);
    console.log("item saved succesfully");
  } catch (err) {
    console.log("Error inserting data to TiDB")
    throw err;
  }
};

// similarity search logic:
export const findSimilarItems = async (embedding) => {
  const embeddingData = JSON.stringify(embedding);

  const sql = "SELECT id, description, location, item_date, vec_cosine_distance(embedding, ?) AS distance FROM items WHERE status = 'found' ORDER BY distance LIMIT 5;";

  const results = await connection.execute(sql, [embeddingData]);
  
  return results || [];
};
