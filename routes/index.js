const express = require("express");
const router = express.Router();

// Import all route files
const fatwaRoutes = require("./fatwa");
const authRoutes = require("./auth");
const adminShaykhRoutes = require("./admin/shaykh");
const marriageRoutes = require("./marriage");
const reconciliationRoutes = require("./recon");
const userRoutes = require("./user");
const adminDashboardRoutes = require("../controllers/adminDashboard");
const {
  verifyRegistrationToken,
  registerShaykhWithToken,
} = require("../controllers/publicController");

// Mount routes
router.get('/api/verify-token/:token', verifyRegistrationToken);
router.post('/api/register-shaykh/:token', registerShaykhWithToken);
router.use("/api/fatwas", fatwaRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/admin/shaykhs", adminShaykhRoutes);
router.use("/api/marriages", marriageRoutes);
router.use("/api/reconciliations", reconciliationRoutes);
router.use("/api/users", userRoutes);
router.use("/api/admin-dashboard", adminDashboardRoutes);
module.exports = router;
