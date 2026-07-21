import Member from "../models/Member.model.js";

export const generateMemberId = async () => {
  const members = await Member.find({}, { memberId: 1 });

  if (!members.length) return "A-01";

  const nums = members
    .map((m) => parseInt(m.memberId.replace(/^A-/, ""), 10))
    .filter((n) => !isNaN(n));

  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `A-${String(next).padStart(2, "0")}`;
};
