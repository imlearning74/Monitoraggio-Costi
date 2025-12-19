import { createClient } from '@supabase/supabase-js';
import { AppData, Supplier, Course, ServiceItem, CourseEdition, PurchaseOrder, WorkflowStatus, RiaStatus } from '../types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const api = {
  loadData: async (): Promise<AppData | null> => {
    try {
      const [
        { data: suppliers },
        { data: courses },
        { data: services },
        { data: editions },
        { data: orders },
        { data: lineItems },
        { data: ems },
        { data: emEditions }
      ] = await Promise.all([
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('courses').select('*').order('title'),
        supabase.from('service_items').select('*').order('name'),
        supabase.from('course_editions').select('*').order('run_id'),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('purchase_line_items').select('*'),
        supabase.from('purchase_ems').select('*'),
        supabase.from('purchase_em_editions').select('*')
      ]);

      if (!suppliers) return null;

      return {
        suppliers: (suppliers || []).map(s => ({
          id: s.id,
          name: s.name,
          contractNumber: s.contract_number,
          isActive: s.is_active,
          contractValue: Number(s.contract_value),
          contractStart: s.contract_start || '',
          contractEnd: s.contract_end || ''
        })),
        courses: (courses || []).map(c => ({
          id: c.id,
          supplierId: c.supplier_id,
          title: c.title,
          lmsElementId: c.lms_element_id
        })),
        services: (services || []).map(s => ({
          id: s.id,
          supplierId: s.supplier_id,
          courseId: s.course_id || undefined,
          name: s.name,
          unitPrice: Number(s.unit_price),
          unitType: s.unit_type
        })),
        editions: (editions || []).map(e => ({
          id: e.id,
          courseId: e.course_id,
          lmsLessonId: e.lms_lesson_id || '',
          runId: e.run_id || '',
          startDate: e.start_date || '',
          endDate: e.end_date || ''
        })),
        orders: (orders || []).map(o => {
          const orderItems = (lineItems || [])
            .filter(i => i.purchase_order_id === o.id)
            .map(i => ({
              id: i.id,
              editionId: i.edition_id,
              serviceItemId: i.service_item_id,
              plannedQty: Number(i.planned_qty),
              actualQty: Number(i.actual_qty),
              unitPriceOverride: Number(i.unit_price_override),
              plannedCost: Number(i.planned_cost),
              actualCost: Number(i.actual_cost)
            }));

          const orderEms = (ems || [])
            .filter(em => em.purchase_order_id === o.id)
            .map(em => ({
              id: em.id,
              code: em.code,
              amount: Number(em.amount),
              editionIds: (emEditions || [])
                .filter(rel => rel.purchase_em_id === em.id)
                .map(rel => rel.course_edition_id)
            }));

          return {
            id: o.id,
            supplierId: o.supplier_id,
            title: o.title,
            createdAt: o.created_at || '',
            status: o.status as WorkflowStatus,
            rdaCode: o.rda_code || '',
            riaCode: o.ria_code || '',
            riaStatus: o.ria_status as RiaStatus || RiaStatus.NONE,
            odaCode: o.oda_code || '',
            ems: orderEms,
            items: orderItems
          };
        })
      };
    } catch (e) {
      console.error("Supabase load error:", e);
      return null;
    }
  },

  mutate: async (action: string, data: any) => {
    try {
      switch (action) {
        case 'UPSERT_SUPPLIER':
          await supabase.from('suppliers').upsert({
            id: data.id,
            name: data.name,
            contract_number: data.contractNumber,
            is_active: data.isActive,
            contract_value: data.contractValue,
            contract_start: data.contractStart || null,
            contract_end: data.contractEnd || null
          });
          break;
        case 'DELETE_SUPPLIER':
          await supabase.from('suppliers').delete().eq('id', data.id);
          break;
        case 'UPSERT_SERVICE':
          await supabase.from('service_items').upsert({
            id: data.id,
            supplier_id: data.supplierId,
            course_id: data.courseId || null,
            name: data.name,
            unit_price: data.unitPrice,
            unit_type: data.unitType
          });
          break;
        case 'DELETE_SERVICE':
          await supabase.from('service_items').delete().eq('id', data.id);
          break;
        case 'UPSERT_COURSE':
          await supabase.from('courses').upsert({
            id: data.id,
            supplier_id: data.supplierId,
            title: data.title,
            lms_element_id: data.lmsElementId
          });
          break;
        case 'DELETE_COURSE':
          await supabase.from('courses').delete().eq('id', data.id);
          break;
        case 'UPSERT_EDITION':
          await supabase.from('course_editions').upsert({
            id: data.id,
            course_id: data.courseId,
            lms_lesson_id: data.lmsLessonId,
            run_id: data.runId,
            start_date: data.startDate || null,
            end_date: data.endDate || null
          });
          break;
        case 'UPSERT_ORDER':
          await supabase.from('purchase_orders').upsert({
            id: data.id,
            supplier_id: data.supplierId,
            title: data.title,
            created_at: data.createdAt,
            status: data.status,
            rda_code: data.rdaCode,
            ria_code: data.riaCode,
            ria_status: data.riaStatus,
            oda_code: data.odaCode
          });
          await supabase.from('purchase_line_items').delete().eq('purchase_order_id', data.id);
          if (data.items.length > 0) {
            await supabase.from('purchase_line_items').insert(
              data.items.map((item: any) => ({
                id: item.id,
                purchase_order_id: data.id,
                edition_id: item.editionId,
                service_item_id: item.serviceItemId,
                planned_qty: item.plannedQty,
                actual_qty: item.actualQty,
                unit_price_override: item.unitPriceOverride,
                planned_cost: item.plannedCost,
                actual_cost: item.actualCost
              }))
            );
          }
          await supabase.from('purchase_ems').delete().eq('purchase_order_id', data.id);
          for (const em of (data.ems || [])) {
            await supabase.from('purchase_ems').insert({
              id: em.id,
              purchase_order_id: data.id,
              code: em.code,
              amount: em.amount
            });
            if (em.editionIds && em.editionIds.length > 0) {
                await supabase.from('purchase_em_editions').insert(
                    em.editionIds.map((edId: string) => ({
                        purchase_em_id: em.id,
                        course_edition_id: edId
                    }))
                );
            }
          }
          break;
        case 'DELETE_ORDER':
          await supabase.from('purchase_orders').delete().eq('id', data.id);
          break;
      }
    } catch (e) {
      console.error(`Mutation ${action} failed:`, e);
      throw e;
    }
  }
};