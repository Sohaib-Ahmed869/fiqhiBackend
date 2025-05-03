const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const routes = require("./routes/index");
const fileUpload = require("express-fileupload");
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
// Load env vars
require('dotenv').config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(
  cors({
    origin: "https://fiqhi-fe.vercel.app",
    credentials: true,
  })
);

app.use(
  fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
    useTempFiles: false, // We'll use memory for direct upload to S3
    abortOnLimit: true, // Returns 413 if limit is reached
    safeFileNames: true, // Removes special characters from file names
    preserveExtension: true, // Keeps file extension
  })
);

// Dev logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Mount routes
app.use(routes);

// Error handler middleware
app.use(errorHandler);

app.get('/test-s3', async (req, res) => {
  try {
    // Create a new client for testing
    const testClient = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    // Try to list buckets (requires minimal permissions)
    const command = new ListBucketsCommand({});
    const response = await testClient.send(command);
    
    res.json({
      success: true, 
      buckets: response.Buckets?.map(b => b.Name) || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});
const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
