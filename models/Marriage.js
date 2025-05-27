// models/Marriage.js
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

const MarriageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["reservation", "certificate"],
      required: [true, "Please specify marriage service type"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedShaykh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    // Reservation specific fields
    partnerOne: {
      firstName: {
        type: String,
        required: function () {
          return this.type === "reservation" || this.type === "certificate";
        },
      },
      lastName: {
        type: String,
        required: function () {
          return this.type === "reservation" || this.type === "certificate";
        },
      },
      phone: {
        type: String,
        required: function () {
          return this.type === "reservation";
        },
      },
      email: {
        type: String,
        required: function () {
          return this.type === "reservation";
        },
      },
      address: {
        type: String,
        required: function () {
          return this.type === "reservation";
        },
      },
      dateOfBirth: {
        type: Date,
        required: function () {
          return this.type === "certificate";
        },
      },
    },
    partnerTwo: {
      firstName: {
        type: String,
        required: function () {
          return this.type === "reservation" || this.type === "certificate";
        },
      },
      lastName: {
        type: String,
        required: function () {
          return this.type === "reservation" || this.type === "certificate";
        },
      },
      phone: {
        type: String,
        required: function () {
          return this.type === "reservation";
        },
      },
      email: {
        type: String,
        required: function () {
          return this.type === "reservation";
        },
      },
      address: {
        type: String,
        required: function () {
          return this.type === "reservation";
        },
      },
      dateOfBirth: {
        type: Date,
        required: function () {
          return this.type === "certificate";
        },
      },
    },
    preferredDate: {
      type: Date,
      required: function () {
        return this.type === "reservation";
      },
    },
    preferredTime: {
      type: String,
    },
    preferredLocation: {
      type: String,
    },
    meetings: [MeetingSchema],

    // Certificate specific fields
    marriageDate: {
      type: Date,
      required: function () {
        return this.type === "certificate";
      },
    },
    marriagePlace: {
      type: String,
      required: function () {
        return this.type === "certificate";
      },
    },
    certificate_generated: {
      type: Boolean,
      default: false,
    },
    witnesses: [
      {
        name: String,
        contact: String,
      },
    ],
    certificateNumber: {
      type: String,
    },
    certificateFile: {
      type: String,
    },
    certificateIssuedDate: {
      type: Date,
    },

    // Common fields
    additionalInformation: {
      type: String,
    },
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
    certificateNumber: {
      type: String,
    },
    certificateFile: {
      type: String, // S3 key/path
    },
    certificateFileUrl: {
      type: String, // S3 URL
    },
    certificateIssuedDate: {
      type: Date,
    },

    // Admin fields
    adminNotes: {
      type: String,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    selectedShaykh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    registerAsAustralian: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Marriage", MarriageSchema);
