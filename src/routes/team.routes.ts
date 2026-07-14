import { Router, Response } from 'express'
import { body, validationResult } from 'express-validator'
import auth, { AuthRequest, optionalAuth } from '../middleware/auth'
import TeamPost from '../models/TeamPost'
import MediaItem from '../models/MediaItem'
import User from '../models/User'
import Notification from '../models/Notification'

const router = Router()

router.post(
  '/',
  auth,
  [
    body('mediaId').notEmpty().withMessage('Media ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('neededPlayers').isInt({ min: 1 }).withMessage('Needed players must be at least 1'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg })
        return
      }
      const { mediaId, title, description, neededPlayers, rank, language, contact } = req.body
      const media = await MediaItem.findById(mediaId)
      if (!media) {
        res.status(404).json({ success: false, message: 'Media not found' })
        return
      }
      if (!media.isTeamGame) {
        res.status(400).json({ success: false, message: 'Team posts are only for team games' })
        return
      }
      const teamPost = new TeamPost({
        ownerId: req.user!.id, mediaId, title, description: description || '',
        neededPlayers, rank: rank || '', language: language || 'English',
        contact: contact || '', members: [req.user!.id],
      })
      await teamPost.save()
      const populated = await TeamPost.findById(teamPost._id)
        .populate('ownerId', 'username avatarUrl')
        .populate('mediaId', 'title coverUrl')
        .populate('members', 'username avatarUrl')
      res.status(201).json({ success: true, data: { teamPost: populated } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  }
)

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { mediaId, status, platform, page = '1', limit = '20' } = req.query
    const filter: any = {}
    if (mediaId) filter.mediaId = mediaId
    if (status) filter.status = status
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum
    const [teamPosts, total] = await Promise.all([
      TeamPost.find(filter)
        .populate('ownerId', 'username avatarUrl')
        .populate('mediaId', 'title coverUrl type platform')
        .populate('members', 'username avatarUrl')
        .sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      TeamPost.countDocuments(filter),
    ])
    let filteredPosts = teamPosts
    if (platform) {
      filteredPosts = teamPosts.filter((post: any) => post.mediaId?.platform?.includes(platform))
    }
    res.json({ success: true, data: { teamPosts: filteredPosts, total, page: pageNum, pages: Math.ceil(total / limitNum) } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const teamPost = await TeamPost.findById(req.params.id)
      .populate('ownerId', 'username avatarUrl')
      .populate('mediaId', 'title coverUrl type platform')
      .populate('members', 'username avatarUrl')
      .populate('requests.userId', 'username avatarUrl')
    if (!teamPost) {
      res.status(404).json({ success: false, message: 'Team post not found' })
      return
    }
    res.json({ success: true, data: { teamPost } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/:id/request', auth, async (req: AuthRequest, res) => {
  try {
    const teamPost = await TeamPost.findById(req.params.id)
    if (!teamPost) {
      res.status(404).json({ success: false, message: 'Team post not found' })
      return
    }
    if (teamPost.status !== 'open') {
      res.status(400).json({ success: false, message: 'Team post is closed' })
      return
    }
    const userId = req.user!.id
    if (teamPost.ownerId.toString() === userId) {
      res.status(400).json({ success: false, message: 'Cannot request to join your own team' })
      return
    }
    if (teamPost.members.includes(userId as any)) {
      res.status(400).json({ success: false, message: 'Already a member' })
      return
    }
    const existingRequest = teamPost.requests.find((r: any) => r.userId.toString() === userId)
    if (existingRequest) {
      if (existingRequest.status === 'rejected') {
        existingRequest.status = 'pending'
      } else {
        res.status(400).json({ success: false, message: 'Request already sent' })
        return
      }
    } else {
      teamPost.requests.push({ userId: userId as any, status: 'pending', createdAt: new Date() })
    }
    await teamPost.save()
    const requester = await User.findById(userId)
    await Notification.create({
      userId: teamPost.ownerId, type: 'team_request',
      text: `${requester?.username || 'Someone'} wants to join your team "${teamPost.title}"`,
      link: `/teams/${teamPost._id}`,
    })
    res.json({ success: true, message: 'Request sent' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.patch(
  '/:id/request/:requestId',
  auth,
  [body('status').isIn(['accepted', 'rejected']).withMessage('Status must be accepted or rejected')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg })
        return
      }
      const teamPost = await TeamPost.findById(req.params.id)
      if (!teamPost) {
        res.status(404).json({ success: false, message: 'Team post not found' })
        return
      }
      if (teamPost.ownerId.toString() !== req.user!.id) {
        res.status(403).json({ success: false, message: 'Not authorized' })
        return
      }
      const requestIndex = teamPost.requests.findIndex((r: any) => r._id?.toString() === req.params.requestId)
      if (requestIndex === -1) {
        res.status(404).json({ success: false, message: 'Request not found' })
        return
      }
      const request = teamPost.requests[requestIndex]
      request.status = req.body.status
      if (req.body.status === 'accepted') {
        if (!teamPost.members.includes(request.userId)) {
          teamPost.members.push(request.userId)
        }
        if (teamPost.members.length >= teamPost.neededPlayers + 1) {
          teamPost.status = 'closed'
        }
      }
      await teamPost.save()
      await Notification.create({
        userId: request.userId, type: 'team_response',
        text: `Your request to join "${teamPost.title}" was ${req.body.status}`,
        link: `/teams/${teamPost._id}`,
      })
      const populated = await TeamPost.findById(teamPost._id)
        .populate('ownerId', 'username avatarUrl')
        .populate('mediaId', 'title coverUrl')
        .populate('members', 'username avatarUrl')
        .populate('requests.userId', 'username avatarUrl')
      res.json({ success: true, data: { teamPost: populated } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  }
)

router.delete('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const teamPost = await TeamPost.findById(req.params.id)
    if (!teamPost) {
      res.status(404).json({ success: false, message: 'Team post not found' })
      return
    }
    if (teamPost.ownerId.toString() !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Not authorized' })
      return
    }
    await TeamPost.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Team post deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

export default router
