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
  try {
    const {
      lost_item_id,
      found_item_id,
      claimant_email,
      pickup_code,
      status = 'PENDING'
    } = claimData;

    const sql = `
      INSERT INTO claims (lost_item_id, found_item_id, claimant_email, pickup_code, status, created_at)
      VALUES (?, ?, ?, ?, ?, NOW());
    `;

    const params = [lost_item_id, found_item_id, claimant_email, pickup_code, status];

    await connection.execute(sql, params);
    console.log(`claimAgent: Created claim (status=${status}) for Found ID ${found_item_id}`);

    const [{ id }] = await connection.execute("SELECT LAST_INSERT_ID() AS id;");
    const [newClaim] = await connection.execute("SELECT * FROM claims WHERE id = ?;", [id]);

    return newClaim;
  } catch (error) {
    console.error("Error: Failed to create claim in db.", error);
    throw error;
  }
};

export const approveClaimTransaction = async ({ lost_item_id, found_item_id, claimant_email, pickup_code }) => {
  try {
    if (!lost_item_id || !found_item_id) {
      throw new Error("lost_item_id and found_item_id are required");
    }

    const [foundRow] = await connection.execute("SELECT * FROM items WHERE id = ? LIMIT 1;", [found_item_id]);
    if (!foundRow) {
      throw new Error(`found item with id ${found_item_id} not found`);
    }

    const [lostRow] = await connection.execute("SELECT * FROM items WHERE id = ? LIMIT 1;", [lost_item_id]);
    if (!lostRow) {
      throw new Error(`lost item with id ${lost_item_id} not found`);
    }

    // prevent double-claiming
    if (String(foundRow.status).toLowerCase() === 'claimed') {
      throw new Error("Found item is already claimed");
    }

    const insertSql = `
      INSERT INTO claims (lost_item_id, found_item_id, claimant_email, pickup_code, status, created_at)
      VALUES (?, ?, ?, ?, 'APPROVED', NOW());
    `;
    const insertParams = [lost_item_id, found_item_id, claimant_email, pickup_code];
    await connection.execute(insertSql, insertParams);

    const [{ id: claimId }] = await connection.execute("SELECT LAST_INSERT_ID() AS id;");
    const [newClaim] = await connection.execute("SELECT * FROM claims WHERE id = ?;", [claimId]);

    await connection.execute("UPDATE items SET status = 'claimed' WHERE id = ?;", [found_item_id]);
    console.log(`ClaimAgent: updated found item ${found_item_id} -> claimed`);

    await connection.execute("UPDATE items SET status = 'reunited' WHERE id = ?;", [lost_item_id]);
    console.log(`ClaimAgent: updated lost item ${lost_item_id} -> reunited`);

    const [updatedFound] = await connection.execute("SELECT * FROM items WHERE id = ?;", [found_item_id]);
    const [updatedLost] = await connection.execute("SELECT * FROM items WHERE id = ?;", [lost_item_id]);

    return {
      claim: newClaim,
      found: updatedFound,
      lost: updatedLost,
    };
  } catch (err) {
    console.error("approveClaimTransaction error:", err);
    throw err;
  }
};
