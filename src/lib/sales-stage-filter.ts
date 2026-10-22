import { SALES_STAGES, type SalesDeal, type SalesStage } from './sales-workflow';

// Keep the UI filter's IDs AND full display labels tied to the canonical sales workflow.
// Never destructure a SalesStage string as [id, label] (it yields two characters).
export type StageFilterValue = SalesStage | 'all';
export type StageFilterOption = {
  id: StageFilterValue;
  label: string;
  count: number;
  description: string;
};

export function buildStageFilterOptions(deals: readonly Pick<SalesDeal, 'stage'>[]): StageFilterOption[] {
  const counts = new Map<SalesStage, number>();
  for (const deal of deals) {
    counts.set(deal.stage, (counts.get(deal.stage) ?? 0) + 1);
  }

  return [
    { id: 'all', label: 'Semua Tahap', count: deals.length, description: 'Seluruh opportunity yang dapat diakses' },
    ...SALES_STAGES.map(([id, label, weight], index): StageFilterOption => ({
      id,
      label,
      count: counts.get(id) ?? 0,
      description: id === 'closed_won'
        ? 'Selesai · Deal dimenangkan'
        : id === 'closed_lost'
          ? 'Selesai · Deal tidak dimenangkan'
          : 'Tahap ' + (index + 1) + ' dari 8 · Bobot forecast ' + weight + '%',
    })),
  ];
}
