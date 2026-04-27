import { Request, Response } from 'express';
import { query } from '../config/db';
import { CacheService, CacheKeys, TTL } from '../services/cacheService';

interface TemplateRow {
  id: string;
  title: string;
  title_en: string;
  pattern_code: string;
  schema_definition: object;
  access_level: string;
}

export const TemplateController = {
  /** Returns only the templates the current user's department has access to (◎ or 〇). */
  async listAvailable(req: Request, res: Response): Promise<void> {
    // Always read department_id fresh from DB — the JWT value can be stale after reassignment
    const { userId } = req.user!;
    const userRow = await query<{ department_id: string | null }>(
      'SELECT department_id FROM users WHERE id = $1',
      [userId]
    );
    const departmentId = userRow.rows[0]?.department_id ?? null;

    if (!departmentId) {
      res.json([]);
      return;
    }

    const cacheKey = CacheKeys.templateMatrix(departmentId);

    const cached = await CacheService.get<TemplateRow[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const result = await query<TemplateRow>(
      `SELECT
         ft.id, ft.title, ft.title_en,
         wp.pattern_code,
         ft.schema_definition,
         tp.access_level
       FROM form_templates ft
       JOIN workflow_patterns wp ON wp.id = ft.pattern_id
       JOIN template_permissions tp ON tp.template_id = ft.id
       WHERE tp.department_id = $1
         AND tp.access_level IN ('MUST', 'SHOULD', 'COULD')
         AND ft.is_active = true
       ORDER BY ft.title`,
      [departmentId]
    );

    await CacheService.set(cacheKey, result.rows, TTL.TEMPLATE_MATRIX);
    res.json(result.rows);
  },

  /** Returns a single template with its full JSON schema for rendering the form. */
  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const result = await query<TemplateRow>(
      `SELECT
         ft.id, ft.title, ft.title_en,
         wp.pattern_code,
         ft.schema_definition
       FROM form_templates ft
       JOIN workflow_patterns wp ON wp.id = ft.pattern_id
       WHERE ft.id = $1 AND ft.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Template not found.' });
      return;
    }

    res.json(result.rows[0]);
  },
};
