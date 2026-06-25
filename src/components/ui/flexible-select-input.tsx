import * as React from 'react';
import { Input } from '@/components/ui/input';

interface FlexibleSelectInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  options?: string[];
}

export function FlexibleSelectInput({ options = [], value, onChange, ...props }: FlexibleSelectInputProps) {
  const [inputValue, setInputValue] = React.useState(String(value ?? ''));

  React.useEffect(() => {
    setInputValue(String(value ?? ''));
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setInputValue(nextValue);
    onChange?.(event);
  };

  return (
    <div className="space-y-1">
      <Input
        {...props}
        value={inputValue}
        onChange={handleChange}
        list={options.length ? `${props.id ?? 'flexible-select'}-options` : undefined}
      />
      {options.length > 0 && (
        <datalist id={props.id ? `${props.id}-options` : 'flexible-select-options'}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  );
}
