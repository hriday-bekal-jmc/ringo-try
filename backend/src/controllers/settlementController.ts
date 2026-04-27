import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import { query } from '../config/db';
import { StorageService } from '../services/storageService';
import redisClient from '../config/redis';
import { z } from 'zod';

const exportQueue = new Queue('csv-export', { connection: redisClient });

const AttachReceiptSchema = z.object({
  receiptAmount: z.number().positive(),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendorName: z.string().optional(),
  driveFileId: z.string().min(1),
});

export const SettlementController = {
  async listPending(req: Request, res: Response): Promise<void> {
    const { status } = req.query;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    } else {
      conditions.push(`s.status != 'PROCESSED'`);
    }

    const result = await query(
      `SELECT
         s.id, s.expected_amount, s.actual_amount, s.currency, s.status, s.settled_at,
         a.application_number, a.status AS application_status,
         ft.title AS template_title,
         u.full_name AS applicant_name,
         proc.full_name AS processed_by_name
       FROM settlements s
       JOIN applications a ON a.id = s.application_id
       JOIN form_templates ft ON ft.id = a.template_id
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN users proc ON proc.id = s.processed_by
       ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
       ORDER BY s.created_at DESC`,
      params
    );

    res.json(result.rows);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const settlementResult = await query(
      `SELECT s.*, a.application_number, a.form_data, ft.title AS template_title,
              u.full_name AS applicant_name
       FROM settlements s
       JOIN applications a ON a.id = s.application_id
       JOIN form_templates ft ON ft.id = a.template_id
       JOIN users u ON u.id = a.applicant_id
       WHERE s.id = $1`,
      [id]
    );

    if (settlementResult.rows.length === 0) {
      res.status(404).json({ error: 'Settlement not found.' });
      return;
    }

    const receiptsResult = await query(
      `SELECT id, receipt_number, receipt_amount, receipt_date, vendor_name, drive_file_id, created_at
       FROM receipts WHERE settlement_id = $1 ORDER BY created_at`,
      [id]
    );

    res.json({ ...settlementResult.rows[0], receipts: receiptsResult.rows });
  },

  /** Attach a single receipt (uploaded directly to Drive) to a settlement. */
  async attachReceipt(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const parsed = AttachReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const { receiptAmount, receiptDate, vendorName, driveFileId } = parsed.data;

    const result = await query<{ id: string; receipt_number: string }>(
      `INSERT INTO receipts (settlement_id, receipt_amount, receipt_date, vendor_name, drive_file_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, receipt_number`,
      [id, receiptAmount, receiptDate, vendorName ?? null, driveFileId]
    );

    // Recalculate actual_amount as sum of all receipts
    await query(
      `UPDATE settlements
       SET actual_amount = (SELECT SUM(receipt_amount) FROM receipts WHERE settlement_id = $1),
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.status(201).json(result.rows[0]);
  },

  /** Mark the settlement as processed (final). */
  async markSettled(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const processedBy = req.user!.userId;

    const result = await query(
      `UPDATE settlements
       SET status = 'PROCESSED', processed_by = $1, settled_at = NOW()
       WHERE id = $2 AND status != 'PROCESSED'
       RETURNING id`,
      [processedBy, id]
    );

    if (result.rows.length === 0) {
      res.status(409).json({ error: 'Settlement already processed or not found.' });
      return;
    }

    // Update the parent application status
    await query(
      `UPDATE applications SET status = 'SETTLED', updated_at = NOW()
       WHERE id = (SELECT application_id FROM settlements WHERE id = $1)`,
      [id]
    );

    res.json({ message: 'Settlement marked as processed.' });
  },

  /** Generates a pre-signed Google Drive upload URL for receipt files. */
  async getUploadUrl(req: Request, res: Response): Promise<void> {
    const { fileName, mimeType } = req.body as { fileName: string; mimeType: string };

    if (!fileName || !mimeType) {
      res.status(400).json({ error: 'fileName and mimeType are required.' });
      return;
    }

    const uploadUrl = await StorageService.generateUploadUrl(fileName, mimeType);
    res.json({ uploadUrl });
  },

  /** Push a CSV export job to BullMQ and return 202 immediately. */
  async triggerExport(req: Request, res: Response): Promise<void> {
    const { status, fromDate, toDate } = req.query;
    const requestedBy = req.user!.userId;

    try {
      const job = await exportQueue.add('generate-csv', {
        requestedBy,
        status: status ?? undefined,
        fromDate: fromDate ?? undefined,
        toDate: toDate ?? undefined,
      });

      res.status(202).json({
        message: 'Export started. You will be notified when the download is ready.',
        jobId: job.id,
      });
    } catch {
      res.status(503).json({
        error: 'Background job queue is unavailable (Redis not connected). Export cannot be processed right now.',
      });
    }
  },

  /** Poll endpoint: check if the CSV export is ready for the current user. */
  async checkExportStatus(req: Request, res: Response): Promise<void> {
    const { userId } = req.user!;

    try {
      const data = await redisClient.get(`export:ready:${userId}`);
      if (!data) {
        res.json({ ready: false });
        return;
      }
      const parsed = JSON.parse(data) as { fileName: string; rows: number };
      res.json({ ready: true, fileName: parsed.fileName, rows: parsed.rows });
    } catch {
      res.json({ ready: false });
    }
  },
};
