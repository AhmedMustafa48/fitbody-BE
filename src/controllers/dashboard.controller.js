import Member from "../models/Member.model.js";
import Attendance from "../models/Attendance.model.js";
import Fee from "../models/Fee.model.js";

export const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();

    // Use local calendar date (same as attendance controller's setHours approach)
    // so records stored at local midnight are always inside the range
    const todayStart = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0
    );
    const todayEnd = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999
    );

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    await Fee.updateMany(
      { status: "paid", dueDate: { $lt: now } },
      { $set: { status: "overdue" } }
    );

    const [
      totalMembers,
      newThisMonth,
      attendanceStats,
      feeStats,
      revenueResult,
      recentCheckIns,
    ] = await Promise.all([
      Member.countDocuments(),

      Member.countDocuments({ joinDate: { $gte: monthStart } }),

      // Join active members → today's attendance to get exact present/absent counts
      // that mirror the attendance page logic (absent = not marked present)
      Member.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: "attendances",
            let: { memberId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$member", "$$memberId"] },
                      { $gte: ["$date", todayStart] },
                      { $lte: ["$date", todayEnd] },
                    ],
                  },
                },
              },
            ],
            as: "todayRecord",
          },
        },
        {
          $addFields: {
            todayStatus: { $arrayElemAt: ["$todayRecord.status", 0] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$todayStatus", "present"] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $ne: ["$todayStatus", "present"] }, 1, 0] },
            },
          },
        },
      ]),

      Member.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: "fees",
            let: { memberId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$member", "$$memberId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "feeArr",
          },
        },
        {
          $addFields: {
            feeStatus: {
              $cond: {
                if: { $gt: [{ $size: "$feeArr" }, 0] },
                then: { $arrayElemAt: ["$feeArr.status", 0] },
                else: "never_paid",
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            paid: { $sum: { $cond: [{ $eq: ["$feeStatus", "paid"] }, 1, 0] } },
            overdue: { $sum: { $cond: [{ $eq: ["$feeStatus", "overdue"] }, 1, 0] } },
            neverPaid: { $sum: { $cond: [{ $eq: ["$feeStatus", "never_paid"] }, 1, 0] } },
          },
        },
      ]),

      Fee.aggregate([
        { $match: { status: "paid", paidDate: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Attendance.find({
        date: { $gte: todayStart, $lte: todayEnd },
        status: "present",
      })
        .populate("member", "fullName memberId phone")
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const att = attendanceStats[0] ?? { total: 0, present: 0, absent: 0 };
    const fees = feeStats[0] ?? { paid: 0, overdue: 0, neverPaid: 0 };

    res.json({
      success: true,
      stats: {
        totalMembers,
        activeMembers: att.total,
        newThisMonth,
        todayPresent: att.present,
        todayAbsent: att.absent,
        feePaid: fees.paid,
        feeOverdue: fees.overdue,
        feeNeverPaid: fees.neverPaid,
        monthRevenue: revenueResult[0]?.total ?? 0,
      },
      recentCheckIns,
    });
  } catch (err) {
    next(err);
  }
};
