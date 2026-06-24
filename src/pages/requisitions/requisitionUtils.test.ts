import { describe, it, expect } from 'vitest';
import { buildRequisitionPayload } from './requisitionUtils';

describe('buildRequisitionPayload', () => {
  it('adds a requisition date and preserves the selected profile id', () => {
    const payload = buildRequisitionPayload({
      project_id: 'project-1',
      requisition_type: 'Materials',
      employee_id: 'profile-1',
      department: 'Site Ops',
      deadline: '2026-07-01',
      is_change_order: true,
      reason: 'Need materials',
    }, 'user-1');

    expect(payload).toMatchObject({
      project_id: 'project-1',
      requisition_type: 'Materials',
      employee_id: 'profile-1',
      department: 'Site Ops',
      deadline: '2026-07-01',
      is_change_order: true,
      reason: 'Need materials',
      status: 'new',
      created_by: 'user-1',
    });
    expect(payload.requisition_date).toEqual(expect.any(String));
  });
});
