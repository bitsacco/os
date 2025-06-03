'use client';

import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
}

const PIN_LENGTH = 6;

export function PinInput({
  value,
  onChange,
  error,
  label = 'PIN',
}: PinInputProps): React.JSX.Element {
  const [pins, setPins] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(
    Array(PIN_LENGTH).fill(null),
  );

  // Update internal state when external value changes
  useEffect(() => {
    if (value) {
      // Process string value into array of single digits
      const pinArray = value.split('').slice(0, PIN_LENGTH);

      // Pad with empty strings if needed
      const paddedArray = [...pinArray];
      while (paddedArray.length < PIN_LENGTH) {
        paddedArray.push('');
      }

      setPins(paddedArray);
    } else {
      // Reset pins if value is empty
      setPins(Array(PIN_LENGTH).fill(''));
    }
  }, [value]);

  const handleChange = (index: number, newValue: string) => {
    // Only allow digits
    if (newValue && !/^\d+$/.test(newValue)) {
      return;
    }

    const newPins = [...pins];

    // Handle paste operation
    if (newValue.length > 1) {
      const pastedValue = newValue.slice(0, PIN_LENGTH);
      const pastedPins = pastedValue.split('');

      // Fill pins from current index
      for (let i = 0; i < pastedPins.length && index + i < PIN_LENGTH; i++) {
        newPins[index + i] = pastedPins[i] || '';
      }

      // Focus the next input after paste if exists
      const nextIndex = Math.min(index + pastedPins.length, PIN_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Handle single digit input
      newPins[index] = newValue;

      // Auto-focus next input
      if (newValue && index < PIN_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    setPins(newPins);
    onChange(newPins.join(''));
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    // Handle backspace: move to previous input if current is empty
    if (e.key === 'Backspace' && !pins[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();

      // Update pin value for previous cell
      const newPins = [...pins];
      newPins[index - 1] = '';
      setPins(newPins);
      onChange(newPins.join(''));
    }

    // Handle left arrow: move focus to previous input
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle right arrow: move focus to next input
    if (e.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <FormControl fullWidth error={Boolean(error)}>
      <InputLabel shrink>{label}</InputLabel>

      <Box sx={{ mt: 3 }}>
        <Stack direction="row" spacing={1} justifyContent="space-between">
          {pins.map((pin, index) => (
            <TextField
              key={index}
              id={`pin-input-${index}`}
              variant="outlined"
              value={pin}
              inputRef={(el) => (inputRefs.current[index] = el)}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              inputProps={{
                maxLength: PIN_LENGTH,
                style: {
                  textAlign: 'center',
                  padding: '14px 0',
                  fontSize: '1.2rem',
                  width: '40px',
                  border: '2px solid #008080',
                  borderRadius: '4px',
                },
              }}
              autoComplete="off"
              placeholder="•"
              type="password"
            />
          ))}
        </Stack>
      </Box>

      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
