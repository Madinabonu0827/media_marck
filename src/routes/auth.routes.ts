import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import crypto from 'crypto'
import User from '../models/User'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/generateTokens'

const router = Router()

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('username').isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg })
        return
      }
      const { email, username, password } = req.body
      const existingUser = await User.findOne({ $or: [{ email }, { username }] })
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: existingUser.email === email ? 'Email already in use' : 'Username already taken',
        })
        return
      }
      const user = new User({ email, username, passwordHash: password })
      await user.save()
      const accessToken = generateAccessToken(user._id.toString(), user.role)
      const refreshToken = generateRefreshToken(user._id.toString())
      res.status(201).json({
        success: true,
        data: {
          user: { id: user._id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role },
          accessToken,
          refreshToken,
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  }
)

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg })
        return
      }
      const { email, password } = req.body
      const user = await User.findOne({ email }).select('+passwordHash')
      if (!user) {
        res.status(401).json({ success: false, message: 'Invalid credentials' })
        return
      }
      const isMatch = await user.comparePassword(password)
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Invalid credentials' })
        return
      }
      const accessToken = generateAccessToken(user._id.toString(), user.role)
      const refreshToken = generateRefreshToken(user._id.toString())
      res.json({
        success: true,
        data: {
          user: { id: user._id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role },
          accessToken,
          refreshToken,
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  }
)

router.post('/telegram', async (req: Request, res: Response) => {
  try {
    const { id, first_name, last_name, username, auth_date, hash } = req.body
    if (!id) {
      res.status(400).json({ success: false, message: 'Telegram user data is required' })
      return
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (botToken) {
      const secretKey = crypto.createHash('sha256').update(botToken).digest()
      const checkData = Object.keys(req.body)
        .filter((key) => key !== 'hash')
        .sort()
        .map((key) => `${key}=${req.body[key]}`)
        .join('\n')
      const hmac = crypto.createHmac('sha256', secretKey).update(checkData).digest('hex')
      if (hmac !== hash) {
        res.status(401).json({ success: false, message: 'Invalid Telegram data' })
        return
      }
      const now = Math.floor(Date.now() / 1000)
      if (Math.abs(now - Number(auth_date)) > 86400) {
        res.status(401).json({ success: false, message: 'Telegram data expired' })
        return
      }
    }
    const telegramId = String(id)
    let user = await User.findOne({ telegramId: Number(telegramId) })
    if (!user) {
      const telegramUsername = username || `tg_${telegramId}`
      let finalUsername = telegramUsername
      let counter = 1
      while (await User.findOne({ username: finalUsername })) {
        finalUsername = `${telegramUsername}${counter}`
        counter++
      }
      user = new User({
        username: finalUsername,
        email: `${telegramId}@telegram.temp`,
        passwordHash: Math.random().toString(36).slice(-16),
        telegramId: Number(telegramId),
        avatarUrl: '',
        bio: first_name ? `${first_name}${last_name ? ` ${last_name}` : ''}` : '',
      })
      await user.save()
    }
    const accessToken = generateAccessToken(user._id.toString(), user.role)
    const refreshToken = generateRefreshToken(user._id.toString())
    res.json({
      success: true,
      data: {
        user: { id: user._id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role },
        accessToken,
        refreshToken,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token is required' })
      return
    }
    const decoded = verifyRefreshToken(refreshToken)
    const user = await User.findById(decoded.id)
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' })
      return
    }
    const accessToken = generateAccessToken(user._id.toString(), user.role)
    res.json({ success: true, data: { accessToken } })
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' })
  }
})

export default router
