import { Request, Response, NextFunction } from 'express'

interface AppError extends Error {
  statusCode?: number
}

const errorHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err.message)
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  })
}

export default errorHandler
