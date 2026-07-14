import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  username: string
  email: string
  passwordHash: string
  avatarUrl: string
  bio: string
  socialLinks: { instagram: string; youtube: string; telegram: string }
  role: 'user' | 'verified' | 'admin'
  isPrivate: boolean
  telegramId: number
  followers: mongoose.Types.ObjectId[]
  following: mongoose.Types.ObjectId[]
  comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  avatarUrl: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 300 },
  socialLinks: {
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    telegram: { type: String, default: '' },
  },
  role: { type: String, enum: ['user', 'verified', 'admin'], default: 'user' },
  isPrivate: { type: Boolean, default: false },
  telegramId: { type: Number, default: 0 },
  followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true })

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next()
  const salt = await bcrypt.genSalt(12)
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
  next()
})

userSchema.methods.comparePassword = async function (candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.passwordHash)
}

export default mongoose.model<IUser>('User', userSchema)
