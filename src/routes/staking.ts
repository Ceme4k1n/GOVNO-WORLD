import express from 'express'
import { create_day_night_staking, get_staking_active, update_stakings, update_gambler_level, staking_cashout } from '../controllers/stakingController'

const router = express.Router()

router.post('/create_day_night_staking', create_day_night_staking)
router.post('/update_gambler_level', update_gambler_level)
router.post('/staking_cashout', staking_cashout)
router.get('/get_staking_active', get_staking_active)
router.get('/update_stakings', update_stakings)

export default router
