const express = require('express')
const router = express.Router()
const controller = require('../controllers/partnersController')
const auth = require('../routes/auth')

// Partner carriers & markup — admin only.
router.get('/', auth.authenticateToken, auth.verifyRole(['admin']), controller.listPartners)
router.put('/default', auth.authenticateToken, auth.verifyRole(['admin']), controller.updateDefault)
router.put('/:slug', auth.authenticateToken, auth.verifyRole(['admin']), controller.updatePartner)

module.exports = router
