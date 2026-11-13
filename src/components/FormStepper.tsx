import React, { useCallback, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Divide un formulario largo en pasos sin desmontar los campos:
 * los pasos inactivos solo se ocultan, así el estado y la validación nativa se conservan.
 */

export interface StepDef {
  label: string;
}

// Un panel por paso. `contents` mantiene los hijos como elementos directos de la cuadrícula del padre.
export function StepPanel({ step, current, children }: { step: number; current: number; children: React.ReactNode }) {
  return (
    <div data-step={step} className={current === step ? 'contents' : 'hidden'}>
      {children}
    </div>
  );
}

const fieldsOf = (form: HTMLFormElement, step: number) =>
  Array.from(form.querySelectorAll<HTMLInputElement>(`[data-step="${step}"] input, [data-step="${step}"] select, [data-step="${step}"] textarea`));

const firstInvalidStep = (form: HTMLFormElement, total: number): number | null => {
  for (let s = 1; s <= total; s++) {
    if (fieldsOf(form, s).some(el => !el.disabled && !el.checkValidity())) return s;
  }
  return null;
};

export function useFormStepper(total: number) {
  const [step, setStep] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);

  const reset = useCallback(() => setStep(1), []);

  // Valida el paso actual antes de avanzar
  const next = useCallback(() => {
    const form = formRef.current;
    if (form) {
      const bad = fieldsOf(form, step).find(el => !el.disabled && !el.checkValidity());
      if (bad) {
        bad.reportValidity();
        return;
      }
    }
    setStep(s => Math.min(total, s + 1));
  }, [step, total]);

  const back = useCallback(() => setStep(s => Math.max(1, s - 1)), []);

  // Ir a un paso: solo hacia adelante si los pasos intermedios son válidos
  const goTo = useCallback((target: number) => {
    const form = formRef.current;
    if (target <= step || !form) {
      setStep(Math.max(1, target));
      return;
    }
    for (let s = step; s < target; s++) {
      const bad = fieldsOf(form, s).find(el => !el.disabled && !el.checkValidity());
      if (bad) {
        setStep(s);
        setTimeout(() => bad.reportValidity(), 30);
        return;
      }
    }
    setStep(target);
  }, [step]);

  // Envoltura de onSubmit: en pasos intermedios avanza; en el último valida todo y guarda
  const wrapSubmit = useCallback(
    <E extends React.FormEvent<HTMLFormElement>>(onSubmit: (e: E) => void) =>
      (e: E) => {
        const form = e.currentTarget as HTMLFormElement;
        if (step < total) {
          e.preventDefault();
          next();
          return;
        }
        const badStep = firstInvalidStep(form, total);
        if (badStep !== null) {
          e.preventDefault();
          setStep(badStep);
          setTimeout(() => {
            const bad = fieldsOf(form, badStep).find(el => !el.disabled && !el.checkValidity());
            bad?.reportValidity();
          }, 30);
          return;
        }
        onSubmit(e);
      },
    [step, total, next]
  );

  return { step, setStep, reset, next, back, goTo, wrapSubmit, total, formRef };
}

export function StepIndicator({
  steps,
  current,
  onGo
}: {
  steps: StepDef[];
  current: number;
  onGo: (step: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1.5 px-6 pt-4 pb-1" aria-label="Pasos del formulario">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={s.label}>
            <li className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onGo(n)}
                aria-current={active ? 'step' : undefined}
                className="w-full flex items-center gap-2 cursor-pointer group text-left"
              >
                <span
                  className={`w-6 h-6 shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                    active ? 'bg-teal-600 text-white shadow-sm' : done ? 'bg-teal-100 text-teal-700' : 'bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200'
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : n}
                </span>
                <span className={`text-[11px] font-semibold truncate ${active ? 'text-neutral-900' : 'text-neutral-400'}`}>{s.label}</span>
              </button>
              <div className={`h-0.5 mt-2 rounded-full ${active ? 'bg-teal-600' : done ? 'bg-teal-200' : 'bg-neutral-100'}`} />
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}

export function StepActions({
  step,
  total,
  onCancel,
  onBack,
  onNext,
  submitLabel
}: {
  step: number;
  total: number;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  submitLabel: string;
}) {
  const last = step === total;
  return (
    <div className="pt-2 flex gap-3 sticky bottom-0 bg-white pb-1">
      {step === 1 ? (
        <button type="button" onClick={onCancel} className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs cursor-pointer">
          Cancelar
        </button>
      ) : (
        <button type="button" onClick={onBack} className="w-1/2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Atrás
        </button>
      )}
      {last ? (
        <button type="submit" className="w-1/2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md">
          {submitLabel}
        </button>
      ) : (
        <button type="button" onClick={onNext} className="w-1/2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md flex items-center justify-center gap-1">
          Siguiente <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
