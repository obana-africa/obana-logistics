const { Router } = require('express');
const locationController = require('../controllers/locationController');
const router = Router();

router.get('/countries', locationController.getCountries);
router.get('/states', locationController.getStates);
router.get('/cities', locationController.getCities);

module.exports = router;