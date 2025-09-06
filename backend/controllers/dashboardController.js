import { getUserItems, countUserStats, getRecentActivity, getUserLostReports, getUserFoundReports } from "../models/dashboardModel.js";


export const getDashboardData = async (req, res) => {
  try {
    const { userId } = req.auth;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated." });
    }
    
    const [stats, recentReports, recentActivity] = await Promise.all([
      countUserStats(userId),
      getUserItems(userId, 5),
      getRecentActivity(userId, 3),
    ]);

    res.status(200).json({
      stats,
      recentReports,
      recentActivity,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error.message);
    res.status(500).json({ message: "Error fetching dashboard data." });
  }
};

const getReportsController = (fetchReportsService, reportType) => {
  return async (req, res) => {
    try {
      const { userId } = req.auth;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated." });
      }
      
      const reports = await fetchReportsService(userId);

      res.status(200).json({ reports });
    } catch (error) {
      const errorMessage = `Error fetching ${reportType} reports.`;
      console.error(`${errorMessage}:`, error.message);
      res.status(500).json({ message: errorMessage });
    }
  };
};

export const getLostReports = getReportsController(getUserLostReports, "lost");
export const getFoundReports = getReportsController(getUserFoundReports, "found");