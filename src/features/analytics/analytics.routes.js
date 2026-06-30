const express = require("express");
const analyticsController = require("./analytics.controller");

const router = express.Router();

router.post("/visit", analyticsController.logVisit);

module.exports = router;
