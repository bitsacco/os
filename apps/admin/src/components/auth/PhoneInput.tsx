"use client";

import React, { useState, useMemo } from "react";
import { styled } from "@mui/material/styles";
import {
  FormControl,
  FormHelperText,
  InputLabel,
  Menu,
  MenuItem,
} from "@mui/material";
import { Box } from "@mui/system";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
}

export function PhoneInput({
  value,
  onChange,
  error,
  label = "Phone",
}: PhoneInputProps) {
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] =
    useState<Country>(DEFAULT_COUNTRY);

  const filteredCountries = useMemo(() => {
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(search.toLowerCase()) ||
        country.dialCode.includes(search),
    );
  }, [search]);

  const handleCountrySelect = (country: (typeof countries)[0]) => {
    setSelectedCountry(country);
    onChange(`+${country.dialCode}`);
    setSearch("");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(`${e.target.value}`);
  };

  // Add state for menu anchor
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Handle menu open/close
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSearch("");
  };

  return (
    <FormControl fullWidth error={Boolean(error)}>
      <InputLabel shrink>{label}</InputLabel>

      <InputWrapper sx={{ mt: 3 }}>
        <CountryButton onClick={handleMenuOpen}>
          {getFlagEmoji(selectedCountry.code)}
        </CountryButton>
        <PhoneNumberInput
          value={value}
          placeholder="Phone number"
          onChange={handlePhoneChange}
        />
      </InputWrapper>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        style={{
          padding: 4,
        }}
      >
        <SearchInput
          placeholder="Search Countries"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          tabIndex={1}
        />
        {filteredCountries.map((country) => (
          <MenuItem
            key={country.code}
            onClick={() => {
              handleCountrySelect(country);
              handleMenuClose();
            }}
            tabIndex={1}
          >
            <Box display="flex" gap={1} alignItems="center">
              <span>{getFlagEmoji(country.code)}</span>
              <span>{country.name}</span>
              <span>+{country.dialCode}</span>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}

const Container = styled("div")({
  width: "100%",
});

const InputWrapper = styled("div")({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "16px",
});

const CountryButton = styled("button")({
  display: "flex",
  alignItems: "center",
  padding: "4px 10px",
  border: "2px solid #008080",
  borderRadius: "4px",
  fontSize: "24px",
  background: "white",
  cursor: "pointer",
  "&:hover": {
    backgroundColor: "#f5f5f5",
  },
});

const PhoneNumberInput = styled("input")({
  flex: 1,
  padding: "8px 12px",
  border: "2px solid #008080",
  borderRadius: "4px",
  fontSize: "16px",
});

const SearchInput = styled("input")({
  width: "100%",
  padding: "12px",
  borderRadius: "4px",
  marginBottom: "8px",
});

const getFlagEmoji = (countryCode: string) => {
  const codePoints = Array.from(countryCode.toUpperCase()).map(
    (char) => 127397 + char.charCodeAt(0),
  );
  return String.fromCodePoint(...codePoints);
};

interface Country {
  code: string;
  name: string;
  dialCode: string;
}

const DEFAULT_COUNTRY: Country = {
  code: "KE",
  name: "Kenya",
  dialCode: "254",
};

const countries: Country[] = [
  // Africa
  { code: "KE", name: "Kenya", dialCode: "254" },
  { code: "NG", name: "Nigeria", dialCode: "234" },
  { code: "TZ", name: "Tanzania", dialCode: "255" },
  { code: "UG", name: "Uganda", dialCode: "256" },

  // North America
  { code: "CA", name: "Canada", dialCode: "1" },
  { code: "US", name: "United States", dialCode: "1" },
  { code: "MX", name: "Mexico", dialCode: "52" },

  // Caribbean
  { code: "JM", name: "Jamaica", dialCode: "1876" },
];
