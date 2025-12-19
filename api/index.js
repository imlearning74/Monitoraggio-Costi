
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon
});

export default async function handler(req, res) {
  const client = await pool.connect();

  try {
    if (req.method === 'GET') {
      // 1. Fetch all data normalized
      const suppliers = await client.query('SELECT * FROM suppliers');
      const courses = await client.query('SELECT * FROM courses');
      const services = await client.query('SELECT * FROM service_items');
      const editions = await client.query('SELECT * FROM course_editions');
      const orders = await client.query('SELECT * FROM purchase_orders');
      const items = await client.query('SELECT * FROM purchase_line_items');
      const ems = await client.query('SELECT * FROM purchase_ems');
      const emEditions = await client.query('SELECT * FROM purchase_em_editions');

      // 2. Map DB Snake_case to Frontend CamelCase
      const appData = {
        suppliers: suppliers.rows.map(s => ({
          id: s.id,
          name: s.name,
          contractNumber: s.contract_number,
          isActive: s.is_active,
          contractValue: parseFloat(s.contract_value),
          contractStart: s.contract_start ? new Date(s.contract_start).toISOString().split('T')[0] : '',
          contractEnd: s.contract_end ? new Date(s.contract_end).toISOString().split('T')[0] : ''
        })),
        courses: courses.rows.map(c => ({
          id: c.id,
          supplierId: c.supplier_id,
          title: c.title,
          lmsElementId: c.lms_element_id
        })),
        services: services.rows.map(s => ({
          id: s.id,
          supplierId: s.supplier_id,
          courseId: s.course_id || undefined,
          name: s.name,
          unitPrice: parseFloat(s.unit_price),
          unitType: s.unit_type
        })),
        editions: editions.rows.map(e => ({
          id: e.id,
          courseId: e.course_id,
          lmsLessonId: e.lms_lesson_id || '',
          runId: e.run_id || '',
          startDate: e.start_date ? new Date(e.start_date).toISOString().split('T')[0] : '',
          endDate: e.end_date ? new Date(e.end_date).toISOString().split('T')[0] : ''
        })),
        orders: orders.rows.map(o => {
          // Reconstruct nested structure for Orders
          const orderItems = items.rows
            .filter(i => i.purchase_order_id === o.id)
            .map(i => ({
              id: i.id,
              editionId: i.edition_id,
              serviceItemId: i.service_item_id,
              plannedQty: parseFloat(i.planned_qty),
              actualQty: parseFloat(i.actual_qty),
              unitPriceOverride: parseFloat(i.unit_price_override),
              plannedCost: parseFloat(i.planned_cost),
              actualCost: parseFloat(i.actual_cost)
            }));

          const orderEms = ems.rows
            .filter(em => em.purchase_order_id === o.id)
            .map(em => ({
              id: em.id,
              code: em.code,
              amount: parseFloat(em.amount),
              editionIds: emEditions.rows
                 .filter(rel => rel.purchase_em_id === em.id)
                 .map(rel => rel.course_edition_id)
            }));

          return {
            id: o.id,
            supplierId: o.supplier_id,
            title: o.title,
            createdAt: o.created_at ? new Date(o.created_at).toISOString().split('T')[0] : '',
            status: o.status,
            rdaCode: o.rda_code || '',
            riaCode: o.ria_code || '',
            riaStatus: o.ria_status || '',
            odaCode: o.oda_code || '',
            ems: orderEms,
            items: orderItems
          };
        })
      };

      res.status(200).json(appData);

    } else if (req.method === 'POST') {
      const { action, data } = req.body;
      
      // TRANSACTION WRAPPER
      await client.query('BEGIN');

      try {
        if (action === 'UPSERT_SUPPLIER') {
          await client.query(`
            INSERT INTO suppliers (id, name, contract_number, is_active, contract_value, contract_start, contract_end)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name, contract_number = EXCLUDED.contract_number, is_active = EXCLUDED.is_active,
              contract_value = EXCLUDED.contract_value, contract_start = EXCLUDED.contract_start, contract_end = EXCLUDED.contract_end
          `, [data.id, data.name, data.contractNumber, data.isActive, data.contractValue, data.contractStart || null, data.contractEnd || null]);

        } else if (action === 'DELETE_SUPPLIER') {
            await client.query('DELETE FROM suppliers WHERE id = $1', [data.id]);

        } else if (action === 'UPSERT_SERVICE') {
            await client.query(`
                INSERT INTO service_items (id, supplier_id, course_id, name, unit_price, unit_type)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, unit_price = EXCLUDED.unit_price, unit_type = EXCLUDED.unit_type, course_id = EXCLUDED.course_id
            `, [data.id, data.supplierId, data.courseId || null, data.name, data.unitPrice, data.unitType]);

        } else if (action === 'DELETE_SERVICE') {
            await client.query('DELETE FROM service_items WHERE id = $1', [data.id]);

        } else if (action === 'UPSERT_COURSE') {
             await client.query(`
                INSERT INTO courses (id, supplier_id, title, lms_element_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, lms_element_id = EXCLUDED.lms_element_id
            `, [data.id, data.supplierId, data.title, data.lmsElementId]);

        } else if (action === 'DELETE_COURSE') {
             await client.query('DELETE FROM courses WHERE id = $1', [data.id]);

        } else if (action === 'UPSERT_ORDER') {
             // 1. Upsert Order Header
             await client.query(`
                INSERT INTO purchase_orders (id, supplier_id, title, created_at, status, rda_code, ria_code, ria_status, oda_code)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                  supplier_id=EXCLUDED.supplier_id, title=EXCLUDED.title, status=EXCLUDED.status,
                  rda_code=EXCLUDED.rda_code, ria_code=EXCLUDED.ria_code, ria_status=EXCLUDED.ria_status, oda_code=EXCLUDED.oda_code
             `, [data.id, data.supplierId, data.title, data.createdAt, data.status, data.rdaCode, data.riaCode, data.riaStatus, data.odaCode]);

             // 2. Handle Editions (Upsert) - Editions are shared, so we upsert them first
             // Note: In a real app, editions might be handled separately, but here they are often created inside the order flow.
             // We need to loop through items to find editionIds, or receive editions in the payload. 
             // LIMITATION: This handler assumes editions are already created or we pass them.
             // For simplicity in this prompt, we assume editions are saved separately OR we ignore edition updates here?
             // NO, we must save them. Let's assume the Frontend sends 'editions' in a separate call or we rely on the component saving them.
             // BETTER: The component calls SAVE_EDITION.

             // 3. Sync Items (Delete old for this order, Insert new)
             await client.query('DELETE FROM purchase_line_items WHERE purchase_order_id = $1', [data.id]);
             for (const item of data.items) {
                 await client.query(`
                    INSERT INTO purchase_line_items (id, purchase_order_id, edition_id, service_item_id, planned_qty, actual_qty, unit_price_override, planned_cost, actual_cost)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 `, [item.id, data.id, item.editionId, item.serviceItemId, item.plannedQty, item.actualQty, item.unitPriceOverride, item.plannedCost, item.actualCost]);
             }

             // 4. Sync EMs
             await client.query('DELETE FROM purchase_ems WHERE purchase_order_id = $1', [data.id]);
             for (const em of data.ems) {
                 await client.query(`INSERT INTO purchase_ems (id, purchase_order_id, code, amount) VALUES ($1, $2, $3, $4)`, [em.id, data.id, em.code, em.amount]);
                 // EM Relations
                 for (const edId of em.editionIds) {
                     await client.query(`INSERT INTO purchase_em_editions (purchase_em_id, course_edition_id) VALUES ($1, $2)`, [em.id, edId]);
                 }
             }

        } else if (action === 'DELETE_ORDER') {
            await client.query('DELETE FROM purchase_orders WHERE id = $1', [data.id]);

        } else if (action === 'UPSERT_EDITION') {
             await client.query(`
                INSERT INTO course_editions (id, course_id, lms_lesson_id, run_id, start_date, end_date)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET
                  lms_lesson_id=EXCLUDED.lms_lesson_id, run_id=EXCLUDED.run_id, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date
             `, [data.id, data.courseId, data.lmsLessonId, data.runId, data.startDate || null, data.endDate || null]);
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true });

      } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ error: e.message });
      }

    } else {
      res.status(405).send('Method Not Allowed');
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Connection Error' });
  } finally {
    client.release();
  }
}
