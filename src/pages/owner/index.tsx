import dynamic from 'next/dynamic';

const OwnerDashboard = dynamic(() => import('../../components/dashboards/OwnerDashboard'), { ssr: false });

export default function OwnerPage() {
  return <OwnerDashboard />;
}
