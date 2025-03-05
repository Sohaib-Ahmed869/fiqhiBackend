const mongoose = require("mongoose");

const FatwaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot be more than 200 characters"],
    },
    question: {
      type: String,
      required: [true, "Question is required"],
      trim: true,
    },
    answer: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "answered", "rejected", "assigned", "approved"],
      default: "pending",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    answeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    answeredAt: {
      type: Date,
    },
    feedback: {
      type: Array,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search functionality
FatwaSchema.index({ title: "text", question: "text", answer: "text" });

module.exports = mongoose.model("Fatwa", FatwaSchema);
