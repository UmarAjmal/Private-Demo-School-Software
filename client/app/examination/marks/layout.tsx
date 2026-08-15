import PermissionGuard from '@/components/PermissionGuard';
export default function Layout({ children }: { children: React.ReactNode }) {
    return <PermissionGuard module="academic.examination">{children}</PermissionGuard>;
}
