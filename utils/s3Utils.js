// utils/s3Utils.js
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Delete a file from S3
 * @param {string} key - The S3 key (path to file)
 * @returns {Promise<boolean>} - Success status
 */
const deleteFileFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error(`Error deleting file ${key} from S3:`, error);
    return false;
  }
};

/**
 * Handle S3 errors with appropriate logging and response
 * @param {Error} error - The error object
 * @param {Response} res - Express response object
 * @returns {Response} - Express response
 */
const handleS3Error = (error, res) => {
  console.error("S3 Operation Error:", error);

  // Check for specific AWS errors
  if (error.name === "NoSuchKey") {
    return res.status(404).json({
      success: false,
      error: "The requested file does not exist",
    });
  }

  if (error.name === "AccessDenied") {
    return res.status(403).json({
      success: false,
      error: "Access denied to the requested resource",
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    error: "An error occurred with the storage service",
  });
};

module.exports = {
  s3Client,
  deleteFileFromS3,
  handleS3Error,
};
