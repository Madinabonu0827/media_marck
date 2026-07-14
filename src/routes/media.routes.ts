import { Router, Response } from 'express'
import { body, validationResult } from 'express-validator'
import auth, { AuthRequest, optionalAuth } from '../middleware/auth'
import upload from '../middleware/upload'
import MediaItem from '../models/MediaItem'
import Entry from '../models/Entry'
import { cloudinary } from '../config/cloudinary'

const router = Router()

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { type, search, genre, page = '1', limit = '20' } = req.query
    const filter: any = {}
    if (type) filter.type = type
    if (genre) filter.genres = { $in: [genre] }
    if (search) filter.title = { $regex: search, $options: 'i' }
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum
    const [media, total] = await Promise.all([
      MediaItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      MediaItem.countDocuments(filter),
    ])
    res.json({ success: true, data: { media, total, page: pageNum, pages: Math.ceil(total / limitNum) } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const media = await MediaItem.findById(req.params.id).lean()
    if (!media) {
      res.status(404).json({ success: false, message: 'Media not found' })
      return
    }
    const [entryCount, ratingStats] = await Promise.all([
      Entry.countDocuments({ mediaId: media._id }),
      Entry.aggregate([
        { $match: { mediaId: media._id, rating: { $gt: 0 } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]),
    ])
    res.json({
      success: true,
      data: {
        media,
        entryCount,
        avgRating: ratingStats[0] ? Math.round(ratingStats[0].avgRating * 10) / 10 : 0,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post(
  '/',
  auth,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('type').isIn(['book', 'game', 'movie', 'series']).withMessage('Type must be book, game, movie, or series'),
    body('releaseYear').isInt({ min: 1000, max: 9999 }).withMessage('Valid release year is required'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg })
        return
      }
      const { title, type, coverUrl, description, genres, releaseYear, isTeamGame, platform } = req.body
      const media = new MediaItem({
        title, type, coverUrl: coverUrl || '', description: description || '',
        genres: genres || [], releaseYear, isTeamGame: isTeamGame || false, platform: platform || [],
      })
      await media.save()
      res.status(201).json({ success: true, data: { media } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  }
)

router.post('/upload-cover', auth, upload.single('cover'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' })
      return
    }
    const b64 = Buffer.from(req.file.buffer).toString('base64')
    const dataURI = `data:${req.file.mimetype};base64,${b64}`
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'mediatrack/covers',
      transformation: [{ width: 500, height: 700, crop: 'fill' }],
    })
    res.json({ success: true, data: { coverUrl: result.secure_url } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

export default router
