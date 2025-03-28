import express from 'express'
import { update_shit, get_shits, get_top_shit_cities, get_top_shit_countries } from '../controllers/mapController'

const router = express.Router()

router.post('/update_shit', update_shit)
router.post('/get_shits', get_shits)
router.get('/get_cities', get_top_shit_cities)
router.get('/get_countries', get_top_shit_countries)

export default router
