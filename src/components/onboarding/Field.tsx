/**
 * The one form-field wrapper for every onboarding step: label row with
 * optional counter, error-over-helper precedence, and the validation shake
 * applied to a wrapper so the input itself never remounts (keeps focus).
 */
export default function Field({
  id,
  label,
  required = false,
  helper,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string | null;
  counter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={`field-${id}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-semibold tracking-tight">
          {label} {required && <span className="text-terra">*</span>}
        </label>
        {counter}
      </div>
      {/* shake fires when the class is first applied; never remount (focus) */}
      <div className={error ? "shake" : undefined}>{children}</div>
      {error ? (
        <p className="mt-1.5 text-[12px] font-semibold text-terra-deep">{error}</p>
      ) : (
        helper && <p className="mt-1.5 text-[12px] font-medium text-muted">{helper}</p>
      )}
    </div>
  );
}
