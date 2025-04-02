import express from 'express'
import { get_all_turns } from '../controllers/tournamentController'

const router = express.Router()

router.get('/get_all_turns', get_all_turns)

export default router
