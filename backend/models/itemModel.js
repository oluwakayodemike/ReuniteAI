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
  const { status, description, university, location, latitude, longitude, item_date, embedding } = itemData;
  const embeddingData = JSON.stringify(embedding);

  const sql = `INSERT INTO items (status, description, university, location, latitude, longitude, item_date, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

  const params = [
    status, 
    description, 
    university, 
    location, 
    latitude, 
    longitude, 
    item_date, 
    embeddingData
  ];

  await connection.execute(sql, params);
};