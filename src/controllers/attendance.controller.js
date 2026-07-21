import Attendance from "../models/Attendance.model.js";
import Member from "../models/Member.model.js";

export const markAttendance = async (req, res, next) => {
  try {
    const { member, status, date } = req.body;

    const exists = await Member.findById(member);
    if (!exists) {
      const err = new Error("Member not found");
      err.statusCode = 404;
      return next(err);
    }

    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    const record = await Attendance.findOneAndUpdate(
      { member, date: attendanceDate },
      { status },
      { upsert: true, new: true, runValidators: true }
    ).populate("member", "fullName phone memberId");

    res.status(201).json({ success: true, attendance: record });
  } catch (err) {
    next(err);
  }
};

export const getAttendance = async (req, res, next) => {
  try {
    const { memberId, date, startDate, endDate, page = 1, limit = 500 } = req.query;

    const filter = {};
    if (memberId) filter.member = memberId;

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: d, $lte: end };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const total = await Attendance.countDocuments(filter);
    const records = await Attendance.find(filter)
      .populate("member", "fullName phone memberId")
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), records });
  } catch (err) {
    next(err);
  }
};

export const getMemberAttendance = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { member: req.params.memberId };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(filter).sort({ date: 1 });
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;

    res.json({ success: true, total: records.length, present, absent, records });
  } catch (err) {
    next(err);
  }
};
