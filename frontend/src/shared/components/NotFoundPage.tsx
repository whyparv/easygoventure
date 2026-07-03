import { useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/ui/button';
import { ROUTES } from '@app/config/routes';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <Button onClick={() => navigate(ROUTES.dashboard)}>Back to dashboard</Button>
    </div>
  );
}
