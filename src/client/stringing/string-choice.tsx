export interface StringOption {
  id: string;
  brand: string;
  name: string;
  gauge: string;
}

export function stringLabel(item: StringOption): string {
  return `${item.brand} ${item.name}${item.gauge ? ` · ${item.gauge} mm` : ""}`;
}

export function StringChoice({ strings, value, onChange, required = false }: { strings: StringOption[]; value: string; onChange: (value: string) => void; required?: boolean }) {
  const selected = strings.find(item => stringLabel(item) === value || `${item.brand} ${item.name}` === value);
  return <select required={required} value={selected ? stringLabel(selected) : value} onChange={event => onChange(event.target.value)}>
    <option value="">Choose string and gauge</option>
    {value && !selected ? <option value={value}>{value} (existing)</option> : null}
    {strings.map(item => <option key={item.id} value={stringLabel(item)}>{stringLabel(item)}</option>)}
  </select>;
}
