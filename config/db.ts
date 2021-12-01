import mongoose, { ConnectOptions } from "mongoose";

const connectDB = async () => {
  const DB_URI = process.env.MONGO_URI;
  if (!DB_URI) {
    console.log("DB_URI is not available.");
    return;
  }
  try {
    await mongoose.connect(DB_URI, () => console.log("DB Connected"));
  } catch (error) {
    const { message } = error as Error;
    console.log("Connection Error ", message);
  }

  const connection = mongoose.connection;
  if (connection.readyState >= 1) {
    console.log("Connected to database");
    return;
  }
  connection.on("error", () => console.log("Connection Failed"));
};

export default connectDB;
