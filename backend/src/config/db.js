import mongoose from "mongoose";

export const connectdb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB_URI);
    console.log("DB SUCCESSFULLY CONNECTED");
  } catch (error) {
    console.log("ERROR IN CONNECTING TO DB", error);
    process.exit(1);
  }
};
