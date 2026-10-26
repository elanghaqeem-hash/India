/** Hierarki organisasi INDIA. Induk wajib berada pada tingkat yang lebih tinggi. */
export const organizationLevels=['institution','directorate','division','unit','branch'] as const;
export type OrganizationLevel=typeof organizationLevels[number];
const labels:Record<OrganizationLevel,string>={
 institution:'Institusi',directorate:'Direktorat',division:'Divisi',unit:'Unit',branch:'Cabang'
};
export function organizationLevelLabel(level:string):string{
 return Object.hasOwn(labels,level)?labels[level as OrganizationLevel]:level;
}
export function isValidOrganizationParentLevel(child:string,parent:string):boolean{
 const childIndex=organizationLevels.findIndex(x=>x===child);
 const parentIndex=organizationLevels.findIndex(x=>x===parent);
 return childIndex>0&&parentIndex>=0&&parentIndex<childIndex;
}
