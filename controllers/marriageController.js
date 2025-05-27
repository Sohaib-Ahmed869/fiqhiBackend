// controllers/marriageController.js
const Marriage = require("../models/Marriage");
const User = require("../models/User");
const PDFDocument = require("pdfkit");
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment");
const { ArabicReshaper } = require("arabic-reshaper");
const { bidi } = require("bidi-js");

// @desc    Get all marriages
// @route   GET /api/marriages
// @access  Protected (admin, shaykh)
exports.getMarriages = async (req, res) => {
  try {
    let query = {};

    // Apply filters if provided
    if (req.query.type) {
      query.type = req.query.type;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    // If shaykh, only show their assigned marriages
    if (req.user.role === "shaykh") {
      query.assignedShaykh = req.user.id;
    }

    const marriages = await Marriage.find(query)
      .populate({
        path: "user",
        select: "username email",
      })
      .populate({
        path: "assignedShaykh",
        select: "username email firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: marriages.length, marriages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get single marriage
// @route   GET /api/marriages/:id
// @access  Protected
exports.getMarriage = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id)
      .populate({
        path: "user",
        select: "username email",
      })
      .populate({
        path: "assignedShaykh",
        select: "username email firstName lastName",
      })
      .populate({
        path: "feedback.user",
        select: "username email firstName lastName role",
      });

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create reservation request
// @route   POST /api/marriages/reservation
// @access  Protected
exports.createReservation = async (req, res) => {
  try {
    const {
      partnerOne,
      partnerTwo,
      preferredDate,
      preferredTime,
      preferredLocation,
      additionalInformation,
      selectedShaykh,
      registerAsAustralian,
    } = req.body;

    let reservationData = {
      type: "reservation",
      user: req.user.id,
      partnerOne,
      partnerTwo,
      preferredDate,
      preferredTime,
      preferredLocation,
      additionalInformation,
      registerAsAustralian: registerAsAustralian || "no",
    };

    // If a specific shaykh was selected, assign them
    if (selectedShaykh) {
      reservationData.assignedShaykh = selectedShaykh;
      reservationData.status = "assigned";
    }

    const reservation = await Marriage.create(reservationData);

    res.status(201).json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create certificate request
// @route   POST /api/marriages/certificate
// @access  Protected
exports.createCertificate = async (req, res) => {
  try {
    const {
      partnerOne,
      partnerTwo,
      marriageDate,
      marriagePlace,
      witnesses,
      additionalInformation,
    } = req.body;

    const certificate = await Marriage.create({
      type: "certificate",
      user: req.user.id,
      partnerOne,
      partnerTwo,
      marriageDate,
      marriagePlace,
      witnesses,
      additionalInformation,
    });

    res.status(201).json({ success: true, certificate });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Assign marriage to shaykh
// @route   PUT /api/marriages/:id/assign
// @access  Protected (admin)
exports.assignMarriage = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Only admin can assign
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to assign marriages",
      });
    }

    // Validate shaykh exists
    const { shaykhId } = req.body;
    if (!shaykhId) {
      return res
        .status(400)
        .json({ success: false, error: "Please provide a shaykh ID" });
    }

    const shaykh = await User.findById(shaykhId);
    if (!shaykh || shaykh.role !== "shaykh") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid shaykh ID" });
    }

    // Update marriage
    marriage.assignedShaykh = shaykhId;
    marriage.status = "assigned";

    await marriage.save();

    // Return populated marriage
    const updatedMarriage = await Marriage.findById(marriage._id).populate({
      path: "assignedShaykh",
      select: "username email firstName lastName",
    });

    res.status(200).json({ success: true, marriage: updatedMarriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Add a meeting to a marriage reservation
// @route   POST /api/marriages/:id/meetings
// @access  Protected (admin, assigned shaykh)
exports.addMeeting = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Only admin or assigned shaykh can add meetings

    // Only for reservation type
    if (marriage.type !== "reservation") {
      return res.status(400).json({
        success: false,
        error: "Meetings can only be added to reservations",
      });
    }

    const { date, time, location, notes } = req.body;

    marriage.meetings.push({
      date,
      time,
      location,
      notes,
      status: "scheduled",
    });

    // Update status if this is the first meeting
    if (marriage.status === "assigned" || marriage.status === "pending") {
      marriage.status = "in-progress";
    }

    await marriage.save();

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Update meeting status
// @route   PUT /api/marriages/:id/meetings/:meetingId
// @access  Protected (admin, assigned shaykh)
exports.updateMeeting = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Find the meeting
    const meeting = marriage.meetings.id(req.params.meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }

    const { status, completedNotes, date, time, location, notes } = req.body;

    // Update meeting fields
    if (status) meeting.status = status;
    if (completedNotes) meeting.completedNotes = completedNotes;
    if (date) meeting.date = date;
    if (time) meeting.time = time;
    if (location) meeting.location = location;
    if (notes) meeting.notes = notes;

    await marriage.save();

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Modified upload certificate function using multer
// exports.uploadCertificate = async (req, res) => {
//   try {
//     // Debug logs to see what we're getting
//     console.log("File upload request received");
//     console.log("req.file:", req.file);
//     console.log("req.body:", req.body);

//     const marriage = await Marriage.findById(req.params.id);

//     if (!marriage) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Marriage record not found" });
//     }

//     // Only for certificate type
//     if (marriage.type !== "certificate") {
//       return res.status(400).json({
//         success: false,
//         error: "File can only be uploaded for certificate requests",
//       });
//     }

//     // Check if file was uploaded successfully
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         error: "No file uploaded or file upload failed",
//       });
//     }

//     // Update marriage record with S3 file information
//     marriage.certificateFile = req.file.key;
//     marriage.certificateFileUrl =
//       req.file.location ||
//       `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.file.key}`;

//     // Get certificate number from body
//     marriage.certificateNumber = req.body.certificateNumber;
//     marriage.certificateIssuedDate = new Date();
//     marriage.status = "completed";

//     await marriage.save();

//     res.status(200).json({
//       success: true,
//       marriage,
//       fileInfo: {
//         key: req.file.key,
//         location: req.file.location,
//         mimetype: req.file.mimetype,
//         size: req.file.size,
//       },
//     });
//   } catch (err) {
//     console.error("Error in uploadCertificate:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

exports.uploadCertificate = async (req, res) => {
  try {
    // Debug logs
    console.log("File upload request received");
    console.log("req.file:", req.file);
    console.log("req.body:", req.body);
    console.log("Marriage ID:", req.params.id);

    if (!req.params.id) {
      return res.status(400).json({
        success: false,
        error: "Marriage ID is required",
      });
    }

    // Check if file was uploaded successfully first
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded or file upload failed",
      });
    }

    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Only for certificate type
    if (marriage.type !== "certificate") {
      return res.status(400).json({
        success: false,
        error: "File can only be uploaded for certificate requests",
      });
    }

    // Set file details
    const fileUrl =
      req.file.location ||
      `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.file.key}`;

    // Update marriage record with S3 file information
    marriage.certificateFile = req.file.key;
    marriage.certificateFileUrl = fileUrl;

    // Get certificate number from body
    if (req.body.certificateNumber) {
      marriage.certificateNumber = req.body.certificateNumber;
    }

    marriage.certificateIssuedDate = new Date();
    marriage.status = "completed";

    // Save with error handling
    try {
      await marriage.save();
    } catch (saveError) {
      console.error("Error saving marriage record:", saveError);
      return res.status(500).json({
        success: false,
        error: "Error saving certificate information: " + saveError.message,
      });
    }

    res.status(200).json({
      success: true,
      marriage,
      fileInfo: {
        key: req.file.key,
        location: fileUrl,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (err) {
    console.error("Error in uploadCertificate:", err);
    res.status(500).json({
      success: false,
      error: "Certificate upload failed: " + err.message,
    });
  }
};
// Get certificate URL function remains mostly the same
// Modify the existing getCertificateUrl function
exports.getCertificateUrl = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Check permissions
    if (
      req.user.role !== "admin" &&
      marriage.assignedShaykh &&
      marriage.assignedShaykh.toString() !== req.user.id &&
      marriage.user.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this certificate",
      });
    }

    // Check if marriage has a certificate generated
    if (!marriage.certificate_generated) {
      return res
        .status(404)
        .json({ success: false, error: "No certificate has been generated" });
    }

    // Generate the PDF dynamically here
    // This is where you would implement your Islamic certificate generation
    // For now, let's just return a mock URL

    // Update status to completed when downloaded
    if (marriage.status !== "completed") {
      marriage.status = "completed";
      await marriage.save();
    }

    // Mock URL for testing
    const mockUrl = `/api/marriages/download-certificate/${marriage._id}`;
    res.status(200).json({ success: true, downloadUrl: mockUrl });

    // In a real implementation, you would generate a signed URL or serve a PDF
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
// @desc    Complete marriage reservation
// @route   PUT /api/marriages/:id/complete
// @access  Protected (admin, assigned shaykh)
exports.completeMarriage = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Mark as completed and add notes
    marriage.status = "completed";
    if (req.body.notes) {
      marriage.adminNotes = req.body.notes;
    }

    await marriage.save();

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Add feedback to marriage
// @route   POST /api/marriages/:id/feedback
// @access  Protected
exports.addFeedback = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    const { comment } = req.body;

    if (!comment) {
      return res
        .status(400)
        .json({ success: false, error: "Comment is required" });
    }

    marriage.feedback.push({
      comment,
      user: req.user.id,
    });

    await marriage.save();

    // Return with populated feedback
    const updatedMarriage = await Marriage.findById(marriage._id).populate({
      path: "feedback.user",
      select: "username email firstName lastName role",
    });

    res.status(200).json({ success: true, marriage: updatedMarriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Cancel marriage
// @route   PUT /api/marriages/:id/cancel
// @access  Protected (admin, user who created it)
exports.cancelMarriage = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Cannot cancel if already completed
    if (marriage.status === "completed") {
      return res
        .status(400)
        .json({ success: false, error: "Cannot cancel a completed marriage" });
    }

    marriage.status = "cancelled";
    if (req.body.reason) {
      marriage.adminNotes = req.body.reason;
    }

    await marriage.save();

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get user marriages
// @route   GET /api/marriages/my-marriages
// @access  Protected
exports.getUserMarriages = async (req, res) => {
  try {
    const marriages = await Marriage.find({ user: req.user.id })
      .populate({
        path: "assignedShaykh",
        select: "username email firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: marriages.length, marriages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get shaykh assigned marriages
// @route   GET /api/marriages/my-assignments
// @access  Protected (shaykh)
exports.getShaykhAssignments = async (req, res) => {
  try {
    console.log("here");
    // Only shaykh can access this route
    if (req.user.role !== "shaykh") {
      console.log("here2");
      return res.status(403).json({
        success: false,
        error: "Not authorized to access assigned marriages",
      });
    }

    const marriages = await Marriage.find({
      assignedShaykh: req.user.id,
      status: { $in: ["assigned", "in-progress"] },
    })
      .populate({
        path: "user",
        select: "username email",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: marriages.length, marriages });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// In your backend controller (marriageController.js)
exports.generateCertificate = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Only for certificate type
    if (marriage.type !== "certificate") {
      return res.status(400).json({
        success: false,
        error: "Certificates can only be generated for certificate requests",
      });
    }

    // Update the certificate information
    marriage.certificate_generated = true;
    marriage.certificateNumber = req.body.certificateNumber;
    marriage.certificateIssuedDate = new Date();

    // Don't set to completed yet, until they download
    if (marriage.status === "pending" || marriage.status === "assigned") {
      marriage.status = "in-progress";
    }

    await marriage.save();

    res.status(200).json({
      success: true,
      marriage,
    });
  } catch (err) {
    console.error("Error marking certificate as generated:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.downloadCertificate = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id).populate(
      "assignedShaykh",
      "firstName lastName"
    );

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    if (!marriage.certificate_generated) {
      return res
        .status(404)
        .json({ success: false, error: "No certificate has been generated" });
    }

    // Create a PDF document
    const doc = new PDFDocument({
      size: [842, 595], // A4 Landscape
      margin: 50,
      info: {
        Title: `Marriage Certificate - ${marriage.certificateNumber}`,
        Author: "Islamic Marriage Service",
        Subject: "Marriage Certificate",
        Keywords: "marriage, certificate, islamic",
      },
    });

    // Set the response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=marriage-certificate-${marriage.certificateNumber}.pdf`
    );

    // Pipe the PDF to the response
    doc.pipe(res);

    // Load custom fonts (you'll need to have these files in your project)
    const fontPath = path.join(__dirname, "../assets/fonts");
    doc.registerFont(
      "DecoFont",
      path.join(fontPath, "Scheherazade-Regular.ttf")
    );
    doc.registerFont(
      "EnglishFont",
      path.join(fontPath, "Montserrat-Regular.ttf")
    );
    doc.registerFont("EnglishBold", path.join(fontPath, "Montserrat-Bold.ttf"));
    doc.registerFont("Arabic", path.join(fontPath, "Amiri-Regular.ttf"));

    // Background and border
    doc
      .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .lineWidth(2)
      .fillOpacity(0.05)
      .fillAndStroke("#f0f4f8", "#2c3e50");

    // Add a decorative header
    doc
      .fontSize(28)
      .font("EnglishBold")
      .fillColor("#2c3e50")
      .text("ISLAMIC MARRIAGE CERTIFICATE", {
        align: "center",
      });

    // Add certificate number and date
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("EnglishFont")
      .text(`Certificate No: ${marriage.certificateNumber}`, {
        align: "center",
      })
      .text(
        `Issued Date: ${moment(marriage.certificateIssuedDate).format(
          "MMMM D, YYYY"
        )}`,
        {
          align: "center",
        }
      );

    // Add decorative divider
    doc.moveDown(1);
    doc
      .lineWidth(1)
      .moveTo(150, doc.y)
      .lineTo(doc.page.width - 150, doc.y)
      .stroke("#2c3e50");

    // Add Bismillah in Arabic
    doc.moveDown(1);
    const bismillah = ArabicReshaper.reshape(
      "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم"
    );
    const bidiText = bidi(bismillah);

    doc
      .fontSize(18)
      .font("Arabic")
      .text(bidiText, {
        align: "center",
        features: ["rtla"],
      });

    // Add certificate content
    doc.moveDown(1);
    doc.fontSize(12).font("EnglishFont").text("This is to certify that", {
      align: "center",
    });

    // Partner names in bold
    doc.moveDown(0.5);
    doc
      .fontSize(16)
      .font("EnglishBold")
      .text(
        `${marriage.partnerOne.firstName} ${marriage.partnerOne.lastName}`,
        {
          align: "center",
        }
      )
      .text("and", {
        align: "center",
      })
      .text(
        `${marriage.partnerTwo.firstName} ${marriage.partnerTwo.lastName}`,
        {
          align: "center",
        }
      );

    // Continue with more details
    doc.moveDown(1);
    doc
      .fontSize(12)
      .font("EnglishFont")
      .text("have been lawfully married according to Islamic Law (Shariah)", {
        align: "center",
      })
      .text(`on ${moment(marriage.marriageDate).format("MMMM D, YYYY")}`, {
        align: "center",
      })
      .text(`at ${marriage.marriagePlace}`, {
        align: "center",
      });

    // Add witnesses section
    doc.moveDown(2);
    doc.fontSize(14).font("EnglishBold").text("WITNESSES", {
      align: "center",
    });

    // List witnesses
    doc.moveDown(0.5);
    doc.fontSize(12).font("EnglishFont");

    if (marriage.witnesses && marriage.witnesses.length > 0) {
      marriage.witnesses.forEach((witness, index) => {
        doc.text(
          `${index + 1}. ${witness.name}${
            witness.contact ? ` (${witness.contact})` : ""
          }`,
          {
            align: "center",
          }
        );
      });
    } else {
      doc.text("No witnesses recorded", {
        align: "center",
      });
    }

    // Add officiant (Shaykh) section
    doc.moveDown(2);
    doc.fontSize(14).font("EnglishBold").text("OFFICIATED BY", {
      align: "center",
    });

    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("EnglishFont")
      .text(
        `${marriage.assignedShaykh.firstName} ${marriage.assignedShaykh.lastName}`,
        {
          align: "center",
        }
      );

    // Add signature lines
    doc.moveDown(3);

    // Draw signature lines
    const signatureY = doc.y;
    const leftX = 150;
    const rightX = doc.page.width - 150;

    // Shaykh signature
    doc
      .lineWidth(0.5)
      .moveTo(leftX, signatureY)
      .lineTo(leftX + 150, signatureY)
      .stroke();

    doc.text("Shaykh Signature", leftX, signatureY + 5, {
      width: 150,
      align: "center",
    });

    // Bride/groom signatures
    doc
      .lineWidth(0.5)
      .moveTo(rightX - 150, signatureY)
      .lineTo(rightX, signatureY)
      .stroke();

    doc.text("Official Seal", rightX - 150, signatureY + 5, {
      width: 150,
      align: "center",
    });

    // Add footer with decorative line
    const footerY = doc.page.height - 70;
    doc
      .lineWidth(1)
      .moveTo(150, footerY)
      .lineTo(doc.page.width - 150, footerY)
      .stroke("#2c3e50");

    doc
      .fontSize(10)
      .font("EnglishFont")
      .text(
        "This certificate is an official document recognized by our Islamic institution.",
        {
          align: "center",
          y: footerY + 10,
        }
      )
      .text(
        "May Allah bless this union and grant the couple happiness and prosperity.",
        {
          align: "center",
        }
      );

    // Finalize the PDF
    doc.end();
  } catch (err) {
    console.error("Error generating certificate PDF:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
