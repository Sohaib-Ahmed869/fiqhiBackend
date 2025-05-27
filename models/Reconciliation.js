// models/Reconciliation.js
const mongoose = require("mongoose");

const MeetingSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Please add meeting date"],
    },
    time: {
      type: String,
      required: [true, "Please add meeting time"],
    },
    location: {
      type: String,
      required: [true, "Please add meeting location"],
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "rescheduled"],
      default: "scheduled",
    },
    completedNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const ReconciliationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedShaykhs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: [
        "pending",
        "assigned",
        "in-progress",
        "resolved",
        "unresolved",
        "cancelled",
      ],
      default: "pending",
    },
    // Husband details
    husband: {
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
    },
    // Wife details
    wife: {
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
    },
    // Brief description of the issues
    issueDescription: {
      type: String,
      required: [true, "Please provide a brief description of the issues"],
    },
    // Meetings scheduled for reconciliation
    meetings: [MeetingSchema],
    // Outcome of the reconciliation
    outcome: {
      type: String,
      enum: ["resolved", "unresolved", "in-progress"],
      default: "in-progress",
    },
    outcomeDetails: {
      type: String,
    },
    // Feedback from users
    feedback: [
      {
        comment: {
          type: String,
          required: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Admin and Shaykh notes
    shaykhNotes: {
      type: String,
    },
    adminNotes: {
      type: String,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Reconciliation", ReconciliationSchema);
