import { connect } from '@tidbcloud/serverless';
import fetch from 'node-fetch';
import https from 'https';

const SIMILARITY_THRESHOLD = 0.20;

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const connection = connect({
  url: process.env.TIDB_CONNECTION_URL,
  fetch: (url, init) => fetch(url, { ...init, agent }),
});

export const createItem = async (itemData) => {
  try {
    const { user_id, status, description, university, location, latitude, longitude, item_date, embedding, image_url, verification_question, verification_answer } = itemData;

    const lat = latitude || null;
    const lgt = longitude || null;
    const embeddingData = JSON.stringify(embedding);

    const sql = `INSERT INTO items ( user_id, status, description, university, location, latitude, longitude, item_date, embedding, image_url, verification_question, verification_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

    const params = [
      user_id,
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

    const [{ id }] = await connection.execute("SELECT LAST_INSERT_ID() AS id;");

    const [newItem] = await connection.execute("SELECT * FROM items WHERE id = ?;", [id]);
  return newItem;
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

export const findSimilarLostItems = async (embedding, description, cleanUpDesc) => {
  const cleanedDescription = cleanUpDesc(description);
  if (!cleanedDescription) {
    console.log("No description provided for FTS; skipping pre-filter.");
    return [];
  }

  const ftsQuery = cleanedDescription.split(/\s+/).map(word => `+${word}`).join(' ');

  const textSearchQuery = `
    SELECT id, user_id
    FROM items
    WHERE status = 'lost' AND fts_match_word(?, description);
  `;

  const textMatches = await connection.execute(textSearchQuery, [ftsQuery]);

  if (!textMatches || textMatches.length === 0) {
    console.log("No text matches found for lost items.");
    return [];
  }
  const candidateIDs = textMatches.map(row => row.id);
  console.log(`fts matching lost IDs: [${candidateIDs.join(', ')}]`);

  const placeholders = candidateIDs.map(() => '?').join(',');
  const vectorSearchQuery = `
    SELECT
      id,
      user_id,
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

  const vectorMatches = await connection.execute(vectorSearchQuery, [JSON.stringify(embedding), ...candidateIDs]);

  const rankedMatches = vectorMatches.filter(item => item.distance < SIMILARITY_THRESHOLD);
  return rankedMatches;
};

export const createNotification = async ({ user_id, message, lost_item_id, found_item_id }) => {
  const sql = `
    INSERT INTO notifications (user_id, message, lost_item_id, found_item_id, created_at)
    VALUES (?, ?, ?, ?, UTC_TIMESTAMP());
  `;
  await connection.execute(sql, [user_id, message, lost_item_id, found_item_id]);
  console.log(`notification created for user ${user_id} regarding lost ID ${lost_item_id}`);
};

export const batchCreateNotifications = async (notifications) => {
  if (!notifications || notifications.length === 0) {
    return;
  }

  try {
    const placeholders = notifications.map(() => '(?, ?, ?, ?, UTC_TIMESTAMP())').join(', ');
    const sql = `
      INSERT INTO notifications (user_id, message, lost_item_id, found_item_id, created_at)
      VALUES ${placeholders};
    `;

    const flatValues = notifications.flatMap(n => [
      n.user_id, n.message, n.lost_item_id, n.found_item_id
    ]);

    await connection.execute(sql, flatValues);

    console.log(`Successfully batch-inserted ${notifications.length} notifications.`);
  } catch (error) {
    console.error("Error in batchCreateNotifications:", error);
    throw error;
  }
};

export const getUserNotifications = async (userId, limit = 20, offset = 0, isReadFilter = undefined) => {
  let sql = `
    SELECT id, message, is_read, created_at, lost_item_id, found_item_id
    FROM notifications
    WHERE user_id = ?
  `;
  const params = [userId];

  if (isReadFilter !== undefined) {
    sql += ' AND is_read = ?';
    params.push(isReadFilter);
  }

  sql += `
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?;
  `;
  params.push(limit, offset);

  try {
    const notifications = await connection.execute(sql, params);

    return notifications.map(n => ({
      ...n,
      created_at_iso: n.created_at ? new Date(n.created_at).toISOString() : null
    }));
  } catch (error) {
    console.error("Error fetching notifications from DB:", error);
    throw error;
  }
};

export const getNotificationCount = async (userId, isReadFilter = undefined) => {
  let sql = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?';
  const params = [userId];

  if (isReadFilter !== undefined) {
    sql += ' AND is_read = ?';
    params.push(isReadFilter);
  }

  try {
    const [{ count }] = await connection.execute(sql, params);
    return count;
  } catch (error) {
    console.error("Error counting notifications:", error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId, userId) => {
  const sql = 'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?';
  try {
    const result = await connection.execute(sql, [notificationId, userId]);
    if (result.affectedRows === 0) {
      throw new Error('Notification not found or not owned by user');
    }
    console.log(`Notification ${notificationId} marked as read for user ${userId}.`);
    return result;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId) => {
  const sql = 'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0';
  try {
    const result = await connection.execute(sql, [userId]);
    console.log(`Marked ${result.affectedRows} notifications as read for user ${userId}.`);
    return result;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const getItemById = async (itemId) => {
  const sql = "SELECT * FROM items WHERE id = ?";
  try {
    const rows = await connection.execute(sql, [itemId]);
    console.log("TiDB result:", rows);
    
    if (!rows || rows.length === 0) {
      console.warn(`No item found with id: ${itemId}`);
      return null;
    }
    return rows[0];
  } catch (error) {
    console.error(`Error fetching item with id ${itemId}:`, error);
    throw new Error("Failed to fetch item from database");
  }
};

export const updateItemStatusToClaimed = async (found_item_id) => {
    const sql = "UPDATE items SET status = 'claimed' WHERE id = ?;";
    try {
        await connection.execute(sql, [found_item_id]);
        console.log(`ClaimAgent: Updated item ${found_item_id} status to 'claimed'.`);
    } catch (error) {
        console.error(`ClaimAgent Error: Failed to update item status for ID ${found_item_id}.`, error);
        throw new Error("Failed to update item status.");
    }
};