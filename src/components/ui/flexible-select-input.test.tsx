import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FlexibleSelectInput } from './flexible-select-input';

function TestHarness() {
  const [value, setValue] = useState('');

  return (
    <div>
      <FlexibleSelectInput
        aria-label="Project"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        options={['Alpha', 'Beta']}
      />
      <div data-testid="value">{value}</div>
    </div>
  );
}

describe('FlexibleSelectInput', () => {
  it('accepts freeform values in addition to suggested options', () => {
    render(<TestHarness />);

    const input = screen.getByLabelText('Project');
    fireEvent.change(input, { target: { value: 'Custom Project' } });

    expect(screen.getByTestId('value')).toHaveTextContent('Custom Project');
  });
});
