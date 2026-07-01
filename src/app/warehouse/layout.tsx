import { WmsShell } from '@/components/wms/layout/WmsShell';

export const metadata = {
  title: 'KiddieKa WMS | Warehouse Management',
  description: 'Enterprise Warehouse Management System for KiddieKa',
};

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return <WmsShell>{children}</WmsShell>;
}
