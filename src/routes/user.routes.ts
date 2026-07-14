import { Router } from 'express'
import auth from '../middleware/auth'
import upload from '../middleware/upload'
import User from '../models/User'
import Entry from '../models/Entry'
import Notification from '../models/Notification'
import { cloudinary } from '../config/cloudinary'
import { AuthRequest } from '../middleware/auth'

const router = Router()

router.get('/telegram/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: Number(req.params.telegramId) }).select('-__v')
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    res.json({ success: true, data: { user } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-__v')
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    const [mediaBooks, mediaGames, mediaMovies, mediaSeries, completedEntries] = await Promise.all([
      Entry.aggregate([
        { $match: { userId: user._id } },
        { $lookup: { from: 'mediaitems', localField: 'mediaId', foreignField: '_id', as: 'media' } },
        { $unwind: '$media' },
        { $match: { 'media.type': 'book' } },
        { $count: 'count' },
      ]),
      Entry.aggregate([
        { $match: { userId: user._id } },
        { $lookup: { from: 'mediaitems', localField: 'mediaId', foreignField: '_id', as: 'media' } },
        { $unwind: '$media' },
        { $match: { 'media.type': 'game' } },
        { $count: 'count' },
      ]),
      Entry.aggregate([
        { $match: { userId: user._id } },
        { $lookup: { from: 'mediaitems', localField: 'mediaId', foreignField: '_id', as: 'media' } },
        { $unwind: '$media' },
        { $match: { 'media.type': 'movie' } },
        { $count: 'count' },
      ]),
      Entry.aggregate([
        { $match: { userId: user._id } },
        { $lookup: { from: 'mediaitems', localField: 'mediaId', foreignField: '_id', as: 'media' } },
        { $unwind: '$media' },
        { $match: { 'media.type': 'series' } },
        { $count: 'count' },
      ]),
      Entry.find({ userId: user._id, rating: { $gt: 0 } }).select('rating'),
    ])
    const avgRating = completedEntries.length > 0
      ? completedEntries.reduce((acc: number, e: any) => acc + e.rating, 0) / completedEntries.length
      : 0
    res.json({
      success: true,
      data: {
        user,
        stats: {
          books: mediaBooks[0]?.count || 0,
          games: mediaGames[0]?.count || 0,
          movies: mediaMovies[0]?.count || 0,
          series: mediaSeries[0]?.count || 0,
          avgRating: Math.round(avgRating * 10) / 10,
          followersCount: user.followers.length,
          followingCount: user.following.length,
        },
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.patch('/me', auth, async (req: AuthRequest, res) => {
  try {
    const { username, bio, avatarUrl, socialLinks, isPrivate } = req.body
    if (username) {
      const existing = await User.findOne({ username, _id: { $ne: req.user!.id } })
      if (existing) {
        res.status(400).json({ success: false, message: 'Username already taken' })
        return
      }
    }
    const updateData: any = {}
    if (username !== undefined) updateData.username = username
    if (bio !== undefined) updateData.bio = bio
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
    if (socialLinks !== undefined) updateData.socialLinks = socialLinks
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate
    const user = await User.findByIdAndUpdate(req.user!.id, updateData, { new: true, runValidators: true })
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    res.json({ success: true, data: { user } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/:id/follow', auth, async (req: AuthRequest, res) => {
  try {
    const targetUserId = req.params.id
    const currentUserId = req.user!.id
    if (targetUserId === currentUserId) {
      res.status(400).json({ success: false, message: 'Cannot follow yourself' })
      return
    }
    const targetUser = await User.findById(targetUserId)
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    const currentUser = await User.findById(currentUserId)
    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    const isFollowing = currentUser.following.includes(targetUserId as any)
    if (isFollowing) {
      currentUser.following = currentUser.following.filter((id) => id.toString() !== targetUserId)
      targetUser.followers = targetUser.followers.filter((id) => id.toString() !== currentUserId)
    } else {
      currentUser.following.push(targetUserId as any)
      targetUser.followers.push(currentUserId as any)
      await Notification.create({
        userId: targetUserId,
        type: 'follow',
        text: `${currentUser.username} started following you`,
        link: `/profile/${currentUser.username}`,
      })
    }
    await Promise.all([currentUser.save(), targetUser.save()])
    res.json({ success: true, data: { isFollowing: !isFollowing } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/upload-avatar', auth, upload.single('avatar'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' })
      return
    }
    const b64 = Buffer.from(req.file.buffer).toString('base64')
    const dataURI = `data:${req.file.mimetype};base64,${b64}`
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'mediatrack/avatars',
      transformation: [{ width: 300, height: 300, crop: 'fill' }],
    })
    const user = await User.findByIdAndUpdate(req.user!.id, { avatarUrl: result.secure_url }, { new: true })
    res.json({ success: true, data: { avatarUrl: result.secure_url, user } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

export default router
