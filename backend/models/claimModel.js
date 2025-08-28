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

export const createClaim = async (claimData) => {
  const { lost_item_id, found_item_id, claimant_email, pickup_code } = claimData;
  
  const sql = `
    INSERT INTO claims (lost_item_id, found_item_id, claimant_email, pickup_code, status) 
    VALUES (?, ?, ?, ?, ?);
  `;
  
  const params = [lost_item_id, found_item_id, claimant_email, pickup_code, 'APPROVED'];
  
  try {
    await connection.execute(sql, params);
    console.log(`claimAgent: Successfully created claim for Found ID ${found_item_id}.`);
  } catch (error) {
    console.error("Error: Failed to create claim in db.", error);
    throw new Error("Err creating claim.");
  }
};