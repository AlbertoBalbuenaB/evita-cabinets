import type { Quotation } from '../types';

export interface ProjectGroup {
  groupId: string;
  projects: Quotation[];
  primaryProject: Quotation;
  versionCount: number;
  totalValue: number;
  latestDate: string;
}

export function groupProjectsByGroupId(quotations: Quotation[]): ProjectGroup[] {
  const groupsMap = new Map<string, Quotation[]>();

  quotations.forEach(q => {
    const key = q.project_id;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }

    groupsMap.get(key)!.push(q);
  });

  const groups: ProjectGroup[] = [];

  groupsMap.forEach((quotationsInGroup, groupId) => {
    const sortedQuotations = quotationsInGroup.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const primaryQuotation = sortedQuotations[0];
    const totalValue = quotationsInGroup.reduce((sum, q) => sum + q.total_amount, 0);
    const latestDate = sortedQuotations[0].created_at;

    groups.push({
      groupId,
      projects: sortedQuotations,
      primaryProject: primaryQuotation,
      versionCount: quotationsInGroup.length,
      totalValue,
      latestDate,
    });
  });

  return groups.sort((a, b) =>
    new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  );
}

export function getProjectVersionNumber(quotation: Quotation, allQuotations: Quotation[]): number {
  return quotation.version_number ?? 1;
}
