import { CircleAlert, CircleCheck } from 'lucide-react';

export default function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  return (
    <>
      {sp.error && (
        <div className="alert alert-error" role="alert">
          <CircleAlert size={18} /><span>{sp.error}</span>
        </div>
      )}
      {sp.msg && (
        <div className="alert alert-ok" role="status">
          <CircleCheck size={18} /><span>{sp.msg}</span>
        </div>
      )}
    </>
  );
}
