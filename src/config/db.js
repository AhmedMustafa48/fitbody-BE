import mongoose from "mongoose";

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
  
  try {
    const db = mongoose.connection.db;
    const collection = db.collection("members");
    await collection.dropIndex("phone_1");
    console.log("Successfully dropped phone_1 index from members collection");
  } catch (err) {
    if (err.code !== 27) { // 27 is IndexNotFound
      console.log("Note: phone_1 index not dropped (might not exist)");
    }
  }
};

export default connectDB;
