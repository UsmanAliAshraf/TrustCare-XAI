import { Link } from 'react-router-dom'
import { diseasePath } from '@/lib/browse'
import { cn } from '@/lib/utils'

// A condition name rendered as an anchor into its node of the browsing
// hierarchy. Stops propagation so it works inside clickable table rows.
export function DiseaseLink({ disease, className }: { disease: string; className?: string }) {
  if (!disease || disease === 'None') return <>{disease || '—'}</>
  return (
    <Link
      to={diseasePath(disease)}
      onClick={(e) => e.stopPropagation()}
      className={cn('hover:text-primary hover:underline', className)}
    >
      {disease}
    </Link>
  )
}
