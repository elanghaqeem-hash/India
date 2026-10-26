import AdminAccess from '@/components/admin/AdminAccess';
export const dynamic='force-dynamic';
export default function UsersLayout({children}:{children:React.ReactNode}){
 return <AdminAccess>{children}</AdminAccess>;
}
