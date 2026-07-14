import mongoose, { Schema, Document } from 'mongoose'

export interface ITeamRequest {
  userId: mongoose.Types.ObjectId
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Date
}

export interface ITeamPost extends Document {
  ownerId: mongoose.Types.ObjectId
  mediaId: mongoose.Types.ObjectId
  title: string
  description: string
  neededPlayers: number
  rank: string
  language: string
  contact: string
  status: 'open' | 'closed'
  requests: ITeamRequest[]
  members: mongoose.Types.ObjectId[]
}

const teamRequestSchema = new Schema<ITeamRequest>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, { timestamps: true })

const teamPostSchema = new Schema<ITeamPost>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mediaId: { type: Schema.Types.ObjectId, ref: 'MediaItem', required: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 2000 },
  neededPlayers: { type: Number, required: true, min: 1 },
  rank: { type: String, default: '' },
  language: { type: String, default: 'English' },
  contact: { type: String, default: '' },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  requests: [teamRequestSchema],
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true })

export default mongoose.model<ITeamPost>('TeamPost', teamPostSchema)
