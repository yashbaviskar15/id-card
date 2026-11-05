'use client';

import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { assessPassword } from '@/lib/validation';

/**
 * Password input that supports password managers (autocomplete is passed
 * through), allows paste, and optionally shows a strength meter.
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  showStrength = false,
  required = true,
  autoFocus = false,
}: {
  name: string;
  label: string;
  autoComplete: string;
  showStrength?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const assessment = showStrength ? assessPassword(value) : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-stretch gap-2">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={assessment ? `${id}-strength` : undefined}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </Button>
      </div>
      {assessment ? (
        <div id={`${id}-strength`} className="space-y-1" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={
                  'h-1.5 flex-1 rounded-full ' +
                  (i < assessment.score ? 'bg-[#111827]' : 'bg-[#E5E7EB]')
                }
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {assessment.label}
            {assessment.problems.length > 0 ? ` — ${assessment.problems[0]}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
