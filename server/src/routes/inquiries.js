import { Router } from 'express';
import { asyncHandler, logEvent } from '../http.js';
import { inquirySchema } from '../validation.js';

export function inquiryRoutes({ store, enqueueNotification = async () => {} }) {
  const router = Router();
  router.post('/', asyncHandler(async (req, res) => {
    const body = inquirySchema.parse(req.body);
    const inquiry = await store.create('inquiry', {
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      message: body.message,
      checkIn: body.checkIn || null,
      checkOut: body.checkOut || null,
      status: 'new',
    });
    logEvent('inquiry.created', { inquiryId: inquiry.id });
    void enqueueNotification('new-inquiry', { inquiryId: inquiry.id, name: inquiry.name, email: inquiry.email }).catch(() => {});
    res.status(201).json({ data: { id: inquiry.id, status: inquiry.status, createdAt: inquiry.createdAt } });
  }));
  return router;
}
