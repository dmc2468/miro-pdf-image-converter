import { useState, type InputHTMLAttributes } from "react";
import { calculate } from "./calculate";

interface CalculationInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function CalculationInput({ value, onChange, min, max, step, ...props }: CalculationInputProps) {
  const [editing, setEditing] = useState<string | null>(null);
  return <input {...props} type="text" value={editing ?? value}
    title="Enter a number or calculation, e.g. =20+15. Press Enter or leave the field to calculate."
    onChange={event => {
      const input = event.currentTarget;
      const text = input.value;
      setEditing(text);
      try {
        const result = text.trim() ? calculate(text) : 0;
        if (min !== undefined && result < Number(min)) throw new Error(`Enter at least ${min}.`);
        if (max !== undefined && result > Number(max)) throw new Error(`Enter no more than ${max}.`);
        if (String(step) === "1" && !Number.isInteger(result)) throw new Error("Enter a whole number.");
        input.setCustomValidity("");
        input.value = text.trim() ? String(result) : "";
        onChange?.(event);
        input.value = text;
      } catch (error) {
        input.setCustomValidity((error as Error).message);
      }
    }}
    onBlur={event => {
      if (event.currentTarget.validity.valid) setEditing(null);
      props.onBlur?.(event);
    }}
    onKeyDown={event => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.currentTarget.reportValidity()) setEditing(null);
      }
      props.onKeyDown?.(event);
    }} />;
}
