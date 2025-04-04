import express from 'express'
import { get_all_turns, user_do_bet } from '../controllers/tournamentController'

const router = express.Router()

router.get('/get_all_turns', get_all_turns)
router.post('/user_bet', user_do_bet)

export default router
