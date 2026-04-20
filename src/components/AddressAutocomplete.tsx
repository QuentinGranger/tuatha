"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./AddressAutocomplete.module.scss";

interface PlaceResult {
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Rechercher une adresse...",
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setShowDropdown(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (val: string) => {
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    setShowDropdown(false);
    setLoadingPlace(true);
    onChange(suggestion.description);

    try {
      const res = await fetch(`/api/places/details?placeId=${suggestion.placeId}`);
      const data = await res.json();

      if (data.address) {
        onChange(data.address);
        onSelect({
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          placeId: data.placeId,
        });
      }
    } catch {
      // Keep the description as fallback
    } finally {
      setLoadingPlace(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        disabled={loadingPlace}
      />

      {showDropdown && suggestions.length > 0 && (
        <ul className={styles.dropdown}>
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className={styles.suggestion}
                onClick={() => handleSelect(s)}
              >
                <span className={styles.mainText}>{s.mainText}</span>
                {s.secondaryText && (
                  <span className={styles.secondaryText}>{s.secondaryText}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
