import Fee from "../models/Fee.model.js";
import Member from "../models/Member.model.js";

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const markOverdueFees = () =>
  Fee.updateMany(
    { status: "paid", dueDate: { $lt: new Date() } },
    { $set: { status: "overdue" } }
  );

export const getFeesOverview = async (req, res, next) => {
  try {
    await markOverdueFees();

    const { status, search, page = 1, limit = 20 } = req.query;

    const matchStage = { isActive: true };
    if (search) {
      matchStage.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { memberId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const allMembers = await Member.aggregate([
      { $match: matchStage },
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
          latestFee: { $arrayElemAt: ["$feeArr", 0] },
          feeStatus: {
            $cond: {
              if: { $gt: [{ $size: "$feeArr" }, 0] },
              then: {
                $cond: {
                  if: {
                    $and: [
                      { $eq: [{ $arrayElemAt: ["$feeArr.status", 0] }, "paid"] },
                      { $gt: [{ $arrayElemAt: ["$feeArr.remaining", 0] }, 0] }
                    ]
                  },
                  then: "partial",
                  else: { $arrayElemAt: ["$feeArr.status", 0] }
                }
              },
              else: "never_paid",
            },
          },
        },
      },
      { $project: { feeArr: 0 } },
      { $sort: { fullName: 1 } },
    ]);

    const stats = {
      totalMembers: allMembers.length,
      paid: allMembers.filter((m) => m.feeStatus === "paid").length,
      partial: allMembers.filter((m) => m.feeStatus === "partial").length,
      overdue: allMembers.filter((m) => m.feeStatus === "overdue").length,
      neverPaid: allMembers.filter((m) => m.feeStatus === "never_paid").length,
    };

    let filtered = allMembers;
    if (status && status !== "all") {
      filtered = allMembers.filter((m) => m.feeStatus === status);
    }

    const total = filtered.length;
    const paginated = filtered.slice(
      (Number(page) - 1) * Number(limit),
      Number(page) * Number(limit)
    );

    res.json({ success: true, total, page: Number(page), stats, members: paginated });
  } catch (err) {
    next(err);
  }
};

export const collectFee = async (req, res, next) => {
  try {
    const { memberId, amount, method, note, paidDate } = req.body;

    if (!memberId) {
      const err = new Error("memberId is required");
      err.statusCode = 400;
      return next(err);
    }

    const member = await Member.findById(memberId);
    if (!member) {
      const err = new Error("Member not found");
      err.statusCode = 404;
      return next(err);
    }

    const latestFee = await Fee.findOne({ member: memberId }).sort({ createdAt: -1 });

    let fee;
    const paidAmount = Number(amount) || member.feesAfterDiscount;

    if (latestFee && latestFee.remaining > 0) {
      // Add to existing cycle dues
      latestFee.amount += paidAmount;
      latestFee.remaining = Math.max(0, latestFee.remaining - paidAmount);
      if (method) latestFee.method = method;
      if (note) {
        latestFee.note = latestFee.note ? `${latestFee.note} | ${note}` : note;
      }
      fee = await latestFee.save();
    } else {
      // Start a new cycle
      const remaining = Math.max(0, member.feesAfterDiscount - paidAmount);
      const feePaidDate = paidDate ? new Date(paidDate) : new Date();
      const dueDate = addDays(feePaidDate, 30);

      fee = await Fee.create({
        member: memberId,
        amount: paidAmount,
        remaining,
        paidDate: feePaidDate,
        dueDate,
        status: "paid",
        method,
        note,
      });
    }

    res.status(201).json({ success: true, fee });
  } catch (err) {
    next(err);
  }
};

export const getMemberFees = async (req, res, next) => {
  try {
    const fees = await Fee.find({ member: req.params.memberId }).sort({ createdAt: -1 });
    const totalPaid = fees.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
    const totalDue = fees.filter((f) => f.status !== "paid").reduce((s, f) => s + f.amount, 0);
    res.json({ success: true, totalDue, totalPaid, fees });
  } catch (err) {
    next(err);
  }
};

export const deleteFee = async (req, res, next) => {
  try {
    const fee = await Fee.findByIdAndDelete(req.params.id);
    if (!fee) {
      const err = new Error("Fee record not found");
      err.statusCode = 404;
      return next(err);
    }
    res.json({ success: true, message: "Fee record deleted" });
  } catch (err) {
    next(err);
  }
};
