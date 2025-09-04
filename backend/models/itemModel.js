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
    INSERT INTO notifications (user_id, message, lost_item_id, found_item_id)
    VALUES (?, ?, ?, ?);
  `;
  await connection.execute(sql, [user_id, message, lost_item_id, found_item_id]);
  console.log(`notification created for user ${user_id} regarding lost ID ${lost_item_id}`);
};

export const getUserNotifications = async (userId) => {
  const sql = `
    SELECT id, message, is_read, created_at, lost_item_id, found_item_id
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20;
  `;
  
  try {
    const notifications = await connection.execute(sql, [userId]);
    return notifications;
  } catch (error) {
    console.error("Error fetching notifications from DB:", error);
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

export const getUserItems = async (userId, limit = 5) => {
  const sql = `
    SELECT 
      id, 
      status, 
      description, 
      item_date, 
      image_url,
      CASE 
        WHEN status = 'lost' THEN 'Searching'
        WHEN status = 'found' THEN 'Found'
        WHEN status = 'claimed' THEN 'Claim Pending'
        WHEN status = 'reunited' THEN 'Reunited'
        ELSE 'Unknown'
      END AS display_status,
      CASE 
        WHEN status = 'lost' THEN 'searching'
        WHEN status = 'found' THEN 'matches'
        WHEN status = 'claimed' THEN 'pending'
        WHEN status = 'reunited' THEN 'resolved'
        ELSE ''
      END AS status_class
    FROM items
    WHERE user_id = ?
    ORDER BY item_date DESC
    LIMIT ?;
  `;
  const items = await connection.execute(sql, [userId, limit]);
  return items;
};

export const countUserStats = async (userId) => {
  try {
    const sql = `
      SELECT 
        COUNT(CASE WHEN i.status IN ('lost', 'found') THEN 1 END) AS active_reports,
        (
          (SELECT COUNT(DISTINCT c.lost_item_id)
           FROM claims c
           JOIN items li ON c.lost_item_id = li.id
           WHERE li.user_id = ? AND c.status = 'PENDING')
          +
          (SELECT COUNT(DISTINCT c.found_item_id)
           FROM claims c
           JOIN items fi ON c.found_item_id = fi.id
           WHERE fi.user_id = ? AND c.status = 'PENDING')
        ) AS items_with_matches,
        COUNT(CASE WHEN i.status IN ('claimed','reunited') THEN 1 END) AS items_resolved
      FROM items i
      WHERE i.user_id = ?;
    `;

    const [stats] = await connection.execute(sql, [userId, userId, userId]);
    return stats;
  } catch (error) {
    console.error("Error counting user stats:", error);
    throw error;
  }
};
export const getRecentActivity = async (userId, limit = 3) => {
  const sql = `
    SELECT 
      message AS details,
      created_at,
      CASE 
        WHEN message LIKE '%match%' OR message LIKE '%potential match%' THEN 'matches'
        WHEN message LIKE '%filed%' OR message LIKE '%reported%' THEN 'filed'
        WHEN message LIKE '%claim%' OR message LIKE '%pending%' THEN 'claim'
        WHEN message LIKE '%reunited%' OR message LIKE '%pickup code%' THEN 'reunited'
        ELSE ''
      END AS activity_class,
      CASE 
        WHEN message LIKE '%match%' OR message LIKE '%potential match%' THEN 'fa-solid fa-link'
        WHEN message LIKE '%filed%' OR message LIKE '%reported%' THEN 'fa-solid fa-check'
        WHEN message LIKE '%claim%' OR message LIKE '%pending review%' THEN 'fa-solid fa-user-check'
        WHEN message LIKE '%reunited%' OR message LIKE '%pickup code%' THEN 'fa-solid fa-handshake'
        ELSE 'fa-solid fa-bell'
      END AS icon
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?;
  `;
  const activity = await connection.execute(sql, [userId, limit]);
  return activity.map(item => ({
    ...item,
    time_ago: calculateTimeAgo(item.created_at)
  }));
};

function calculateTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}