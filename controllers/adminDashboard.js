// routes/admin.js
const express = require("express");
const router = express.Router();
const Marriage = require("../models/Marriage");
const Fatwa = require("../models/Fatwa");
const Reconciliation = require("../models/Reconciliation");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get all real-time data for admin dashboard
 * @access  Private (Admin only)
 */
router.get("/dashboard", protect, authorize("admin"), async (req, res) => {
  try {
    // Get counts and data from all models
    const [fatwas, marriages, reconciliations, shaykhs] = await Promise.all([
      Fatwa.find().populate(
        "user answeredBy assignedTo",
        "firstName lastName email"
      ),
      Marriage.find().populate(
        "user assignedShaykh",
        "firstName lastName email"
      ),
      Reconciliation.find().populate(
        "user assignedShaykh",
        "firstName lastName email"
      ),
      User.find({ role: "shaykh" }).select("-password"),
    ]);

    // Calculate fatwa stats
    const answeredFatwas = fatwas.filter(
      (f) => f.status === "answered" || f.status === "approved"
    ).length;

    const pendingFatwas = fatwas.filter(
      (f) => f.status === "pending" || f.status === "assigned"
    ).length;

    // Calculate marriage stats
    const certificateRequests = marriages.filter(
      (m) => m.type === "certificate"
    ).length;

    const reservationRequests = marriages.filter(
      (m) => m.type === "reservation"
    ).length;

    // Set the stats object
    const stats = {
      totalFatwas: fatwas.length,
      answeredFatwas,
      pendingFatwas,
      totalMarriages: marriages.length,
      certificateRequests,
      reservationRequests,
      totalReconciliations: reconciliations.length,
      totalShaykhs: shaykhs.length,
    };

    // Extract upcoming meetings
    const allMeetings = [];

    // Get meetings from reconciliations
    reconciliations.forEach((reconciliation) => {
      if (reconciliation.meetings && reconciliation.meetings.length > 0) {
        reconciliation.meetings.forEach((meeting) => {
          if (
            meeting.status === "scheduled" &&
            new Date(meeting.date) >= new Date()
          ) {
            allMeetings.push({
              id: meeting._id,
              type: "Family Reconciliation Meeting",
              client: `${reconciliation.husband?.firstName || ""} ${
                reconciliation.husband?.lastName || ""
              } Family`,
              caseId: `FR-${reconciliation._id.toString().substring(0, 8)}`,
              date: new Date(meeting.date),
              time: meeting.time,
              progress: { current: 2, total: 5 },
              location: meeting.location,
            });
          }
        });
      }
    });

    // Get meetings from marriages
    marriages.forEach((marriage) => {
      if (marriage.meetings && marriage.meetings.length > 0) {
        marriage.meetings.forEach((meeting) => {
          if (
            meeting.status === "scheduled" &&
            new Date(meeting.date) >= new Date()
          ) {
            const meetingType =
              marriage.type === "certificate"
                ? "Marriage Certificate Meeting"
                : "Nikah Meeting";
            const client = `${marriage.partnerOne?.firstName || ""} ${
              marriage.partnerOne?.lastName || ""
            } & ${marriage.partnerTwo?.firstName || ""} ${
              marriage.partnerTwo?.lastName || ""
            }`;

            allMeetings.push({
              id: meeting._id,
              type: meetingType,
              client: client,
              caseId: `${
                marriage.type === "certificate" ? "MQ" : "NK"
              }-${marriage._id.toString().substring(0, 8)}`,
              date: new Date(meeting.date),
              time: meeting.time,
              progress: {
                current: marriage.type === "certificate" ? 1 : 3,
                total: marriage.type === "certificate" ? 3 : 4,
              },
              location: meeting.location,
            });
          }
        });
      }
    });

    // Sort meetings by date and take only upcoming ones
    const upcomingMeetings = allMeetings
      .filter((meeting) => meeting.date >= new Date())
      .sort((a, b) => a.date - b.date)
      .slice(0, 5);

    // Calculate and set recent activities
    const activities = [];

    // Check for recent fatwas
    const recentFatwas = fatwas
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    recentFatwas.forEach((fatwa) => {
      activities.push({
        id: `fatwa-${fatwa._id}`,
        date: new Date(fatwa.createdAt),
        message: `New fatwa question submitted: "${
          fatwa.title || "Fatwa Question"
        }"`,
        type: "fatwa",
        user: fatwa.user,
      });
    });

    // Check for recent marriages
    const recentMarriages = marriages
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    recentMarriages.forEach((marriage) => {
      activities.push({
        id: `marriage-${marriage._id}`,
        date: new Date(marriage.createdAt),
        message: `New ${marriage.type} application submitted by ${
          marriage.partnerOne?.firstName || "Client"
        }.`,
        type: "marriage",
        user: marriage.user,
      });
    });

    // Check for recent reconciliations
    const recentReconciliations = reconciliations
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    recentReconciliations.forEach((reconciliation) => {
      activities.push({
        id: `reconciliation-${reconciliation._id}`,
        date: new Date(reconciliation.createdAt),
        message: `New family reconciliation request from ${
          reconciliation.husband?.firstName || ""
        } ${reconciliation.husband?.lastName || ""} family.`,
        type: "reconciliation",
        user: reconciliation.user,
      });
    });

    // Add system notifications
    if (pendingFatwas > 0) {
      activities.push({
        id: "pending-fatwa-count",
        date: new Date(),
        message: `You have ${pendingFatwas} pending fatwa applications. Please review these applications.`,
        type: "system",
      });
    }

    if (marriages.filter((m) => m.status === "pending").length > 0) {
      activities.push({
        id: "pending-marriage-count",
        date: new Date(),
        message: `You have ${
          marriages.filter((m) => m.status === "pending").length
        } pending marriage applications that need to be assigned.`,
        type: "system",
      });
    }

    // Sort all activities by date (newest first) and take the first 5
    const recentActivities = activities
      .sort((a, b) => b.date - a.date)
      .slice(0, 5);

    // Calculate activity distribution
    const marriageQueriesCount = marriages.filter(
      (m) => m.type === "certificate"
    ).length;
    const nikahsCount = marriages.filter(
      (m) => m.type === "reservation"
    ).length;
    const familyCounselingCount = reconciliations.length;
    const fatwaQueriesCount = fatwas.length;

    const total =
      marriageQueriesCount +
      nikahsCount +
      familyCounselingCount +
      fatwaQueriesCount;

    let activityDistribution;

    if (total > 0) {
      activityDistribution = [
        {
          name: "Marriage Queries",
          value: Math.round((marriageQueriesCount / total) * 100) || 35,
        },
        {
          name: "Nikahs",
          value: Math.round((nikahsCount / total) * 100) || 25,
        },
        {
          name: "Family Counseling",
          value: Math.round((familyCounselingCount / total) * 100) || 20,
        },
        {
          name: "Fatwa Queries",
          value: Math.round((fatwaQueriesCount / total) * 100) || 15,
        },
      ];
    } else {
      // Fallback values if no data is available
    }

    // Calculate monthly stats for charts
    const now = new Date();
    const currentMonth = now.getMonth();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const last3Months = [];
    for (let i = 2; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      last3Months.push(monthNames[monthIndex]);
    }

    const monthlyData = last3Months.map((month) => {
      const monthIndex = monthNames.indexOf(month);

      // Count marriage queries for this month
      const marriageQueries = marriages.filter((m) => {
        const date = new Date(m.createdAt);
        return date.getMonth() === monthIndex && m.type === "certificate";
      }).length;

      // Count nikahs for this month
      const nikahs = marriages.filter((m) => {
        const date = new Date(m.createdAt);
        return date.getMonth() === monthIndex && m.type === "reservation";
      }).length;

      // Count family counseling for this month
      const familyCounseling = reconciliations.filter((r) => {
        const date = new Date(r.createdAt);
        return date.getMonth() === monthIndex;
      }).length;

      // Use real data if available, otherwise provide realistic sample data
      return {
        name: month,
        MarriageQueries: marriageQueries,
        Nikahs: nikahs,
        FamilyCounseling: familyCounseling,
      };
    });

    // Get shaykh workload data
    const shaykhWorkload = shaykhs.map((shaykh) => {
      const assignedMarriages = marriages.filter(
        (m) =>
          m.assignedShaykh &&
          m.assignedShaykh.toString() === shaykh._id.toString()
      ).length;

      const assignedReconciliations = reconciliations.filter(
        (r) =>
          r.assignedShaykhs && // Changed from assignedShaykh
          r.assignedShaykhs.includes(shaykh._id.toString()) // Changed to array check
      ).length;

      const assignedFatwas = fatwas.filter(
        (f) => f.assignedTo && f.assignedTo.toString() === shaykh._id.toString()
      ).length;

      return {
        id: shaykh._id,
        name: `${shaykh.firstName} ${shaykh.lastName}`,
        email: shaykh.email,
        phoneNumber: shaykh.phoneNumber,
        location: shaykh.address,
        assignedCases:
          assignedMarriages + assignedReconciliations + assignedFatwas,
        experience: shaykh.yearsOfExperience || "N/A",
        education: shaykh.educationalInstitution || "N/A",
      };
    });

    // Return complete dashboard data
    return res.status(200).json({
      success: true,
      data: {
        stats,
        upcomingMeetings,
        availableShaykhs: shaykhWorkload,
        recentActivities,
        activityDistribution,
        monthlyStats: monthlyData,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({
      success: false,
      error: "Server Error",
      message: "Failed to fetch dashboard data",
    });
  }
});

module.exports = router;
