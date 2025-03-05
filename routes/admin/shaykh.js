const express = require("express");
const router = express.Router();
const {
  registerShaykh,
  getShaykhs,
  deleteShaykh,
} = require("../../controllers/admin/shaykhController");
const { protect, authorize } = require("../../middleware/auth");

// All routes require admin access
router.use(protect, authorize("admin"));

router.post("/", registerShaykh);
router.get("/", getShaykhs);
router.delete("/:id", deleteShaykh);

module.exports = router;
