import type { Quotation } from '../types';

export interface ProjectGroup {
  groupId: string;
  projects: Quotation[];
  primaryProject: Quotation;
  versionCount: number;
  totalValue: number;
  latestDate: string;
  latestUpdatedAt: string;
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
    const latestUpdatedAt = quotationsInGroup.reduce((latest, q) => {
      const t = q.updated_at ?? q.created_at;
      return t > latest ? t : latest;
    }, '');

    groups.push({
      groupId,
      projects: sortedQuotations,
      primaryProject: primaryQuotation,
      versionCount: quotationsInGroup.length,
      totalValue,
      latestDate,
      latestUpdatedAt,
    });
  });

  return groups;
}

export function getProjectVersionNumber(quotation: Quotation, allQuotations: Quotation[]): number {
  return quotation.version_number ?? 1;
}
