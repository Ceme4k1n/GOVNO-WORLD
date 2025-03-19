import express from 'express'
import { update_shit, get_shits } from '../controllers/mapController'

const router = express.Router()

router.post('/update_shit', update_shit)
router.post('/get_shits', get_shits)

export default router
