import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import iconv from 'iconv-lite';
import path from 'path';
import fs from 'fs';
import { query } from '../config/db';
import redisClient from '../config/redis';

export interface CsvExportJobData {
  requestedBy: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

interface SettlementRow {
  application_number: string;
  applicant_name: string;
  template_title: string;
  expected_amount: string;
  actual_amount: string;
  currency: string;
  settlement_status: string;
  settled_at: string | null;
}

const QUEUE_NAME = 'csv-export';
const OUTPUT_DIR = path.resolve('./tmp/exports');

const worker = new Worker<CsvExportJobData>(
  QUEUE_NAME,
  async (job: Job<CsvExportJobData>) => {
    const { requestedBy, status, fromDate, toDate } = job.data;

    console.log(`[CSV Export] Job ${job.id} started by user ${requestedBy}`);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`s.status = $${paramIdx++}`);
      params.push(status);
    }
    if (fromDate) {
      conditions.push(`s.created_at >= $${paramIdx++}`);
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push(`s.created_at <= $${paramIdx++}`);
      params.push(toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query<SettlementRow>(
      `SELECT
         a.application_number,
         u.full_name AS applicant_name,
         ft.title AS template_title,
         s.expected_amount,
         s.actual_amount,
         s.currency,
         s.status AS settlement_status,
         s.settled_at
       FROM settlements s
       JOIN applications a ON a.id = s.application_id
       JOIN users u ON u.id = a.applicant_id
       JOIN form_templates ft ON ft.id = a.template_id
       ${whereClause}
       ORDER BY s.created_at DESC`,
      params
    );

    const headers = [
      '申請番号',
      '申請者名',
      '申請種別',
      '予定金額',
      '実費金額',
      '通貨',
      '精算状態',
      '精算完了日',
    ];

    const rows = result.rows.map((row) => [
      row.application_number,
      row.applicant_name,
      row.template_title,
      row.expected_amount ?? '',
      row.actual_amount ?? '',
      row.currency,
      row.settlement_status,
      row.settled_at ? new Date(row.settled_at).toLocaleDateString('ja-JP') : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    // Encode as Shift-JIS for compatibility with Japanese Excel
    const encoded = iconv.encode(csvContent, 'Shift_JIS');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const fileName = `settlements_${Date.now()}.csv`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, encoded);

    // Store download info in Redis for 1 hour so the user can poll for it
    await redisClient.setex(
      `export:ready:${requestedBy}`,
      3600,
      JSON.stringify({ fileName, filePath, rows: result.rowCount })
    );

    console.log(`[CSV Export] Job ${job.id} complete — ${result.rowCount} rows → ${filePath}`);
    return { fileName, rows: result.rowCount };
  },
  {
    connection: redisClient,
    concurrency: 2,
  }
);

worker.on('completed', (job) => {
  console.log(`[CSV Export] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[CSV Export] Job ${job?.id} failed:`, err.message);
});

export default worker;
