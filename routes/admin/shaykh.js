const express = require("express");
const router = express.Router();
const {
  registerShaykh,
  getShaykhs,
  deleteShaykh,
  generateRegistrationToken,
  getRegistrationTokens,
  revokeRegistrationToken,
} = require("../../controllers/admin/shaykhController");
const { protect, authorize } = require("../../middleware/auth");

// All routes require admin access
router.get("/", getShaykhs);
router.use(protect, authorize("admin"));

router.post("/", registerShaykh);
router.delete("/:id", deleteShaykh);

router.post('/generate-registration-token', protect, authorize('admin'), generateRegistrationToken);
router.get('/registration-tokens', protect, authorize('admin'), getRegistrationTokens);
router.delete('/registration-tokens/:id', protect, authorize('admin'), revokeRegistrationToken);

module.exports = router;
