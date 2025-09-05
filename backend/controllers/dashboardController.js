import { getUserItems, countUserStats, getRecentActivity, getUserLostReports  } from "../models/dashboardModel.js";


export const getDashboardData = async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const stats = await countUserStats(userId);
    const recentReports = await getUserItems(userId, 5);
    const recentActivity = await getRecentActivity(userId, 3);

    res.status(200).json({
      stats,
      recentReports,
      recentActivity
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error.message);
    res.status(500).json({ message: "Error fetching dashboard data." });
  }
};

export const getLostReports = async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const reports = await getUserLostReports(userId);

    res.status(200).json({ reports });
  } catch (error) {
    console.error("Error fetching lost reports:", error.message);
    res.status(500).json({ message: "Error fetching lost reports." });
  }
};