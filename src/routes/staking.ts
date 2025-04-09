import express from 'express'
import { create_day_staking, get_day_staking_active, update_day_staking, update_gambler_level, day_staking_cashout } from '../controllers/stakingController'

const router = express.Router()

router.post('/create_day_staking', create_day_staking)
router.post('/update_gambler_level', update_gambler_level)
router.post('/day_staking_cashout', day_staking_cashout)
router.get('/get_day_staking_active', get_day_staking_active)
router.get('/update_day_staking', update_day_staking)

export default router
