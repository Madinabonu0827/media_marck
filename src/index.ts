import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import cors from 'cors'
import connectDB from './config/db'
import configureCloudinary from './config/cloudinary'
import errorHandler from './middleware/errorHandler'
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import mediaRoutes from './routes/media.routes'
import entryRoutes from './routes/entry.routes'
import teamRoutes from './routes/team.routes'
import leaderboardRoutes from './routes/leaderboard.routes'
import notificationRoutes from './routes/notification.routes'

const app = express()
const PORT = process.env.PORT || 5000

configureCloudinary()

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    },
    credentials: true,
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'MediaTrack API is running' })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/entries', entryRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/notifications', notificationRoutes)

app.use(errorHandler)

const startServer = async () => {
  await connectDB()
  app.listen(PORT, () => {
    console.log(`MediaTrack server running on port ${PORT}`)
  })
}

startServer()
