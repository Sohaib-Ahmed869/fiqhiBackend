// config/s3.js
const path = require("path");
const multer = require("multer");
const {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3-v3");
require("../config/env");

// Debug logging for environment variables
console.log("S3 Config - Environment Variables:");
console.log("AWS_REGION:", process.env.AWS_REGION);
console.log("AWS_S3_BUCKET_NAME:", process.env.AWS_S3_BUCKET_NAME);
console.log("AWS_ACCESS_KEY_ID exists:", !!process.env.AWS_ACCESS_KEY_ID);
console.log(
  "AWS_SECRET_ACCESS_KEY exists:",
  !!process.env.AWS_SECRET_ACCESS_KEY
);

// Set default bucket name if environment variable is not available
const BUCKET_NAME =
  process.env.AWS_S3_BUCKET_NAME || "fiqhi-marriage-certificates";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configure multer for S3 uploads
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET_NAME, // Use the constant instead of directly accessing env variable
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, "events/" + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/ | pdf;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  },
});

// Helper function to delete objects from S3
const deleteS3Object = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
};

// Add a specific upload config for marriage certificates
const certificateUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET_NAME,
    key: function (req, file, cb) {
      const marriageId = req.params.id || "unknown";
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        `certificates/${marriageId}-${uniqueSuffix}${path.extname(
          file.originalname
        )}`
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error(`Only image and PDF files are allowed!`));
  },
});

module.exports = {
  upload,
  certificateUpload,
  s3Client,
  deleteS3Object,
};
