import Member from "../models/Member.model.js";
import Attendance from "../models/Attendance.model.js";
import Fee from "../models/Fee.model.js";
import { generateMemberId } from "../services/member.service.js";

export const getMembers = async (req, res, next) => {
  try {
    const { search, isActive, gender, page = 1, limit = 20 } = req.query;

    // Base filter without gender — used for tab counts
    const baseFilter = {};
    if (isActive !== undefined) baseFilter.isActive = isActive === "true";
    if (search) {
      baseFilter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { cnic: { $regex: search, $options: "i" } },
        { memberId: { $regex: search, $options: "i" } },
      ];
    }

    // Full filter with gender for paginated results
    const filter = { ...baseFilter };
    if (gender) filter.gender = gender;

    await Fee.updateMany(
      { status: "paid", dueDate: { $lt: new Date() } },
      { $set: { status: "overdue" } }
    );

    const [genderAgg, total, members] = await Promise.all([
      Member.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$gender", count: { $sum: 1 } } },
      ]),
      Member.countDocuments(filter),
      Member.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (Number(page) - 1) * Number(limit) },
        { $limit: Number(limit) },
        {
          $lookup: {
            from: "fees",
            let: { memberId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$member", "$$memberId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "latestFee",
          },
        },
        {
          $addFields: {
            feeStatus: {
              $cond: {
                if: { $eq: ["$feesAfterDiscount", 0] },
                then: "free",
                else: {
                  $cond: {
                    if: { $gt: [{ $size: "$latestFee" }, 0] },
                    then: { $arrayElemAt: ["$latestFee.status", 0] },
                    else: "never_paid",
                  }
                }
              }
            },
            lastPaid: { $arrayElemAt: ["$latestFee.paidDate", 0] },
            feeExpiry: { $arrayElemAt: ["$latestFee.dueDate", 0] },
          },
        },
        { $project: { latestFee: 0 } },
      ]),
    ]);

    const genderSummary = { all: 0, male: 0, female: 0, other: 0 };
    genderAgg.forEach(({ _id, count }) => {
      if (_id in genderSummary) genderSummary[_id] = count;
      genderSummary.all += count;
    });

    res.json({ success: true, total, page: Number(page), members, genderSummary });
  } catch (err) {
    next(err);
  }
};

export const getMember = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      const err = new Error("Member not found");
      err.statusCode = 404;
      return next(err);
    }
    res.json({ success: true, member });
  } catch (err) {
    next(err);
  }
};

export const getMemberProfile = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      const err = new Error("Member not found");
      err.statusCode = 404;
      return next(err);
    }

    const [attendanceRecords, feeRecords] = await Promise.all([
      Attendance.find({ member: req.params.id }).sort({ date: 1 }),
      Fee.find({ member: req.params.id }).sort({ dueDate: -1 }),
    ]);

    const joinedDate = new Date(member.createdAt);
    joinedDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingDates = new Set(
      attendanceRecords.map((r) => {
        const d = new Date(r.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );

    const allRecords = [...attendanceRecords];

    for (let d = new Date(joinedDate); d <= today; d.setDate(d.getDate() + 1)) {
      if (!existingDates.has(d.getTime())) {
        allRecords.push({
          status: "absent",
          date: new Date(d),
        });
      }
    }

    const totalPresent = allRecords.filter((r) => r.status === "present").length;
    const totalAbsent = allRecords.filter((r) => r.status === "absent").length;
    const totalDays = totalPresent + totalAbsent;
    const attendanceRate = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;

    const monthMap = {};
    allRecords.forEach((record) => {
      const d = new Date(record.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) {
        monthMap[key] = { year: d.getFullYear(), month: d.getMonth() + 1, present: 0, absent: 0 };
      }
      if (record.status === "present") monthMap[key].present++;
      else monthMap[key].absent++;
    });

    const monthlyAttendance = Object.values(monthMap)
      .map((m) => ({
        ...m,
        total: m.present + m.absent,
        rate: m.present + m.absent > 0 ? Math.round((m.present / (m.present + m.absent)) * 100) : 0,
      }))
      .sort((a, b) => b.year - a.year || b.month - a.month);

    const paidFees = feeRecords.filter((f) => f.status === "paid");
    const unpaidFees = feeRecords.filter((f) => f.status !== "paid");
    const totalPaid = paidFees.reduce((sum, f) => sum + f.amount, 0);
    const totalDue = unpaidFees.reduce((sum, f) => sum + f.amount, 0);

    res.json({
      success: true,
      member,
      stats: {
        totalPresent,
        totalAbsent,
        totalDays,
        attendanceRate,
        feePaidCount: paidFees.length,
        feeUnpaidCount: unpaidFees.length,
        totalFeePaid: totalPaid,
        totalFeeDue: totalDue,
      },
      monthlyAttendance,
      allRecords: allRecords.sort((a, b) => b.date - a.date),
      feeRecords,
    });
  } catch (err) {
    next(err);
  }
};

export const createMember = async (req, res, next) => {
  try {
    const { age, cnic } = req.body;

    if (Number(age) >= 18 && !cnic) {
      const err = new Error("CNIC is required for members aged 18 or above");
      err.statusCode = 400;
      return next(err);
    }

    const memberId = await generateMemberId();
    const member = await Member.create({ ...req.body, memberId });

    res.status(201).json({ success: true, member });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      err.message = `${field} already exists`;
      err.statusCode = 409;
    }
    next(err);
  }
};

export const updateMember = async (req, res, next) => {
  try {
    const { age, cnic } = req.body;

    if (Number(age) >= 18 && !cnic) {
      const err = new Error("CNIC is required for members aged 18 or above");
      err.statusCode = 400;
      return next(err);
    }

    const member = await Member.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!member) {
      const err = new Error("Member not found");
      err.statusCode = 404;
      return next(err);
    }
    res.json({ success: true, member });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      err.message = `${field} already exists`;
      err.statusCode = 409;
    }
    next(err);
  }
};

export const deleteMember = async (req, res, next) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) {
      const err = new Error("Member not found");
      err.statusCode = 404;
      return next(err);
    }
    res.json({ success: true, message: "Member deleted" });
  } catch (err) {
    next(err);
  }
};
