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
        WHEN status = 'claimed' THEN 'Claim Approved'
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

export const getUserLostReports = async (userId) => {
  const sql = `
    SELECT 
      id AS report_id,
      description AS item_description,
      item_date AS date_reported,
      status,
      image_url,
      CASE 
        WHEN status = 'lost' THEN 'Searching'
        WHEN status = 'reunited' THEN 'Reunited'
        ELSE 'Unknown'
      END AS display_status,
      CASE 
        WHEN status = 'lost' THEN 'searching'
        WHEN status = 'reunited' THEN 'resolved'
        ELSE 'unknown'
      END AS status_class
    FROM items
    WHERE user_id = ? 
      AND status IN ('lost','reunited')
    ORDER BY item_date DESC;
  `;

  const reports = await connection.execute(sql, [userId]);
  return reports;
};

export const getUserFoundReports = async (userId) => {
  const sql = `
    SELECT
      id AS report_id,
      description AS item_description,
      item_date AS date_found,
      status,
      image_url,
      CASE
        WHEN status = 'found' THEN 'Awaiting Owner'
        WHEN status = 'claimed' THEN 'Claim Pending'
        WHEN status = 'returned' THEN 'Returned'
        ELSE 'Unknown'
      END AS display_status,
      CASE
        WHEN status = 'found' THEN 'searching'
        WHEN status = 'claimed' THEN 'pending'
        WHEN status = 'returned' THEN 'resolved'
        ELSE 'unknown'
      END AS status_class
    FROM items
    WHERE user_id = ? AND status IN ('found','claimed','returned')
    ORDER BY item_date DESC;
  `;

  const reports = await connection.execute(sql, [userId]);
  return reports;
};
