'use client';

import * as React from 'react';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

interface TimeRangeSelectorProps {
  value: string;
  onChange: (value: '1h' | '24h' | '7d' | '30d' | '90d') => void;
}

/**
 * Time range selector component for metrics dashboard
 */
export function TimeRangeSelector({
  value,
  onChange,
}: TimeRangeSelectorProps): React.JSX.Element {
  const handleChange = (
    event: React.MouseEvent<HTMLElement>,
    newValue: string | null,
  ) => {
    if (newValue !== null) {
      onChange(newValue as '1h' | '24h' | '7d' | '30d' | '90d');
    }
  };

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={handleChange}
      aria-label="time range"
      size="small"
    >
      <ToggleButton value="1h" aria-label="1 hour">
        1h
      </ToggleButton>
      <ToggleButton value="24h" aria-label="24 hours">
        24h
      </ToggleButton>
      <ToggleButton value="7d" aria-label="7 days">
        7d
      </ToggleButton>
      <ToggleButton value="30d" aria-label="30 days">
        30d
      </ToggleButton>
      <ToggleButton value="90d" aria-label="90 days">
        90d
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
