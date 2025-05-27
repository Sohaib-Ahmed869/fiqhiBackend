const mongoose = require("mongoose");
const crypto = require("crypto");

const registrationTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        // Token expires in 7 days by default
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-delete expired tokens
registrationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RegistrationToken", registrationTokenSchema);
