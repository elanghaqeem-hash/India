import AdminAccess from '@/components/admin/AdminAccess';
export const dynamic='force-dynamic';
export default function SettingsLayout({children}:{children:React.ReactNode}){
 return <AdminAccess>{children}</AdminAccess>;
}
